import type {
  OperationDefinitionNode,
  FormattedExecutionResult,
} from "graphql";
import { standardSchema } from "../index.ts";
import { schemaBase } from "./schemaBase.ts";
import type { OpenAiSupportedJsonSchema } from "../openAiSupportedJsonSchema.ts";
import type {
  StandardJSONSchemaV1,
  StandardSchemaV1,
} from "../standard-schema-spec.ts";

export function responseShapeSchema(definition: OperationDefinitionNode) {
  function validate(value: unknown) {
    const issues: StandardSchemaV1.Issue[] = [];
    if (typeof value !== "object" || value === null) {
      issues.push({
        message: `Expected object for GraphQL response, got ${typeof value}`,
        path: [],
      });
      return { issues };
    }
    if (
      "errors" in value &&
      value.errors != null &&
      !Array.isArray(value.errors)
    ) {
      issues.push({
        message: `Expected 'errors' to be an array or null, got ${typeof value.errors}`,
      });
    }
    if (
      "extensions" in value &&
      typeof value.extensions !== "undefined" &&
      typeof value.extensions !== "object"
    ) {
      issues.push({
        message: `Expected 'extensions' to be an object or null, got ${typeof value.extensions}`,
      });
    }
    if (issues.length > 0) {
      return { issues };
    }
    return { value } as { value: Omit<FormattedExecutionResult, "data"> };
  }

  function buildSchema(
    options?: StandardJSONSchemaV1.Options
  ): OpenAiSupportedJsonSchema {
    return {
      ...schemaBase(options),
      title: `Full response for ${definition.operation} ${
        definition.name?.value || "Anonymous"
      }`,
      type: "object",
      properties: {
        errors: {
          anyOf: [
            { type: "null" },
            {
              type: "array",
              items: {
                type: "object",
                properties: {
                  message: { type: "string" },
                  locations: {
                    anyOf: [
                      { type: "null" },
                      {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            line: { type: "number" },
                            column: { type: "number" },
                          },
                          required: ["line", "column"],
                          additionalProperties: false,
                        },
                      },
                    ],
                  },
                  path: {
                    anyOf: [
                      {
                        type: "array",
                        items: {
                          anyOf: [{ type: "string" }, { type: "number" }],
                        },
                      },
                    ],
                  },
                  // any-type object not supported by OpenAI
                  // extensions: { type: "object" },
                },
                additionalProperties: false,
                required: ["message", "locations", "path", "extensions"],
              },
            },
          ],
        },
        // any-type object not supported by OpenAI
        // extensions: { type: "object" },
      },
      required: ["errors"],
      additionalProperties: false as const,
      // not supported by OpenAI
      // oneOf: [{ required: "data" }, { required: "errors" }],
    };
  }

  return standardSchema<
    Omit<FormattedExecutionResult, "data">,
    Omit<FormattedExecutionResult, "data">
  >(validate, buildSchema, buildSchema);
}
