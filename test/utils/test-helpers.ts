import assert from "node:assert";
import Ajv from "ajv/dist/2020.js";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { parse } from "graphql";

const ajv = new (Ajv as any as typeof import("ajv").Ajv)();

export function validateWithAjv(schema: unknown, data: unknown) {
  const validate = ajv.compile(schema);
  const valid = validate(data);
  return { valid, errors: validate.errors || [] };
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
