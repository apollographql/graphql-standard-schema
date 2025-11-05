import {
  buildASTSchema,
  type DocumentNode,
  execute,
  type FormattedExecutionResult,
  type FragmentDefinitionNode,
  getVariableValues,
  GraphQLError,
  type GraphQLFormattedError,
  GraphQLNonNull,
  GraphQLScalarType,
  GraphQLSchema,
  isObjectType,
  Kind,
  type OperationDefinitionNode,
  OperationTypeNode,
} from "graphql";
import type {
  StandardJSONSchemaV1,
  StandardSchemaV1,
} from "./standard-schema-spec.ts";
import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import type { OpenAiSupportedJsonSchema } from "./openAiSupportedJsonSchema.ts";
import type {
  CombinedSpec,
  CalculateSerializedType,
  ScalarMapping,
} from "./types.ts";
import { composeStandardSchemas, nullable } from "./composeStandardSchemas.ts";
import { responseShapeSchema } from "./schema/responseShapeSchema.ts";
import { schemaBase } from "./schema/schemaBase.ts";
import { assert } from "./assert.ts";
import { buildVariablesSchema } from "./schema/buildVariablesSchema.ts";
import { buildFragmentSchema } from "./schema/buildFragmentSchema.ts";
import { buildOperationSchema } from "./schema/buildOperationSchema.ts";
import { fakeVariables } from "./fakeVariables.ts";
import { addTypename } from "./transforms/addTypename.ts";
import { mapSchema, MapperKind } from "@graphql-tools/utils";
import { getOperation } from "./getOperation.ts";
import {
  parseSelectionSet,
  parseData as parseDataSelection,
} from "./parseData.ts";
import type { normalize } from "path";

export declare namespace GraphQLStandardSchemaGenerator {
  export namespace Internal {
    export type ScalarMapping = Record<
      string,
      OpenAiSupportedJsonSchema.Anything
    >;
  }

  export interface ScalarDefinition<Input, Output> {
    type: GraphQLScalarType<Output, Input>;
    jsonSchema: {
      deserialized: OpenAiSupportedJsonSchema.Anything;
      serialized: OpenAiSupportedJsonSchema.Anything;
    };
    /** Will be used as "fake variable value" if this scalar is ever used in a non-nullable variable input value. */
    defaultValue?: any;
  }

  export type ScalarDefinitions = Record<
    string,
    GraphQLStandardSchemaGenerator.ScalarDefinition<any, any>
  >;

  export type DocumentTransform = (document: DocumentNode) => DocumentNode;
  export interface Options<
    Scalars extends GraphQLStandardSchemaGenerator.ScalarDefinitions = Record<
      string,
      never
    >,
  > {
    schema: GraphQLSchema | DocumentNode;
    scalarTypes?: Scalars;
    defaultJSONSchemaOptions?: JSONSchemaOptions | "OpenAI";
    documentTransfoms?: GraphQLStandardSchemaGenerator.DocumentTransform[];
  }

  export type Serialized<
    TData,
    Scalars extends GraphQLStandardSchemaGenerator.ScalarDefinitions = Record<
      string,
      never
    >,
  > = CalculateSerializedType<TData, ScalarMapping<Scalars>>;

  export type Deserialized<
    TData,
    Scalars extends GraphQLStandardSchemaGenerator.ScalarDefinitions = Record<
      string,
      never
    >,
  > = TData;

  export type JSONSchemaCreator = (
    params?: StandardJSONSchemaV1.Options & JSONSchemaOptions
  ) => OpenAiSupportedJsonSchema;

  export interface JSONSchemaOptions {
    /**
     * If true, nullable properties will be marked as optional in the generated JSON Schema.
     *
     * {@defaultValue true}
     *
     * When `defaultJSONSchemaOptions` is set to "OpenAI", this will be false.
     */
    optionalNullableProperties?: boolean;
    /**
     * If set to either `true` or `false`, this setting will be added to all object types.
     * @defaultValue undefined
     */
    additionalProperties?: boolean;
  }

  export type JSONSchema = OpenAiSupportedJsonSchema;

  export interface ValidationSchema<Input, Output = Input>
    extends CombinedSpec<Input, Output> {
    (value: unknown): StandardSchemaV1.Result<Output>;
  }
}
export class GraphQLStandardSchemaGenerator<
  Scalars extends GraphQLStandardSchemaGenerator.ScalarDefinitions = Record<
    string,
    never
  >,
> {
  private schema!: GraphQLSchema;
  private scalarTypes: Scalars;
  private deserializedScalarTypes: GraphQLStandardSchemaGenerator.Internal.ScalarMapping;
  private serializedScalarTypes: GraphQLStandardSchemaGenerator.Internal.ScalarMapping;
  private defaultJSONSchemaOptions: GraphQLStandardSchemaGenerator.JSONSchemaOptions;
  private documentTransfoms: GraphQLStandardSchemaGenerator.DocumentTransform[];
  constructor({
    schema,
    scalarTypes = {} as Scalars,
    defaultJSONSchemaOptions,
    documentTransfoms = [addTypename],
  }: GraphQLStandardSchemaGenerator.Options<Scalars>) {
    this.scalarTypes = scalarTypes;
    this.replaceSchema(schema);
    this.deserializedScalarTypes = Object.fromEntries(
      Object.entries(scalarTypes).map(([key, def]) => [
        key,
        def.jsonSchema.deserialized,
      ])
    );
    this.serializedScalarTypes = Object.fromEntries(
      Object.entries(scalarTypes).map(([key, def]) => [
        key,
        def.jsonSchema.serialized,
      ])
    );
    this.documentTransfoms = documentTransfoms;
    this.defaultJSONSchemaOptions =
      defaultJSONSchemaOptions === "OpenAI"
        ? {
            additionalProperties: false,
            optionalNullableProperties: false,
          }
        : {
            optionalNullableProperties: true,
            ...defaultJSONSchemaOptions,
          };
  }

  replaceSchema(schema: GraphQLSchema | DocumentNode) {
    assert(
      "getTypeMap" in schema || "kind" in schema,
      "Schema needs to be of type GraphQLSchema or DocumentNode"
    );

    const schemaInstance =
      "getTypeMap" in schema ? schema : buildASTSchema(schema);

    // override pre-existing scalar types with scalars passed in via the `scalarTypes` option
    this.schema = mapSchema(schemaInstance, {
      [MapperKind.SCALAR_TYPE]: (type) => {
        return this.scalarTypes[type.name]?.type ?? type;
      },
    });
  }

  getDataSchema<TData>(
    document: TypedDocumentNode<TData, any>
  ): GraphQLStandardSchemaGenerator.ValidationSchema<
    GraphQLStandardSchemaGenerator.Serialized<TData, Scalars>,
    GraphQLStandardSchemaGenerator.Serialized<TData, Scalars>
  > & {
    normalize: GraphQLStandardSchemaGenerator.ValidationSchema<
      GraphQLStandardSchemaGenerator.Serialized<TData, Scalars>,
      GraphQLStandardSchemaGenerator.Serialized<TData, Scalars>
    >;
    deserialize: GraphQLStandardSchemaGenerator.ValidationSchema<
      GraphQLStandardSchemaGenerator.Serialized<TData, Scalars>,
      GraphQLStandardSchemaGenerator.Deserialized<TData, Scalars>
    >;
    serialize: GraphQLStandardSchemaGenerator.ValidationSchema<
      GraphQLStandardSchemaGenerator.Deserialized<TData, Scalars>,
      GraphQLStandardSchemaGenerator.Serialized<TData, Scalars>
    >;
  } {
    type Serialized = GraphQLStandardSchemaGenerator.Serialized<TData, Scalars>;
    type Deserialized = GraphQLStandardSchemaGenerator.Deserialized<
      TData,
      Scalars
    >;
    const schema = this.schema;
    const scalarTypes = this.scalarTypes;
    document = this.documentTransfoms.reduce(
      (doc, transform) => transform(doc),
      document
    );
    const operation = getOperation(document);
    const variableValues = fakeVariables(
      operation.variableDefinitions || [],
      schema,
      scalarTypes
    );

    const buildSchema: (
      direction: "serialized" | "deserialized"
    ) => GraphQLStandardSchemaGenerator.JSONSchemaCreator =
      (direction) => (options) => {
        return {
          ...schemaBase(options),
          ...buildOperationSchema(
            schema,
            document,
            operation,
            this[`${direction}ScalarTypes`],
            { ...this.defaultJSONSchemaOptions, ...options }
          ),
        };
      };

    function serializeData(value: any): StandardSchemaV1.Result<Serialized> {
      const result = execute({
        schema,
        document,
        variableValues,
        fieldResolver: (source, args, context, info) => {
          return source[info.fieldName];
        },
        rootValue: value,
      }) as FormattedExecutionResult;

      if (result.errors?.length) {
        return {
          issues: result.errors.map(formatError),
        };
      }
      return {
        value: result.data as GraphQLStandardSchemaGenerator.Serialized<
          TData,
          Scalars
        >,
      };
    }
    function deserializeData(
      data: unknown
    ): StandardSchemaV1.Result<Deserialized> {
      return parseDataSelection(
        data,
        operation,
        schema,
        document,
        variableValues,
        "deserialize"
      );
    }
    function parseData(data: unknown): StandardSchemaV1.Result<Serialized> {
      return parseDataSelection(
        data,
        operation,
        schema,
        document,
        variableValues,
        "parse"
      );
    }

    const base = validationSchema<Serialized, Serialized>(
      parseData,
      buildSchema("serialized"),
      buildSchema("serialized")
    );
    return Object.assign(base, {
      normalize: base,
      deserialize: validationSchema<Serialized, Deserialized>(
        deserializeData,
        buildSchema("serialized"),
        buildSchema("deserialized")
      ),
      serialize: validationSchema<Deserialized, Serialized>(
        serializeData,
        buildSchema("deserialized"),
        buildSchema("serialized")
      ),
    });
  }

  getResponseSchema<TData>(
    document: TypedDocumentNode<TData>
  ): GraphQLStandardSchemaGenerator.ValidationSchema<
    {
      errors?: ReadonlyArray<GraphQLFormattedError> | null;
      data?: GraphQLStandardSchemaGenerator.Serialized<TData, Scalars> | null;
      extensions?: Record<string, unknown> | null;
    },
    {
      errors?: ReadonlyArray<GraphQLFormattedError> | null;
      data?: GraphQLStandardSchemaGenerator.Serialized<TData, Scalars> | null;
      extensions?: Record<string, unknown> | null;
    }
  > {
    const composed = composeStandardSchemas(
      responseShapeSchema(getOperation(document)),
      ["data"] as const,
      nullable(this.getDataSchema<TData>(document).normalize),
      false
    );
    return validationSchema(
      function validate(value: unknown) {
        const result = composed["~standard"].validate(value);
        assert(!("then" in result));
        return result;
      },
      composed["~standard"].jsonSchema
        .input as GraphQLStandardSchemaGenerator.JSONSchemaCreator,
      composed["~standard"].jsonSchema
        .output as GraphQLStandardSchemaGenerator.JSONSchemaCreator
    );
  }

  getFragmentSchema<TData>(
    document: TypedDocumentNode<TData>,
    {
      fragmentName,
    }: {
      fragmentName?: string;
    } = {}
  ): GraphQLStandardSchemaGenerator.ValidationSchema<
    GraphQLStandardSchemaGenerator.Serialized<TData, Scalars>,
    GraphQLStandardSchemaGenerator.Serialized<TData, Scalars>
  > {
    if (
      !document.definitions.every((def) => def.kind === "FragmentDefinition")
    ) {
      throw new Error("Document must only contain fragment definitions");
    }
    document = this.documentTransfoms.reduce(
      (doc, transform) => transform(doc),
      document
    );
    const fragments = document.definitions as FragmentDefinitionNode[];

    assert(fragments.length !== 0, "No fragments found in document");
    assert(
      fragments.length == 1 || fragmentName,
      "Multiple fragments found, please specify a fragmentName"
    );

    const fragment = fragments.find((def) =>
      fragmentName ? def.name.value === fragmentName : true
    );
    assert(
      fragment,
      `Fragment with name ${fragmentName} not found in document`
    );

    const validate = (
      value: unknown
    ): StandardSchemaV1.Result<
      GraphQLStandardSchemaGenerator.Serialized<TData, Scalars>
    > => {
      assert(typeof value === "object" && value !== null, "Expected object");
      const typename = (value as any)["__typename"];
      assert(typename, "Expected __typename field in fragment data");
      const fragmentType = this.schema.getType(typename);
      assert(
        fragmentType,
        `Type "${typename}" not found in schema for fragment`
      );
      assert(
        isObjectType(fragmentType),
        `Type "${typename}" is not an object type`
      );

      return parseSelectionSet({
        data: value,
        selections: fragment.selectionSet.selections,
        rootType: fragmentType,
        variableValues: {},
        schema: this.schema,
        rootPath: [],
        document,
        mode: "parse",
      });
    };

    const buildSchema: (
      direction: "serialized" | "deserialized"
    ) => GraphQLStandardSchemaGenerator.JSONSchemaCreator =
      (direction) => (options) => {
        return {
          ...schemaBase(options),
          ...buildFragmentSchema(
            this.schema,
            document,
            fragment,
            this[`${direction}ScalarTypes`],
            { ...this.defaultJSONSchemaOptions, ...options }
          ),
        };
      };

    return validationSchema(
      validate,
      buildSchema("serialized"),
      buildSchema("serialized")
    );
  }

  getVariablesSchema<TVariables>(
    document: TypedDocumentNode<any, TVariables>
  ): GraphQLStandardSchemaGenerator.ValidationSchema<
    GraphQLStandardSchemaGenerator.Serialized<TVariables, Scalars>,
    GraphQLStandardSchemaGenerator.Deserialized<TVariables, Scalars>
  > {
    const schema = this.schema;
    document = this.documentTransfoms.reduce(
      (doc, transform) => transform(doc),
      document
    );
    const operation = getOperation(document);
    const buildSchema: (
      direction: "serialized" | "deserialized"
    ) => GraphQLStandardSchemaGenerator.JSONSchemaCreator =
      (direction) => (options) => {
        return {
          ...schemaBase(options),
          ...buildVariablesSchema(
            schema,
            document,
            operation,
            this[`${direction}ScalarTypes`],
            { ...this.defaultJSONSchemaOptions, ...options }
          ),
        };
      };
    function deserializeVariables(
      variables: unknown
    ): StandardSchemaV1.Result<TVariables> {
      if (typeof variables !== "object" || variables === null) {
        return {
          issues: [
            {
              message: `Expected variables to be an object, got ${typeof variables}`,
            },
          ],
        };
      }
      const result = getVariableValues(
        schema,
        operation.variableDefinitions || [],
        variables as Record<string, unknown>
      );
      if (result.coerced) {
        return { value: result.coerced as TVariables };
      }
      return {
        issues: result.errors?.map(formatError),
      };
    }
    return validationSchema(
      deserializeVariables,
      buildSchema("serialized"),
      buildSchema("deserialized")
    );
  }
}

function validationSchema<Input, Output = Input>(
  validate: (value: unknown) => StandardSchemaV1.Result<Output>,
  inputSchema: GraphQLStandardSchemaGenerator.JSONSchemaCreator,
  outputSchema: GraphQLStandardSchemaGenerator.JSONSchemaCreator
): GraphQLStandardSchemaGenerator.ValidationSchema<Input, Output> {
  const wrapper = {
    [validate.name](arg: unknown) {
      return validate(arg);
    },
  }[validate.name]!;
  return Object.assign(
    wrapper,
    standardSchema<Input, Output>(wrapper, inputSchema, outputSchema)
  );
}

export function standardSchema<Input, Output>(
  validate: GraphQLStandardSchemaGenerator.ValidationSchema<
    Input,
    Output
  >["~standard"]["validate"],
  input: GraphQLStandardSchemaGenerator.JSONSchemaCreator,
  output: GraphQLStandardSchemaGenerator.JSONSchemaCreator
): CombinedSpec<Input, Output> {
  return {
    "~standard": {
      validate,
      jsonSchema: {
        input,
        output,
      },
      vendor: "@apollo/graphql-standard-schema",
      version: 1 as const,
    },
  };
}
function formatError(
  error: GraphQLError | GraphQLFormattedError
): StandardSchemaV1.Issue {
  let formatted = error instanceof GraphQLError ? error.toJSON() : error;
  return formatted.path
    ? {
        message: formatted.message,
        path: formatted.path,
      }
    : {
        message: formatted.message,
      };
}
