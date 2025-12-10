import type { GraphQLSchema, OperationDefinitionNode } from "graphql";
import { buildInputSchema } from "./buildInputSchema.ts";
import type { GraphQLStandardSchemaGenerator } from "../GraphQLStandardSchemaGenerator.ts";
import type { OpenAiSupportedJsonSchema } from "../utils/openAiSupportedJsonSchema.ts";

export function buildVariablesSchema(
  schema: GraphQLSchema,
  operation: OperationDefinitionNode,
  scalarTypes: GraphQLStandardSchemaGenerator.ScalarDefinitions,
  direction: "serialized" | "deserialized",
  options: GraphQLStandardSchemaGenerator.JSONSchemaOptions
): OpenAiSupportedJsonSchema {
  return {
    ...(operation.description
      ? { description: operation.description?.value }
      : {}),
    ...buildInputSchema(schema, operation, scalarTypes, direction, options),
    title: `Variables for ${operation.operation} ${operation.name?.value || "Anonymous"}`,
  };
}
