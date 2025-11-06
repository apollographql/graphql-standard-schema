import type { GraphQLStandardSchemaGenerator } from "../GraphQLStandardSchemaGenerator.ts";
import type { StandardJSONSchemaV1 } from "../standard-schema-spec.ts";

export const toJSONSchema = {
  input(
    standardSchema: StandardJSONSchemaV1<unknown, unknown>,
    options?: StandardJSONSchemaV1.Options &
      GraphQLStandardSchemaGenerator.JSONSchemaOptions
  ) {
    return standardSchema["~standard"].jsonSchema.input(options);
  },
  output(
    standardSchema: StandardJSONSchemaV1<unknown, unknown>,
    options?: StandardJSONSchemaV1.Options &
      GraphQLStandardSchemaGenerator.JSONSchemaOptions
  ) {
    return standardSchema["~standard"].jsonSchema.output(options);
  },
};
