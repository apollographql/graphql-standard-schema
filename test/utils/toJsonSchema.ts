import type { StandardJSONSchemaV1 } from "../../src/standard-schema-spec.ts";

export function toJSONSchema(
  standardSchema: StandardJSONSchemaV1<unknown, unknown>,
  options?: StandardJSONSchemaV1.Options
) {
  return standardSchema["~standard"].jsonSchema.input(options);
}
