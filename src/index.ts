import {
  buildASTSchema,
  type DocumentNode,
  execute,
  type FormattedExecutionResult,
  type FragmentDefinitionNode,
  getVariableValues,
  GraphQLBoolean,
  GraphQLFloat,
  type GraphQLFormattedError,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLString,
  isAbstractType,
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
import { buildOutputSchema } from "./buildOutputSchema.ts";
import type { OpenAiSupportedJsonSchema } from "./openAiSupportedJsonSchema.ts";
import type { CombinedSpec } from "./types.ts";
import { composeStandardSchemas } from "./composeStandardSchemas.ts";
import { responseShapeSchema } from "./responseShapeSchema.ts";
import { schemaBase } from "./schemaBase.ts";
import { assert } from "./assert.ts";
import { buildInputSchema } from "./buildInputSchema.ts";

export namespace GraphQLStandardSchemaGenerator {
  export interface Options {
    schema: GraphQLSchema | DocumentNode;
    scalarTypes?: Record<string, OpenAiSupportedJsonSchema.Anything>;
    defaultJSONSchemaOptions?: JSONSchemaOptions | "OpenAI";
  }

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
    /**
     * If true, the `__typename` field will be added to all object types.
     *
     * {@defaultValue true}
     */
    addTypename?: boolean;
  }

  export type JSONSchema = OpenAiSupportedJsonSchema;

  export interface ValidationSchema<T> extends CombinedSpec<T, T> {
    ["~standard"]: StandardSchemaV1.Props<T, T> & {
      jsonSchema: {
        input: JSONSchemaCreator;
        output: JSONSchemaCreator;
      };
    };
  }
}
export class GraphQLStandardSchemaGenerator {
  private schema!: GraphQLSchema;
  private scalarTypes?: GraphQLStandardSchemaGenerator.Options["scalarTypes"];
  private defaultJSONSchemaOptions: GraphQLStandardSchemaGenerator.JSONSchemaOptions;
  constructor({
    schema,
    scalarTypes,
    defaultJSONSchemaOptions,
  }: GraphQLStandardSchemaGenerator.Options) {
    this.replaceSchema(schema);
    this.scalarTypes = scalarTypes;
    this.defaultJSONSchemaOptions =
      defaultJSONSchemaOptions === "OpenAI"
        ? {
            additionalProperties: false,
            optionalNullableProperties: false,
            addTypename: true,
          }
        : {
            optionalNullableProperties: true,
            addTypename: true,
            ...defaultJSONSchemaOptions,
          };
  }

  replaceSchema(schema: GraphQLSchema | DocumentNode) {
    if ("getTypeMap" in schema) {
      this.schema = schema;
    } else if ("kind" in schema) {
      this.schema = buildASTSchema(schema);
    } else {
      throw new Error(
        "Schema needs to be of type GraphQLSchema or DocumentNode"
      );
    }
  }

  getDataSchema<TData>(
    document: TypedDocumentNode<TData>
  ): GraphQLStandardSchemaGenerator.ValidationSchema<TData> {
    const schema = this.schema;
    const definition = getOperation(document);
    return standardSchema({
      jsonSchema: (options) => {
        return {
          ...schemaBase(options),
          ...buildOperationSchema(
            schema,
            document,
            definition,
            this.scalarTypes,
            { ...this.defaultJSONSchemaOptions, ...options }
          ),
        };
      },
      validate(value): StandardSchemaV1.Result<TData> {
        const result = execute({
          schema,
          document,
          // TODO: do we need to fake variables here?
          // variableValues: operation.variables,
          fieldResolver: (source, args, context, info) => {
            const value = source[info.fieldName];

            // We use field resolvers to be more strict with the value types that
            // were returned by the AI.
            let returnType = info.returnType;
            let isNonNull = false;

            // Check if it's a non-null type
            if (returnType instanceof GraphQLNonNull) {
              isNonNull = true;
              returnType = returnType.ofType;
            }

            // Handle null values
            if (value === null) {
              if (isNonNull) {
                throw new TypeError(
                  `Non-nullable field ${info.fieldName} cannot be null`
                );
              }
              return null; // Null is valid for nullable fields
            }

            // Validate scalar types
            if (returnType instanceof GraphQLScalarType) {
              switch (returnType.name) {
                case GraphQLString.name:
                  if (typeof value !== "string") {
                    throw new TypeError(
                      `Value for scalar type ${returnType.name} is not string: ${value}`
                    );
                  }
                  break;
                case GraphQLFloat.name:
                  if (typeof value !== "number") {
                    throw new TypeError(
                      `Value for scalar type ${returnType.name} is not number: ${value}`
                    );
                  }
                  break;
                case GraphQLInt.name:
                  if (typeof value !== "number") {
                    throw new TypeError(
                      `Value for scalar type ${returnType.name} is not number: ${value}`
                    );
                  }
                  break;
                case GraphQLBoolean.name:
                  if (typeof value !== "boolean") {
                    throw new TypeError(
                      `Value for scalar type ${returnType.name} is not boolean: ${value}`
                    );
                  }
                  break;
              }
            }

            return value;
          },
          rootValue: value,
        }) as FormattedExecutionResult;

        if (result.errors?.length) {
          return {
            issues: result.errors,
          };
        }
        return { value: result.data as TData };
      },
    });
  }

  getResponseSchema<TData>(
    document: TypedDocumentNode<TData>
  ): GraphQLStandardSchemaGenerator.ValidationSchema<{
    errors?: ReadonlyArray<GraphQLFormattedError> | null;
    data?: TData | null;
    extensions?: Record<string, unknown> | null;
  }> {
    const definitions = document.definitions.filter(
      (def): def is OperationDefinitionNode =>
        def.kind === "OperationDefinition" && !!def.name
    );
    if (definitions.length !== 1) {
      throw new Error("Document must contain exactly one named operation");
    }
    const definition = definitions[0]!;

    const composed = composeStandardSchemas(
      responseShapeSchema(definition),
      ["data"] as const,
      this.getDataSchema(document),
      true
    );
    const ret = composed["~standard"].validate({} as any);
    if ("value" in ret) {
      ret.value;
    }

    return composed satisfies CombinedSpec<{
      data: TData | null;
      errors: ReadonlyArray<GraphQLFormattedError> | undefined;
      extensions: Record<string, unknown> | undefined;
    }> as GraphQLStandardSchemaGenerator.ValidationSchema<
      FormattedExecutionResult<TData>
    >;
  }

  getFragmentSchema<TData>(
    document: TypedDocumentNode<TData>,
    {
      fragmentName,
    }: {
      fragmentName?: string;
    } = {}
  ): GraphQLStandardSchemaGenerator.ValidationSchema<TData> {
    if (
      !document.definitions.every((def) => def.kind === "FragmentDefinition")
    ) {
      throw new Error("Document must only contain fragment definitions");
    }
    const fragments = document.definitions as FragmentDefinitionNode[];

    if (fragments.length === 0) {
      throw new Error("No fragments found in document");
    }
    if (fragments.length > 1 && !fragmentName) {
      throw new Error(
        "Multiple fragments found, please specify a fragmentName"
      );
    }
    const fragment = fragments.find((def) =>
      fragmentName ? def.name.value === fragmentName : true
    );
    if (!fragment) {
      throw new Error(
        `Fragment with name ${fragmentName} not found in document`
      );
    }
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
      jsonSchema: (options) => {
        return {
          ...schemaBase(options),
          ...buildFragmentSchema(
            this.schema,
            document,
            fragment,
            this.scalarTypes,
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
  ): GraphQLStandardSchemaGenerator.ValidationSchema<TVariables> {
    const schema = this.schema;
    const operation = getOperation(document);
    return standardSchema({
      jsonSchema: (options) => {
        return {
          ...schemaBase(options),
          ...buildVariablesSchema(
            schema,
            document,
            operation,
            this.scalarTypes,
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
          issues: result.errors?.map((error) => ({
            message: error.message,
          })),
        };
      },
    });
  }
}

function buildFragmentSchema(
  schema: GraphQLSchema,
  document: DocumentNode,
  fragment: FragmentDefinitionNode,
  scalarTypes:
    | GraphQLStandardSchemaGenerator.Options["scalarTypes"]
    | undefined,
  options: GraphQLStandardSchemaGenerator.JSONSchemaOptions
): OpenAiSupportedJsonSchema {
  const parentType = schema.getType(fragment.typeCondition.name.value);
  let dataSchema: OpenAiSupportedJsonSchema;
  if (isObjectType(parentType)) {
    dataSchema = buildOutputSchema(
      schema,
      document,
      scalarTypes,
      parentType,
      fragment.selectionSet,
      options
    );
  } else if (isAbstractType(parentType)) {
    // this is not directly allowed with OpenAI Structured Output, but other tools might benefit from it - and for OpenAI, `composeStandardSchemas` can be used to nest this schema under a property, which would then be supported
    // https://platform.openai.com/docs/guides/structured-outputs?type-restrictions=number-restrictions#root-objects-must-not-be-anyof-and-must-be-an-object
    const possibleTypes = schema.getPossibleTypes(parentType);
    const schemas = possibleTypes.map((type) =>
      buildOutputSchema(
        schema,
        document,
        scalarTypes,
        type,
        fragment.selectionSet,
        options
      )
    );
    dataSchema = {
      anyOf: schemas.map(({ $defs, ...schema }) => schema),
      $defs: schemas.reduce<NonNullable<OpenAiSupportedJsonSchema["$defs"]>>(
        (acc, schema) =>
          schema.$defs ? Object.assign(acc, schema.$defs) : acc,
        {}
      ),
    };
  } else {
    throw new Error(
      `Fragment type condition must be an object, union or interface, got: ${parentType?.name}`
    );
  }

  return {
    ...dataSchema,
    title: `fragment ${fragment.name?.value || "Anonymous"} on ${
      fragment.typeCondition.name.value
    }`,
    ...(fragment.description
      ? { description: fragment.description?.value }
      : {}),
  };
}

function getOperation(document: DocumentNode): OperationDefinitionNode {
  const operations = document.definitions.filter(
    (def): def is OperationDefinitionNode => def.kind === "OperationDefinition"
  );
  if (operations.length === 0) {
    throw new Error("No operation definitions found in document");
  }
  if (operations.length > 1) {
    throw new Error("Multiple operation definitions found in document");
  }
  return operations[0]!;
}

function buildOperationSchema(
  schema: GraphQLSchema,
  document: DocumentNode,
  operation: OperationDefinitionNode,
  scalarTypes:
    | GraphQLStandardSchemaGenerator.Options["scalarTypes"]
    | undefined,
  options: GraphQLStandardSchemaGenerator.JSONSchemaOptions
): OpenAiSupportedJsonSchema {
  return {
    ...(operation.description
      ? { description: operation.description?.value }
      : {}),
    ...buildOutputSchema(
      schema,
      document,
      scalarTypes,
      operation.operation === OperationTypeNode.QUERY
        ? schema.getQueryType()!
        : operation.operation === OperationTypeNode.SUBSCRIPTION
          ? schema.getSubscriptionType()!
          : schema.getMutationType()!,
      operation.selectionSet,
      options
    ),
    title: `${operation.operation} ${operation.name?.value || "Anonymous"}`,
  };
}

function buildVariablesSchema(
  schema: GraphQLSchema,
  document: DocumentNode,
  operation: OperationDefinitionNode,
  scalarTypes:
    | GraphQLStandardSchemaGenerator.Options["scalarTypes"]
    | undefined,
  options: GraphQLStandardSchemaGenerator.JSONSchemaOptions
): OpenAiSupportedJsonSchema {
  return {
    ...(operation.description
      ? { description: operation.description?.value }
      : {}),
    ...buildInputSchema(schema, document, scalarTypes, options),
    title: `Variables for ${operation.operation} ${operation.name?.value || "Anonymous"}`,
  };
}

export function standardSchema<T>({
  jsonSchema,
  validate,
}: {
  validate: GraphQLStandardSchemaGenerator.ValidationSchema<T>["~standard"]["validate"];
  jsonSchema: GraphQLStandardSchemaGenerator.ValidationSchema<T>["~standard"]["jsonSchema"]["input"];
}): GraphQLStandardSchemaGenerator.ValidationSchema<T> {
  return {
    "~standard": {
      validate,
      jsonSchema: {
        input: jsonSchema,
        output: jsonSchema,
      },
      vendor: "@apollo/graphql-standard-schema",
      version: 1,
    },
  };
}
