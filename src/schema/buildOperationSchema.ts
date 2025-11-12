import {
  OperationTypeNode,
  type DocumentNode,
  type GraphQLSchema,
  type OperationDefinitionNode,
} from "graphql";
import type { GraphQLStandardSchemaGenerator } from "../GraphQLStandardSchemaGenerator.ts";
import type { OpenAiSupportedJsonSchema } from "../utils/openAiSupportedJsonSchema.ts";
import { buildOutputSchema } from "./buildOutputSchema.ts";

export function buildOperationSchema(
  schema: GraphQLSchema,
  document: DocumentNode,
  operation: OperationDefinitionNode,
  scalarTypes: GraphQLStandardSchemaGenerator.ScalarDefinitions,
  direction: "serialized" | "deserialized",
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
      direction,
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
