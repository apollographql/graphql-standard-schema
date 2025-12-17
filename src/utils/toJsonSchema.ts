import type { GraphQLStandardSchemaGenerator } from "../GraphQLStandardSchemaGenerator.ts";
import type { StandardJSONSchemaV1 } from "@standard-schema/spec";

export const toJSONSchema = {
  input(
    standardSchema: StandardJSONSchemaV1<unknown, unknown>,
    options?: StandardJSONSchemaV1.Options & {
      libraryOptions?: GraphQLStandardSchemaGenerator.JSONSchemaOptions;
    }
  ) {
    return standardSchema["~standard"].jsonSchema.input(
      options || { target: "draft-2020-12" }
    );
  },
  output(
    standardSchema: StandardJSONSchemaV1<unknown, unknown>,
    options?: StandardJSONSchemaV1.Options & {
      libraryOptions: GraphQLStandardSchemaGenerator.JSONSchemaOptions;
    }
  ) {
    return standardSchema["~standard"].jsonSchema.output(
      options || { target: "draft-2020-12" }
    );
  },
};
