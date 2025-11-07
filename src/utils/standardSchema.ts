import type { GraphQLStandardSchemaGenerator } from "../GraphQLStandardSchemaGenerator.ts";
import { standardJSONSchemaRootKey } from "../standard-schema-spec.ts";
import type { CombinedSpec } from "../types.ts";

export function standardSchema<Input, Output>(
  validate: GraphQLStandardSchemaGenerator.ValidationSchema<
    Input,
    Output
  >["~standard"]["validate"],
  input: GraphQLStandardSchemaGenerator.JSONSchemaCreator,
  output: GraphQLStandardSchemaGenerator.JSONSchemaCreator
): CombinedSpec<Input, Output> {
  return {
    "~standard": {
      validate,
      vendor: "@apollo/graphql-standard-schema",
      version: 1 as const,
    },
    [standardJSONSchemaRootKey]: {
      jsonSchema: {
        input,
        output,
      },
    },
  };
}
