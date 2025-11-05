import assert from "node:assert";
import type { GraphQLStandardSchemaGenerator } from "../../src/index.ts";
import { toJSONSchema } from "./toJsonSchema.ts";

export function getBidirectionalJsonSchemas(
  base: GraphQLStandardSchemaGenerator.BidirectionalValidationSchema<any, any>
) {
  const serializedJsonSchema = toJSONSchema.output(base.serialize);
  const deserializedJsonSchema = toJSONSchema.output(base.deserialize);
  assert.deepEqual(serializedJsonSchema, toJSONSchema.input(base));
  assert.deepEqual(serializedJsonSchema, toJSONSchema.output(base));
  assert.deepEqual(serializedJsonSchema, toJSONSchema.input(base.normalize));
  assert.deepEqual(serializedJsonSchema, toJSONSchema.output(base.normalize));
  assert.deepEqual(serializedJsonSchema, toJSONSchema.input(base.deserialize));
  assert.deepEqual(serializedJsonSchema, toJSONSchema.output(base.serialize));
  assert.deepEqual(deserializedJsonSchema, toJSONSchema.input(base.serialize));
  assert.deepEqual(
    deserializedJsonSchema,
    toJSONSchema.output(base.deserialize)
  );
  return { serializedJsonSchema, deserializedJsonSchema };
}
