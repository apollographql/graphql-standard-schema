import type { StandardJSONSchemaV1 } from "../standard-schema-spec.ts";
import type { CombinedSpec } from "../types.ts";
import z from "zod";

/**
 * Temporary helper function until `StandardJSONSchemaV1` is fully specified and supported by zod.
 */
export function zodToStandardJSONSchemaV1<Schema extends z.Schema>(
  schema: Schema
): CombinedSpec<z.input<Schema>, z.output<Schema>> {
  return Object.assign({}, schema, {
    "~standard": {
      jsonSchema: {
        input: ({
          target,
          ...otherOptions
        }: StandardJSONSchemaV1.Options = {}) =>
          z.toJSONSchema(schema, {
            ...otherOptions,
            target: target as any,
            io: "input",
          }) as Record<string, unknown>,
        output: ({
          target,
          ...otherOptions
        }: StandardJSONSchemaV1.Options = {}) =>
          z.toJSONSchema(schema, {
            ...otherOptions,
            target: target as any,
            io: "output",
          }) as Record<string, unknown>,
      },
      ...schema["~standard"],
    },
  });
}
