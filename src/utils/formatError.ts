import { GraphQLError, type GraphQLFormattedError } from "graphql";
import type { StandardSchemaV1 } from "@standard-schema/spec";

export function formatError(
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
