import type { StandardJSONSchemaV1 } from "@standard-schema/spec";

export function schemaBase(
  params: StandardJSONSchemaV1.Options = { target: "draft-2020-12" }
) {
  const schema: Record<string, unknown> = {};
  if (params?.target === "draft-2020-12" || params?.target === undefined) {
    schema.$schema = "https://json-schema.org/draft/2020-12/schema";
  } else if (params?.target === "draft-07") {
    schema.$schema = "http://json-schema.org/draft-07/schema#";
  } else {
    throw new Error("Only draft-07 and draft-2020-12 are supported");
  }
  return schema;
}
