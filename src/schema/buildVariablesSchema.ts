import type {
  GraphQLSchema,
  DocumentNode,
  OperationDefinitionNode,
} from "graphql";
import { buildInputSchema } from "./buildInputSchema.ts";
import type { GraphQLStandardSchemaGenerator } from "../GraphQLStandardSchemaGenerator.ts";
import type { OpenAiSupportedJsonSchema } from "../utils/openAiSupportedJsonSchema.ts";

export function buildVariablesSchema(
  schema: GraphQLSchema,
  document: DocumentNode,
  operation: OperationDefinitionNode,
  scalarTypes: GraphQLStandardSchemaGenerator.Internal.ScalarMapping,
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
