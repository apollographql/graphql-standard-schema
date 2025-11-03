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
  CalculateInputType,
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
      input: OpenAiSupportedJsonSchema.Anything;
      output: OpenAiSupportedJsonSchema.Anything;
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

  export type InputType<
    TData,
    Scalars extends GraphQLStandardSchemaGenerator.ScalarDefinitions = Record<
      string,
      never
    >,
  > = CalculateInputType<TData, ScalarMapping<Scalars>>;

  export type OutputType<
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

  export interface ValidationSchema<Input, Output>
    extends CombinedSpec<Input, Output> {
    ["~standard"]: StandardSchemaV1.Props<Input, Output> & {
      jsonSchema: {
        input: JSONSchemaCreator;
        output: JSONSchemaCreator;
      };
    };
    // TODO
    // isValid(value: unknown): value is T;
    // isStrictlyValid(value: unknown): value is T;
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
  private inputScalarTypes: GraphQLStandardSchemaGenerator.Internal.ScalarMapping;
  private outputScalarTypes: GraphQLStandardSchemaGenerator.Internal.ScalarMapping;
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
    this.inputScalarTypes = Object.fromEntries(
      Object.entries(scalarTypes).map(([key, def]) => [
        key,
        def.jsonSchema.input,
      ])
    );
    this.outputScalarTypes = Object.fromEntries(
      Object.entries(scalarTypes).map(([key, def]) => [
        key,
        def.jsonSchema.output,
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
    GraphQLStandardSchemaGenerator.OutputType<TData, Scalars>,
    GraphQLStandardSchemaGenerator.InputType<TData, Scalars>
  > {
    const schema = this.schema;
    const scalarTypes = this.scalarTypes;
    document = this.documentTransfoms.reduce(
      (doc, transform) => transform(doc),
      document
    );
    const definition = getOperation(document);
    return standardSchema({
      jsonSchema: (direction) => (options) => {
        return {
          ...schemaBase(options),
          ...buildOperationSchema(
            schema,
            document,
            definition,
            this[`${direction}ScalarTypes`],
            { ...this.defaultJSONSchemaOptions, ...options }
          ),
        };
      },
      validate(
        value: any
      ): StandardSchemaV1.Result<
        GraphQLStandardSchemaGenerator.InputType<TData, Scalars>
      > {
        const variableValues = fakeVariables(
          getOperation(document).variableDefinitions || [],
          schema,
          scalarTypes
        );
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
          value: result.data as GraphQLStandardSchemaGenerator.InputType<
            TData,
            Scalars
          >,
        };
      },
    });
  }

  getResponseSchema<TData>(
    document: TypedDocumentNode<TData>
  ): GraphQLStandardSchemaGenerator.ValidationSchema<
    {
      errors?: ReadonlyArray<GraphQLFormattedError> | null;
      data?: GraphQLStandardSchemaGenerator.InputType<TData, Scalars> | null;
      extensions?: Record<string, unknown> | null;
    },
    {
      errors?: ReadonlyArray<GraphQLFormattedError> | null;
      data?: GraphQLStandardSchemaGenerator.OutputType<TData, Scalars> | null;
      extensions?: Record<string, unknown> | null;
    }
  > {
    const definitions = document.definitions.filter(
      (def): def is OperationDefinitionNode =>
        def.kind === "OperationDefinition" && !!def.name
    );
    assert(
      definitions.length == 1,
      "Document must contain exactly one named operation"
    );

    const responseShape = responseShapeSchema(definitions[0]!);

    const composed = composeStandardSchemas(
      responseShape,
      ["data"] as const,
      nullable(this.getDataSchema<TData>(document))
    );

    return composed satisfies CombinedSpec<
      {
        data: GraphQLStandardSchemaGenerator.InputType<TData, Scalars> | null;
        errors?: readonly GraphQLFormattedError[] | undefined;
        extensions?: Record<string, unknown> | undefined;
      },
      {
        data: GraphQLStandardSchemaGenerator.OutputType<TData, Scalars> | null;
        errors?: readonly GraphQLFormattedError[] | undefined;
        extensions?: Record<string, unknown> | undefined;
      }
    > as GraphQLStandardSchemaGenerator.ValidationSchema<
      FormattedExecutionResult<
        GraphQLStandardSchemaGenerator.InputType<TData, Scalars>
      >,
      FormattedExecutionResult<
        GraphQLStandardSchemaGenerator.OutputType<TData, Scalars>
      >
    >;
  }

  getFragmentSchema<TData>(
    document: TypedDocumentNode<TData>,
    {
      fragmentName,
    }: {
      fragmentName?: string;
    } = {}
  ): GraphQLStandardSchemaGenerator.ValidationSchema<
    GraphQLStandardSchemaGenerator.InputType<TData, Scalars>,
    GraphQLStandardSchemaGenerator.OutputType<TData, Scalars>
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

    const queryDocument: TypedDocumentNode<{ fragmentData: TData }> = {
      ...(document as TypedDocumentNode<any>),
      definitions: [
        ...fragments,
        {
          kind: Kind.OPERATION_DEFINITION,
          operation: OperationTypeNode.QUERY,
          name: { kind: Kind.NAME, value: "FragmentQuery" },
          selectionSet: {
            kind: Kind.SELECTION_SET,
            selections: [
              {
                kind: Kind.FIELD,
                name: { kind: Kind.NAME, value: "fragmentData" },
                selectionSet: {
                  kind: Kind.SELECTION_SET,
                  selections: [
                    {
                      kind: Kind.FRAGMENT_SPREAD,
                      name: { kind: Kind.NAME, value: fragment.name.value },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    };

    return standardSchema({
      jsonSchema: (direction) => (options) => {
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
      },
      validate: (value): StandardSchemaV1.Result<TData> => {
        const dataSchema = this.getDataSchema(queryDocument);
        const result = dataSchema["~standard"].validate({
          fragmentData: value,
        });
        // our own `dataSchema` won't return an async validator
        assert(!("then" in result));
        if ("value" in result) {
          return { value: result.value.fragmentData };
        }
        return {
          issues: result.issues?.map((issue) =>
            "path" in issue
              ? {
                  ...issue,
                  path: issue.path?.slice(1),
                }
              : issue
          ),
        };
      },
    });
  }

  getVariablesSchema<TVariables>(
    document: TypedDocumentNode<any, TVariables>
  ): GraphQLStandardSchemaGenerator.ValidationSchema<
    GraphQLStandardSchemaGenerator.InputType<TVariables, Scalars>,
    GraphQLStandardSchemaGenerator.OutputType<TVariables, Scalars>
  > {
    const schema = this.schema;
    document = this.documentTransfoms.reduce(
      (doc, transform) => transform(doc),
      document
    );
    const operation = getOperation(document);
    return standardSchema({
      jsonSchema: (direction) => (options) => {
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
      },
      validate(variables): StandardSchemaV1.Result<TVariables> {
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
      },
    });
  }
}

function getOperation(document: DocumentNode): OperationDefinitionNode {
  const operations = document.definitions.filter(
    (def): def is OperationDefinitionNode => def.kind === "OperationDefinition"
  );
  assert(operations.length > 0, "No operation definitions found in document");
  assert(
    operations.length == 1,
    "Multiple operation definitions found in document"
  );
  return operations[0]!;
}

export function standardSchema<Input, Output>({
  jsonSchema,
  validate,
}: {
  validate: GraphQLStandardSchemaGenerator.ValidationSchema<
    Input,
    Output
  >["~standard"]["validate"];
  jsonSchema: (
    direction: "input" | "output"
  ) => GraphQLStandardSchemaGenerator.JSONSchemaCreator;
}): GraphQLStandardSchemaGenerator.ValidationSchema<Input, Output> {
  return {
    "~standard": {
      validate,
      jsonSchema: {
        input: jsonSchema("input"),
        output: jsonSchema("output"),
      },
      vendor: "@apollo/graphql-standard-schema",
      version: 1,
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
