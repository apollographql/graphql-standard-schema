import type { GraphQLStandardSchemaGenerator } from "../GraphQLStandardSchemaGenerator.ts";
import {
  standardJSONSchemaRootKey,
  type StandardJSONSchemaV1,
} from "../standard-schema-spec.ts";

export const toJSONSchema = {
  input(
    standardSchema: StandardJSONSchemaV1<unknown, unknown>,
    options?: StandardJSONSchemaV1.Options & {
      libraryOptions?: GraphQLStandardSchemaGenerator.JSONSchemaOptions;
    }
  ) {
    return standardSchema[standardJSONSchemaRootKey].jsonSchema.input(
      options || { target: "draft-2020-12" }
    );
  },
  output(
    standardSchema: StandardJSONSchemaV1<unknown, unknown>,
    options?: StandardJSONSchemaV1.Options & {
      libraryOptions: GraphQLStandardSchemaGenerator.JSONSchemaOptions;
    }
  ) {
    return standardSchema[standardJSONSchemaRootKey].jsonSchema.output(
      options || { target: "draft-2020-12" }
    );
  },
};
