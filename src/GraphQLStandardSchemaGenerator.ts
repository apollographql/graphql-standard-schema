import { MapperKind, mapSchema } from "@graphql-tools/utils";
import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import {
  buildASTSchema,
  type DocumentNode,
  type FragmentDefinitionNode,
  getVariableValues,
  type GraphQLFormattedError,
  GraphQLScalarType,
  GraphQLSchema,
  Kind,
  type OperationDefinitionNode,
  OperationTypeNode,
} from "graphql";
import { buildFragmentSchema } from "./schema/buildFragmentSchema.ts";
import { buildOperationSchema } from "./schema/buildOperationSchema.ts";
import { buildVariablesSchema } from "./schema/buildVariablesSchema.ts";
import { responseShapeSchema } from "./schema/responseShapeSchema.ts";
import { schemaBase } from "./schema/schemaBase.ts";
import type {
  StandardJSONSchemaV1,
  StandardSchemaV1,
} from "./standard-schema-spec.ts";
import { addTypename } from "./transforms/addTypename.ts";
import type {
  CalculateSerializedType,
  CombinedSpec,
  ScalarMapping,
} from "./types.ts";
import { assert } from "./utils/assert.ts";
import { bidirectionalValidationSchema } from "./utils/bidirectionalValidationSchema.ts";
import {
  composeStandardSchemas,
  nullable,
} from "./utils/composeStandardSchemas.ts";
import { fakeVariables } from "./utils/fakeVariables.ts";
import { formatError } from "./utils/formatError.ts";
import { getOperation } from "./utils/getOperation.ts";
import type { OpenAiSupportedJsonSchema } from "./utils/openAiSupportedJsonSchema.ts";
import {
  getFragmentDataRootObjectType,
  parseData as parseDataSelection,
  parseFragment,
} from "./utils/parseData.ts";
import { serializeWithSchema } from "./utils/serializeWithSchema.ts";
import { validationSchema } from "./utils/validationSchema.ts";

export declare namespace GraphQLStandardSchemaGenerator {
  export namespace Internal {
    export type ScalarMapping = Record<
      string,
      OpenAiSupportedJsonSchema.Anything
    >;
  }

  export interface ScalarDefinition<Serialized, Deserialized> {
    type: GraphQLScalarType<Deserialized, Serialized>;
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
    /**
     * An array of document transforms to apply to each document before generating schemas.
     *
     * This can be used to apply custom transformations to the GraphQL documents,
     * such as adding default fields, removing deprecated fields, etc.
     *
     * Defaults to `[addTypename]` if not provided.
     */
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
  ) => Record<string, unknown>;

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
  ): GraphQLStandardSchemaGenerator.BidirectionalValidationSchema<
    {
      errors?: ReadonlyArray<GraphQLFormattedError> | null;
      data?: TData | null;
      extensions?: Record<string, unknown> | null;
    },
    Scalars
  > {
    const dataSchema = this.getDataSchema(document);
    const rootSchema = responseShapeSchema(getOperation(document));
    const composedNormalize = composeStandardSchemas(
      rootSchema,
      ["data"] as const,
      nullable(dataSchema.normalize),
      false,
      false
    );
    const composedDeserialize = composeStandardSchemas(
      rootSchema,
      ["data"] as const,
      nullable(dataSchema.deserialize),
      false,
      false
    );
    const composedSerialize = composeStandardSchemas(
      rootSchema,
      ["data"] as const,
      nullable(dataSchema.serialize),
      false,
      false
    );

    function forceSync<Args extends any[], T extends {}>(
      fn: (...args: Args) => T | Promise<T>
    ): (...args: Args) => T {
      return (...args: Args) => {
        const result = fn(...args);
        assert(!("then" in result), "Async validation not supported here");
        return result;
      };
    }
    const normalize = forceSync(composedNormalize["~standard"].validate);
    const deserialize = forceSync(composedDeserialize["~standard"].validate);
    const serialize = forceSync(composedSerialize["~standard"].validate);

    return bidirectionalValidationSchema<
      {
        errors?: ReadonlyArray<GraphQLFormattedError> | null;
        data?: TData | null;
        extensions?: Record<string, unknown> | null;
      },
      Scalars
    >({
      // computation doesn't work out as `Scalars` is not known inside this function
      normalize: normalize as any,
      deserialize,
      // computation doesn't work out as `Scalars` is not known inside this function
      serialize: serialize as any,
      buildSchema: (direction) =>
        direction === "serialized"
          ? composedSerialize["~standard"].jsonSchema.output
          : composedSerialize["~standard"].jsonSchema.input,
    });
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
      (fakeVariables(
        fragment.variableDefinitions || [],
        schema,
        this.scalarTypes
      ) as TVariables);

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
        const queryDocument: TypedDocumentNode<TData, TVariables> = {
          ...document,
          definitions: [
            {
              kind: Kind.OPERATION_DEFINITION,
              operation: OperationTypeNode.QUERY,
              selectionSet: {
                kind: Kind.SELECTION_SET,
                selections: [
                  {
                    kind: Kind.FRAGMENT_SPREAD,
                    name: {
                      kind: Kind.NAME,
                      value: fragment!.name.value,
                    },
                  },
                ],
              },
            } satisfies OperationDefinitionNode,
            ...document.definitions.filter(
              (d) => d.kind === Kind.FRAGMENT_DEFINITION
            ),
          ],
        };
        return serializeWithSchema(
          data,
          fragmentSchema,
          queryDocument,
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
