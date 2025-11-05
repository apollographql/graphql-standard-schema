import {
  buildASTSchema,
  type DocumentNode,
  execute,
  type FormattedExecutionResult,
  type FragmentDefinitionNode,
  getVariableValues,
  GraphQLError,
  type GraphQLFormattedError,
  GraphQLScalarType,
  GraphQLSchema,
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
  getFragmentDataRootObjectType,
  parseData as parseDataSelection,
  parseFragment,
} from "./parseData.ts";

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

  export type BidirectionalValidationSchema<
    Deserialized,
    Scalars extends GraphQLStandardSchemaGenerator.ScalarDefinitions,
  > = GraphQLStandardSchemaGenerator.ValidationSchema<
    GraphQLStandardSchemaGenerator.Serialized<Deserialized, Scalars>,
    GraphQLStandardSchemaGenerator.Serialized<Deserialized, Scalars>
  > & {
    normalize: GraphQLStandardSchemaGenerator.ValidationSchema<
      GraphQLStandardSchemaGenerator.Serialized<Deserialized, Scalars>,
      GraphQLStandardSchemaGenerator.Serialized<Deserialized, Scalars>
    >;
    deserialize: GraphQLStandardSchemaGenerator.ValidationSchema<
      GraphQLStandardSchemaGenerator.Serialized<Deserialized, Scalars>,
      GraphQLStandardSchemaGenerator.Deserialized<Deserialized, Scalars>
    >;
    serialize: GraphQLStandardSchemaGenerator.ValidationSchema<
      GraphQLStandardSchemaGenerator.Deserialized<Deserialized, Scalars>,
      GraphQLStandardSchemaGenerator.Serialized<Deserialized, Scalars>
    >;
  };
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

  getDataSchema<TData, TVariables extends Record<string, unknown>>(
    document: TypedDocumentNode<TData, TVariables>,
    variables?: TVariables
  ): GraphQLStandardSchemaGenerator.BidirectionalValidationSchema<
    TData,
    Scalars
  > {
    const schema = this.schema;
    const scalarTypes = this.scalarTypes;
    document = this.documentTransfoms.reduce(
      (doc, transform) => transform(doc),
      document
    );
    const operation = getOperation(document);
    const variableValues =
      variables ||
      (fakeVariables(
        operation.variableDefinitions || [],
        schema,
        scalarTypes
      ) as TVariables);

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

    return bidirectionalValidationSchema<TData, Scalars>({
      normalize: (data) =>
        parseDataSelection(
          data,
          operation,
          schema,
          document,
          variableValues,
          "parse"
        ),
      deserialize: (data) =>
        parseDataSelection(
          data,
          operation,
          schema,
          document,
          variableValues,
          "deserialize"
        ),
      serialize: (data) =>
        serializeWithSchema(data, schema, document, variableValues),
      buildSchema,
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
      nullable(this.getDataSchema(document).normalize),
      false
    );
    return validationSchema(
      function validate(value: unknown) {
        const result = composed["~standard"].validate(value);
        assert(!("then" in result), "Async validation not supported here");
        return result;
      },
      composed["~standard"].jsonSchema
        .input as GraphQLStandardSchemaGenerator.JSONSchemaCreator,
      composed["~standard"].jsonSchema
        .output as GraphQLStandardSchemaGenerator.JSONSchemaCreator
    );
  }

  getFragmentSchema<TData, TVariables extends Record<string, unknown>>(
    document: TypedDocumentNode<TData>,
    {
      fragmentName,
      variables,
    }: {
      fragmentName?: string;
      variables?: TVariables;
    } = {}
  ): GraphQLStandardSchemaGenerator.BidirectionalValidationSchema<
    TData,
    Scalars
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
    const schema = this.schema;
    const variableValues =
      variables ||
      // TODO: also find all stray referenced variables throughout the document and try to infer their types
      fakeVariables(
        fragment.variableDefinitions || [],
        schema,
        this.scalarTypes
      );

    const buildSchema: (
      direction: "serialized" | "deserialized"
    ) => GraphQLStandardSchemaGenerator.JSONSchemaCreator =
      (direction) => (options) => {
        return {
          ...schemaBase(options),
          ...buildFragmentSchema(
            schema,
            document,
            fragment,
            this[`${direction}ScalarTypes`],
            { ...this.defaultJSONSchemaOptions, ...options }
          ),
        };
      };

    function serialize(
      data: any
    ): StandardSchemaV1.Result<
      GraphQLStandardSchemaGenerator.Serialized<TData, Scalars>
    > {
      try {
        const config = schema.toConfig();
        const fragmentSchema = new GraphQLSchema({
          ...config,
          query: getFragmentDataRootObjectType(data, schema),
        });
        return serializeWithSchema(
          data,
          fragmentSchema,
          document,
          variableValues
        );
      } catch (e) {
        return {
          issues: [
            {
              message: (e as Error).message,
            },
          ],
        };
      }
    }

    return bidirectionalValidationSchema<TData, Scalars>({
      normalize: (value) =>
        parseFragment(
          value,
          fragment,
          schema,
          document,
          variableValues,
          "parse"
        ),
      deserialize: (value) =>
        parseFragment(
          value,
          fragment,
          schema,
          document,
          variableValues,
          "deserialize"
        ),
      serialize,
      buildSchema,
    });
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

function bidirectionalValidationSchema<
  Deserialized,
  Scalars extends GraphQLStandardSchemaGenerator.ScalarDefinitions = Record<
    string,
    never
  >,
>({
  normalize,
  deserialize,
  serialize,
  buildSchema,
}: {
  normalize: (
    value: unknown
  ) => StandardSchemaV1.Result<
    GraphQLStandardSchemaGenerator.Serialized<Deserialized, Scalars>
  >;
  deserialize: (value: unknown) => StandardSchemaV1.Result<Deserialized>;
  serialize: (
    value: unknown
  ) => StandardSchemaV1.Result<
    GraphQLStandardSchemaGenerator.Serialized<Deserialized, Scalars>
  >;
  buildSchema: (
    direction: "serialized" | "deserialized"
  ) => GraphQLStandardSchemaGenerator.JSONSchemaCreator;
}): GraphQLStandardSchemaGenerator.BidirectionalValidationSchema<
  Deserialized,
  Scalars
> {
  type Serialized = GraphQLStandardSchemaGenerator.Serialized<
    Deserialized,
    Scalars
  >;
  const base = validationSchema<Serialized, Serialized>(
    normalize,
    buildSchema("serialized"),
    buildSchema("serialized")
  );

  return Object.assign(base, {
    normalize: base,
    deserialize: validationSchema<Serialized, Deserialized>(
      deserialize,
      buildSchema("serialized"),
      buildSchema("deserialized")
    ),
    serialize: validationSchema<Deserialized, Serialized>(
      serialize,
      buildSchema("deserialized"),
      buildSchema("serialized")
    ),
  });
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

function serializeWithSchema<
  TData,
  TVariables extends Record<string, unknown>,
  Scalars extends GraphQLStandardSchemaGenerator.ScalarDefinitions,
>(
  data: unknown,
  schema: GraphQLSchema,
  document: TypedDocumentNode<TData, TVariables>,
  variableValues: TVariables
): StandardSchemaV1.Result<
  GraphQLStandardSchemaGenerator.Serialized<TData, Scalars>
> {
  const result = execute({
    schema,
    document,
    variableValues,
    fieldResolver: (source, args, context, info) => {
      return source[info.fieldName];
    },
    rootValue: data,
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
