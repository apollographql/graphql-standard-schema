import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import {
  buildASTSchema,
  type DocumentNode,
  type FragmentDefinitionNode,
  type GraphQLFormattedError,
  GraphQLScalarType,
  GraphQLSchema,
} from "graphql";
import { buildFragmentSchema } from "./schema/buildFragmentSchema.ts";
import { buildOperationSchema } from "./schema/buildOperationSchema.ts";
import { buildVariablesSchema } from "./schema/buildVariablesSchema.ts";
import { responseShapeSchema } from "./schema/responseShapeSchema.ts";
import { schemaBase } from "./schema/schemaBase.ts";
import {
  standardJSONSchemaRootKey,
  type StandardJSONSchemaV1,
} from "./standard-schema-spec.ts";
import type { StandardSchemaV1 } from "@standard-schema/spec";
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
import { getOperation } from "./utils/getOperation.ts";
import type { OpenAiSupportedJsonSchema } from "./utils/openAiSupportedJsonSchema.ts";
import {
  parseData as parseDataSelection,
  parseFragment,
} from "./utils/parseData.ts";
import { parseVariables } from "./utils/parseVariables.ts";

export declare namespace GraphQLStandardSchemaGenerator {
  export namespace Internal {
    export type ScalarMapping = Record<
      string,
      OpenAiSupportedJsonSchema.Anything
    >;
  }
  export interface ScalarExtension {
    deserializedJsonSchema: OpenAiSupportedJsonSchema.Anything;
    serializedJsonSchema: OpenAiSupportedJsonSchema.Anything;
    /** Will be used as "fake variable value" if this scalar is ever used in a non-nullable variable input value. */
    defaultValue?: any;
  }

  export interface ScalarDefinition<Serialized, Deserialized>
    extends GraphQLScalarType<Deserialized, Serialized> {}

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
    // oxlint-disable-next-line no-unused-vars
    Scalars extends GraphQLStandardSchemaGenerator.ScalarDefinitions = Record<
      string,
      never
    >,
  > = TData;

  export type JSONSchemaCreator = (
    params: StandardJSONSchemaV1.Options & JSONSchemaOptions
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
     *
     * When `defaultJSONSchemaOptions` is set to "OpenAI", this will be false.
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

    // override pre-existing scalar types with scalars passed in via the `scalarTypes` option
    this.schema = "getTypeMap" in schema ? schema : buildASTSchema(schema);
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
            this.scalarTypes,
            direction,
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
          scalarTypes,
          document,
          variableValues,
          "normalize"
        ),
      deserialize: (data) =>
        parseDataSelection(
          data,
          operation,
          schema,
          scalarTypes,
          document,
          variableValues,
          "deserialize"
        ),
      serialize: (data) =>
        parseDataSelection(
          data,
          operation,
          schema,
          scalarTypes,
          document,
          variableValues,
          "serialize"
        ),
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
          ? composedSerialize[standardJSONSchemaRootKey].jsonSchema.output
          : composedSerialize[standardJSONSchemaRootKey].jsonSchema.input,
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
    const scalarTypes = this.scalarTypes;
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
            this.scalarTypes,
            direction,
            { ...this.defaultJSONSchemaOptions, ...options }
          ),
        };
      };

    return bidirectionalValidationSchema<TData, Scalars>({
      normalize: (value) =>
        parseFragment(
          value,
          fragment,
          schema,
          scalarTypes,
          document,
          variableValues,
          "normalize"
        ),
      deserialize: (value) =>
        parseFragment(
          value,
          fragment,
          schema,
          scalarTypes,
          document,
          variableValues,
          "deserialize"
        ),
      serialize: (value) =>
        parseFragment(
          value,
          fragment,
          schema,
          scalarTypes,
          document,
          variableValues,
          "serialize"
        ),
      buildSchema,
    });
  }

  getVariablesSchema<TVariables extends Record<string, unknown>>(
    document: TypedDocumentNode<any, TVariables>
  ): GraphQLStandardSchemaGenerator.BidirectionalValidationSchema<
    TVariables,
    Scalars
  > {
    const schema = this.schema;
    const scalarTypes = this.scalarTypes;
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
            operation,
            this.scalarTypes,
            direction,
            { ...this.defaultJSONSchemaOptions, ...options }
          ),
        };
      };

    return bidirectionalValidationSchema<TVariables, Scalars>({
      normalize: (variables) =>
        parseVariables<TVariables, Scalars, "normalize">(
          variables,
          operation,
          schema,
          scalarTypes,
          "normalize"
        ),
      deserialize: (variables) =>
        parseVariables<TVariables, Scalars, "deserialize">(
          variables,
          operation,
          schema,
          scalarTypes,
          "deserialize"
        ),
      serialize: (variables) =>
        parseVariables<TVariables, Scalars, "serialize">(
          variables,
          operation,
          schema,
          scalarTypes,
          "serialize"
        ),
      buildSchema,
    });
  }
}
