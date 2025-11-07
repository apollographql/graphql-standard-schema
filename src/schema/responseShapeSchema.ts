import type {
  OperationDefinitionNode,
  FormattedExecutionResult,
} from "graphql";
import { standardSchema } from "../utils/standardSchema.ts";
import { schemaBase } from "./schemaBase.ts";
import type { OpenAiSupportedJsonSchema } from "../utils/openAiSupportedJsonSchema.ts";
import type { StandardJSONSchemaV1 } from "../standard-schema-spec.ts";
import { assert } from "../utils/assert.ts";
import type { StandardSchemaV1 } from "@standard-schema/spec";

export function responseShapeSchema(definition: OperationDefinitionNode) {
  function validate(
    value: unknown
  ): StandardSchemaV1.Result<FormattedExecutionResult> {
    try {
      // https://spec.graphql.org/October2021/#sec-Response
      // Response Format
      // A response to a GraphQL request must be a map.
      assert(
        typeof value === "object" && !Array.isArray(value),
        "value needs to be object"
      );
      assert<Record<string, unknown>>(value, "value cannot be null");

      /*
      https://spec.graphql.org/October2021/#sec-Data

      The data entry in the response will be the result of the execution of the 
      requested operation. If the operation was a query, this output will be an 
      object of the query root operation type; if the operation was a mutation, 
      this output will be an object of the mutation root operation type.

      If an error was raised before execution begins, the data entry should not be 
      present in the result.

      If an error was raised during the execution that prevented a valid response, 
      the data entry in the response should be null.

      https://spec.graphql.org/October2021/#sec-Errors
      The errors entry in the response is a non-empty list of errors, where each
      error is a map.

      If no errors were raised during the request, the errors entry should
      not be present in the result.

      If the data entry in the response is not present, the errors entry in the
      response must not be empty. It must contain at least one error. The errors
      it contains should indicate why no data was able to be returned.

      If the data entry in the response is present (including if it is the value
      null), the errors entry in the response may contain any field errors that were
      raised during execution. If field errors were raised during execution, it should
      contain those errors.
      */
      assert(
        "data" in value || "errors" in value,
        "Value needs to have at least one of 'data' or 'errors' properties"
      );

      if (value.data === null) {
        assert(
          value.errors != null,
          "'errors' must be non-null if 'data' is null"
        );
      }
      if ("errors" in value) {
        assert(
          Array.isArray(value.errors) && value.errors.length > 0,
          `Expected 'errors' to be a non-empty array, got ${typeof value.errors}`
        );
      } else {
        assert(
          value.data &&
            typeof value.data === "object" &&
            !Array.isArray(value.data),
          "'data' be a non-null object if 'errors' is not present"
        );
      }
      /*
       The response map may also contain an entry with key extensions. 
       This entry, if set, must have a map as its value. This entry is reserved for 
       implementors to extend the protocol however they see fit, and hence there are no 
       additional restrictions on its contents.
       */
      if ("extensions" in value) {
        assert(
          value.extensions &&
            typeof value.extensions === "object" &&
            !Array.isArray(value.extensions),
          "'extensions' must be an object if present"
        );
      }

      return { value };
    } catch (e) {
      return { issues: [{ message: (e as Error).message, path: [] }] };
    }
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
