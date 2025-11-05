import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { GraphQLSchema, execute, type FormattedExecutionResult } from "graphql";
import { formatError } from "./formatError.ts";
import type { GraphQLStandardSchemaGenerator } from "../GraphQLStandardSchemaGenerator.ts";
import type { StandardSchemaV1 } from "../standard-schema-spec.ts";

export function serializeWithSchema<
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
