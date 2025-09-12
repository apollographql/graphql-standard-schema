import {
  buildASTSchema,
  type DocumentNode,
  execute,
  type FormattedExecutionResult,
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLInt,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLString,
} from "graphql";
import type { StandardSchemaV1 } from "./standard-schema-spec.ts";
import type { TypedDocumentNode } from "@graphql-typed-document-node/core";

export namespace GraphQLStandardSchemaGenerator {
  export interface Options {
    schema: GraphQLSchema | DocumentNode;
  }
}
export class GraphQLStandardSchemaGenerator {
  private schema!: GraphQLSchema;
  constructor({ schema }: GraphQLStandardSchemaGenerator.Options) {
    this.replaceSchema(schema);
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
    return {
      ["~standard"]: {
        types: {
          input: {} as TData,
          output: {} as TData,
        },
        toJSONSchema: () => {
          throw new Error("Not implemented");
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
              const returnType = info.returnType;
              if (returnType instanceof GraphQLScalarType) {
                switch (returnType.name) {
                  case GraphQLString.name:
                    if (typeof value !== "string") {
                      throw new TypeError(
                        `Value for scalar type ${GraphQLScalarType.name} is not string: ${value}`
                      );
                    }
                    break;
                  case GraphQLFloat.name:
                    if (typeof value !== "number") {
                      throw new TypeError(
                        `Value for scalar type ${GraphQLScalarType.name} is not number: ${value}`
                      );
                    }
                    break;
                  case GraphQLInt.name:
                    if (typeof value !== "number") {
                      throw new TypeError(
                        `Value for scalar type ${GraphQLScalarType.name} is not number: ${value}`
                      );
                    }
                    break;
                  case GraphQLBoolean.name:
                    if (typeof value !== "boolean") {
                      throw new TypeError(
                        `Value for scalar type ${GraphQLScalarType.name} is not boolean: ${value}`
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
    return {
      ["~standard"]: {
        types: {
          input: {} as FormattedExecutionResult<TData>,
          output: {} as FormattedExecutionResult<TData>,
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

const BuiltInScalarType = {
  ID: "ID",
  Int: "Int",
  Float: "Float",
  Boolean: "Boolean",
  String: "String",
};
