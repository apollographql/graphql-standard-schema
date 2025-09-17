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
  Kind,
  type OperationDefinitionNode,
  OperationTypeNode,
  parse,
} from "graphql";
import type { StandardSchemaV1 } from "./standard-schema-spec.ts";
import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import type { JSONSchema } from "json-schema-typed/draft-2020-12";
import { buildOutputSchema } from "./buildOutputSchema.ts";
import { writeFileSync } from "node:fs";

export namespace GraphQLStandardSchemaGenerator {
  export interface Options {
    schema: GraphQLSchema | DocumentNode;
    scalarTypes?: Record<string, JSONSchema.Interface>;
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
  ): StandardSchemaV1.WithJSONSchemaSource<TData, TData> {
    const schema = this.schema;
    const definitions = document.definitions.filter(
      (def): def is OperationDefinitionNode =>
        def.kind === "OperationDefinition" && !!def.name
    );
    if (definitions.length !== 1) {
      throw new Error("Document must contain exactly one named operation");
    }
    const definition = definitions[0]!;

    return {
      ["~standard"]: {
        types: {
          input: {} as TData,
          output: {} as TData,
        },
        toJSONSchema: ({ target }) => {
          if (target !== "draft-2020-12") {
            throw new Error("Only draft-2020-12 is supported");
          }
          return {
            ...schemaBase,
            ...buildOperationSchema(
              schema,
              document,
              definition,
              this.scalarTypes
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
        vendor: "@apollo/graphql-standard-schema",
        version: 1,
      },
    };
  }

  getResponseSchema<TData>(
    document: TypedDocumentNode<TData>
  ): StandardSchemaV1.WithJSONSchemaSource<
    FormattedExecutionResult<TData>,
    FormattedExecutionResult<TData>
  > {
    const dataSchema = this.getDataSchema(document);
    const definitions = document.definitions.filter(
      (def): def is OperationDefinitionNode =>
        def.kind === "OperationDefinition" && !!def.name
    );
    if (definitions.length !== 1) {
      throw new Error("Document must contain exactly one named operation");
    }
    const definition = definitions[0]!;

    return {
      ["~standard"]: {
        types: {
          input: {} as FormattedExecutionResult<TData>,
          output: {} as FormattedExecutionResult<TData>,
        },
        toJSONSchema: ({ target, io }) => {
          if (target !== "draft-2020-12") {
            throw new Error("Only draft-2020-12 is supported");
          }
          const dataJSONSchema: JSONSchema.Interface = dataSchema[
            "~standard"
          ].toJSONSchema({
            target,
            io,
          });

          return {
            ...schemaBase,
            title: `${definition.operation} ${
              definition.name?.value || "Anonymous"
            } Response`,
            properties: {
              data: dataJSONSchema,
              errors: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    locations: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          line: { type: "number" },
                          column: { type: "number" },
                        },
                        required: ["line", "column"],
                      },
                    },
                    path: {
                      type: "array",
                      items: {
                        anyOf: [{ type: "string" }, { type: "number" }],
                      },
                    },
                    extensions: { type: "object" },
                    required: ["message"],
                  },
                },
              },
              extensions: { type: "object" },
            },
            oneOf: [{ required: "data" }, { required: "errors" }],
          };
        },
        validate(value) {
          throw new Error("Not implemented");
        },
        vendor: "@apollo/graphql-standard-schema",
        version: 1,
      },
    };
  }

  getFragmentSchema<TData>(
    document: TypedDocumentNode<TData>,
    {
      fragmentName,
    }: {
      fragmentName?: string;
    } = {}
  ): StandardSchemaV1.WithJSONSchemaSource<TData, TData> {
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
    return this.getDataSchema<TData>(queryDocument);
  }

  getVariablesSchema<TVariables>(
    document: TypedDocumentNode<any, TVariables>
  ): StandardSchemaV1.WithJSONSchemaSource<TVariables, TVariables> {
    return {
      ["~standard"]: {
        types: {
          input: {} as TVariables,
          output: {} as TVariables,
        },
        toJSONSchema: () => {
          throw new Error("Not implemented");
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

const schemaBase = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
};

function buildOperationSchema(
  schema: GraphQLSchema,
  document: DocumentNode,
  operation: OperationDefinitionNode,
  scalarTypes?: Record<string, JSONSchema.Interface> | undefined
): JSONSchema.Interface {
  return {
    title: `${operation.operation} ${
      operation.name?.value || "Anonymous"
    } Data`,
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
  };
}

function buildVariablesSchema(
  schema: GraphQLSchema,
  operation: OperationDefinitionNode,
  scalarTypes?: Record<string, JSONSchema.Interface> | undefined
): JSONSchema {
  throw new Error("Not implemented");
}
