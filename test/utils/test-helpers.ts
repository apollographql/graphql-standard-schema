import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import assert from "node:assert";
import Ajv from "ajv/dist/2020.js";
import type { JSONSchema } from "json-schema-typed/draft-2020-12";
import type { StandardSchemaV1 } from "../../src/standard-schema-spec.ts";
import { parse } from "graphql";

const ajv = new (Ajv as any as typeof import("ajv").Ajv)();

export function validateWithAjv(schema: JSONSchema.Interface, data: unknown) {
  const validate = ajv.compile(schema);
  const valid = validate(data);
  return { valid, errors: validate.errors || [] };
}

export function assertSchemaMatches(
  actual: any,
  expected: any,
  message?: string
) {
  // Helper function to check if actual schema contains all expected properties
  // while allowing additional properties like titles

  if (typeof expected !== "object" || expected === null) {
    assert.strictEqual(actual, expected, message);
    return;
  }

  if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual), `Expected array but got ${typeof actual}`);
    assert.strictEqual(
      actual.length,
      expected.length,
      "Array lengths should match"
    );
    for (let i = 0; i < expected.length; i++) {
      assertSchemaMatches(actual[i], expected[i], `${message} [${i}]`);
    }
    return;
  }

  for (const [key, value] of Object.entries(expected)) {
    assert.ok(
      key in actual,
      `Expected property '${key}' to exist in actual object`
    );
    assertSchemaMatches(actual[key], value, `${message}.${key}`);
  }
}

export function validateSync<T>(
  schema: StandardSchemaV1<unknown, T>,
  data: unknown
) {
  const result = schema["~standard"].validate(data);
  if (result instanceof Promise) {
    throw new TypeError("Schema validation must be synchronous");
  }
  return result;
}

export function validateSyncExtract<T>(
  schema: StandardSchemaV1<unknown, T>,
  data: unknown
) {
  const result = validateSync(schema, data);
  if ("value" in result) {
    return result.value;
  }
  throw new Error(JSON.stringify(result.issues, null, 2));
}

export function gql<TData, TVariables = Record<string, unknown>>(
  query: string
): import("@graphql-typed-document-node/core").TypedDocumentNode<
  TData,
  TVariables
> {
  return parse(query);
}
