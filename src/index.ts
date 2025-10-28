import {
  buildASTSchema,
  type DocumentNode,
  execute,
  type FormattedExecutionResult,
  type FragmentDefinitionNode,
  GraphQLBoolean,
  GraphQLFloat,
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

export interface CombinedProps<Input = unknown, Output = Input>
  extends StandardSchemaV1.Props<Input, Output>,
    StandardJSONSchemaV1.Props<Input, Output> {}

/**
 * An interface that combines StandardJSONSchema and StandardSchema.
 * */
export interface CombinedSpec<Input = unknown, Output = Input> {
  "~standard": CombinedProps<Input, Output>;
}

type JSONSchemaFn = (
  params?: StandardJSONSchemaV1.Options
) => OpenAiSupportedJsonSchema;

export namespace GraphQLStandardSchemaGenerator {
  export interface Options {
    schema: GraphQLSchema | DocumentNode;
    scalarTypes?: Record<string, OpenAiSupportedJsonSchema.Anything>;
  }

  export type JSONSchema = OpenAiSupportedJsonSchema;

  export interface ValidationSchema<T> extends CombinedSpec<T, T> {
    ["~standard"]: StandardSchemaV1.Props<T, T> & {
      jsonSchema: {
        input: JSONSchemaFn;
        output: JSONSchemaFn;
      };
    };
  }
}
export class GraphQLStandardSchemaGenerator {
  private schema!: GraphQLSchema;
  private scalarTypes?: GraphQLStandardSchemaGenerator.Options["scalarTypes"];
  constructor({ schema, scalarTypes }: GraphQLStandardSchemaGenerator.Options) {
    this.replaceSchema(schema);
    this.scalarTypes = scalarTypes;
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
    const definitions = document.definitions.filter(
      (def): def is OperationDefinitionNode =>
        def.kind === "OperationDefinition" && !!def.name
    );
    if (definitions.length !== 1) {
      throw new Error("Document must contain exactly one named operation");
    }
    const definition = definitions[0]!;
    const jsonSchema: JSONSchemaFn = (options) => {
      return {
        ...schemaBase(options),
        ...buildOperationSchema(schema, document, definition, this.scalarTypes),
      };
    };

    return standardSchema({
      jsonSchema: { input: jsonSchema, output: jsonSchema },
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
  ): GraphQLStandardSchemaGenerator.ValidationSchema<FormattedExecutionResult> {
    const dataSchema = this.getDataSchema(document);
    const definitions = document.definitions.filter(
      (def): def is OperationDefinitionNode =>
        def.kind === "OperationDefinition" && !!def.name
    );
    if (definitions.length !== 1) {
      throw new Error("Document must contain exactly one named operation");
    }
    const definition = definitions[0]!;

    const jsonSchema: JSONSchemaFn = (options): OpenAiSupportedJsonSchema => {
      const { $defs, ...dataJSONSchema }: OpenAiSupportedJsonSchema =
        dataSchema["~standard"].jsonSchema.input(options);

      return {
        ...schemaBase(options),
        title: `Full response for ${definition.operation} ${
          definition.name?.value || "Anonymous"
        }`,
        type: "object",
        properties: {
          data: dataJSONSchema,
          errors: {
            anyOf: [
              { type: "null" },
              {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    locations: {
                      anyOf: [
                        { type: "null" },
                        {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              line: { type: "number" },
                              column: { type: "number" },
                            },
                            required: ["line", "column"],
                            additionalProperties: false,
                          },
                        },
                      ],
                    },
                    path: {
                      anyOf: [
                        {
                          type: "array",
                          items: {
                            anyOf: [{ type: "string" }, { type: "number" }],
                          },
                        },
                      ],
                    },
                    // any-type object not supported by OpenAI
                    // extensions: { type: "object" },
                  },
                  additionalProperties: false,
                  required: ["message", "locations", "path", "extensions"],
                },
              },
            ],
          },
          // any-type object not supported by OpenAI
          // extensions: { type: "object" },
        },
        required: ["data", "errors"],
        additionalProperties: false as const,
        ...($defs ? { $defs } : {}),
        // not supported by OpenAI
        // oneOf: [{ required: "data" }, { required: "errors" }],
      };
    };

    return standardSchema({
      jsonSchema: {
        input: jsonSchema,
        output: jsonSchema,
      },
      validate(value) {
        throw new Error("Not implemented");
      },
    });
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
    const queryDocument: TypedDocumentNode<TData> = {
      ...document,
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
                kind: Kind.FRAGMENT_SPREAD,
                name: { kind: Kind.NAME, value: fragment.name.value },
              },
            ],
          },
        },
      ],
    };

    const jsonSchema: JSONSchemaFn = (options) => {
      return {
        ...schemaBase(options),
        ...buildFragmentSchema(
          this.schema,
          document,
          fragment,
          this.scalarTypes
        ),
      };
    };

    return standardSchema({
      jsonSchema: {
        input: jsonSchema,
        output: jsonSchema,
      },
      validate(value): StandardSchemaV1.Result<TData> {
        // const dataSchema = this.getDataSchema<TData>(queryDocument);
        throw new Error("TODO");
      },
    });
  }

  getVariablesSchema<TVariables>(
    document: TypedDocumentNode<any, TVariables>
  ): GraphQLStandardSchemaGenerator.ValidationSchema<TVariables> {
    return {
      ["~standard"]: {
        types: {
          input: {} as TVariables,
          output: {} as TVariables,
        },
        jsonSchema: {
          input: () => {
            throw new Error("Not implemented");
          },
          output: () => {
            throw new Error("Not implemented");
          },
        },
        validate(value) {
          throw new Error("Not implemented");
        },
        vendor: "@apollo/graphql-standard-schema",
        version: 1,
      },
    };
  }
}

function schemaBase(params: StandardJSONSchemaV1.Options = {}) {
  const schema: Record<string, unknown> = {};
  if (params?.target === "draft-2020-12" || params?.target === undefined) {
    schema.$schema = "https://json-schema.org/draft/2020-12/schema";
  } else if (params?.target === "draft-07") {
    schema.$schema = "http://json-schema.org/draft-07/schema#";
  } else {
    throw new Error("Only draft-07 and draft-2020-12 are supported");
  }
  return schema;
}

function buildFragmentSchema(
  schema: GraphQLSchema,
  document: DocumentNode,
  fragment: FragmentDefinitionNode,
  scalarTypes?: GraphQLStandardSchemaGenerator.Options["scalarTypes"]
): OpenAiSupportedJsonSchema {
  const parentType = schema.getType(fragment.typeCondition.name.value);
  let dataSchema: OpenAiSupportedJsonSchema;
  if (isObjectType(parentType)) {
    dataSchema = buildOutputSchema(
      schema,
      document,
      scalarTypes,
      parentType,
      fragment.selectionSet
    );
  } else if (isAbstractType(parentType)) {
    //https://platform.openai.com/docs/guides/structured-outputs?type-restrictions=number-restrictions#root-objects-must-not-be-anyof-and-must-be-an-object
    throw new Error("not supported by OpenAI");
    // const possibleTypes = schema.getPossibleTypes(parentType);
    // dataSchema = {
    //   anyOf: possibleTypes.map((type) =>
    //     buildOutputSchema(
    //       schema,
    //       document,
    //       scalarTypes,
    //       type,
    //       fragment.selectionSet
    //     )
    //   ),
    // };
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

function buildOperationSchema(
  schema: GraphQLSchema,
  document: DocumentNode,
  operation: OperationDefinitionNode,
  scalarTypes?: GraphQLStandardSchemaGenerator.Options["scalarTypes"]
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

      operation.selectionSet
    ),
    title: `${operation.operation} ${operation.name?.value || "Anonymous"}`,
  };
}

function buildVariablesSchema(
  schema: GraphQLSchema,
  operation: OperationDefinitionNode,
  scalarTypes?: GraphQLStandardSchemaGenerator.Options["scalarTypes"]
): OpenAiSupportedJsonSchema {
  throw new Error("Not implemented");
}

function standardSchema<T>({
  jsonSchema,
  validate,
}: Pick<
  GraphQLStandardSchemaGenerator.ValidationSchema<T>["~standard"],
  "validate" | "jsonSchema"
>): GraphQLStandardSchemaGenerator.ValidationSchema<T> {
  return {
    "~standard": {
      validate,
      jsonSchema,
      vendor: "@apollo/graphql-standard-schema",
      version: 1,
    },
  };
}
