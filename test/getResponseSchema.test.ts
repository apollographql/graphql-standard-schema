import { test } from "node:test";
import { expectTypeOf } from "expect-type";
import { GraphQLStandardSchemaGenerator, toJSONSchema } from "../src/index.ts";
import { gql, validateSync } from "./utils/test-helpers.ts";
import type { StandardSchemaV1 } from "../src/standard-schema-spec.ts";
import { DateScalarDef } from "./utils/DateScalarDef.ts";
import { buildSchema, type GraphQLFormattedError } from "graphql";
import { getBidirectionalJsonSchemas } from "./utils/getBidirectionalJsonSchemas.ts";
import jsonPatch from "fast-json-patch";
import { getOperation } from "../src/index.ts";
import { responseShapeSchema } from "../src/schema/responseShapeSchema.ts";

await test("simple query response", async (t) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(/**GraphQL*/ `
              enum MediaKind {
                MOVIE
                SERIES
              }

              scalar Date

              type Media {
                    title: String!
                    kind: MediaKind!
                    startedAt: Date!
             }

              type Query {
                currentlyPlaying: Media!
              }
            `),
    scalarTypes: {
      Date: DateScalarDef,
    },
  });
  const query = gql<{
    currentlyPlaying: {
      title: string;
      kind: "MOVIE" | "SERIES";
      startedAt: Date;
    };
  }>(/*GraphQL*/ `
    query CurrentlyPlaying {
      currentlyPlaying {
        title
        kind
        startedAt
      }
    }
  `);
  const responseSchema = generator.getResponseSchema(query);
  await t.test("normalize", async (t) => {
    t.assert.equal(responseSchema, responseSchema.normalize);
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof responseSchema>
      >().toEqualTypeOf<{
        errors?: ReadonlyArray<GraphQLFormattedError> | null;
        extensions?: Record<string, unknown> | null;
        data?: {
          currentlyPlaying: {
            title: string;
            kind: "MOVIE" | "SERIES";
            startedAt: string;
          };
        } | null;
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof responseSchema>
      >().toEqualTypeOf<{
        errors?: ReadonlyArray<GraphQLFormattedError> | null;
        extensions?: Record<string, unknown> | null;
        data?: {
          currentlyPlaying: {
            title: string;
            kind: "MOVIE" | "SERIES";
            startedAt: string;
          };
        } | null;
      }>();
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof responseSchema>
      >().toEqualTypeOf<
        StandardSchemaV1.InferInput<typeof responseSchema.normalize>
      >();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof responseSchema>
      >().toEqualTypeOf<
        StandardSchemaV1.InferOutput<typeof responseSchema.normalize>
      >();
    });
    await t.test("validation", async (t) => {
      function validateValidValue(value: unknown) {
        t.assert.deepEqual(responseSchema(value), { value });
        t.assert.deepEqual(
          responseSchema(value),
          validateSync(responseSchema, value)
        );
      }
      function expectInvalidIssues(
        value: unknown,
        expectedIssues: StandardSchemaV1.Issue[]
      ) {
        t.assert.deepEqual(responseSchema(value), {
          issues: expectedIssues,
        });
        t.assert.deepEqual(
          responseSchema(value),
          validateSync(responseSchema, value)
        );
      }
      const validData = {
        currentlyPlaying: {
          __typename: "Media",
          title: "Inception",
          kind: "MOVIE",
          startedAt: "2023-10-01",
        },
      };

      validateValidValue({ data: validData });
      validateValidValue({ errors: [{ message: "Error message" }] });
      validateValidValue({
        data: null,
        errors: [{ message: "Error message" }],
      });
      expectInvalidIssues(null, [
        {
          message: "value cannot be null",
          path: [],
        },
      ]);
      expectInvalidIssues({ data: {} }, [
        {
          message: 'Expected type "Media" to be an object.',
          path: ["data", "currentlyPlaying"],
        },
      ]);
      expectInvalidIssues({ data: null }, [
        {
          message: "'errors' must be non-null if 'data' is null",
          path: [],
        },
      ]);
      expectInvalidIssues({ errors: [] }, [
        {
          message: "Expected 'errors' to be a non-empty array, got object",
          path: [],
        },
      ]);
      expectInvalidIssues({ data: validData, extensions: [] }, [
        {
          message: "'extensions' must be an object if present",
          path: [],
        },
      ]);
      expectInvalidIssues({ data: validData, extensions: undefined }, [
        {
          message: "'extensions' must be an object if present",
          path: [],
        },
      ]);
      expectInvalidIssues(
        {
          extensions: {},
        },
        [
          {
            message:
              "Value needs to have at least one of 'data' or 'errors' properties",
            path: [],
          },
        ]
      );
    });
  });
  await t.test("deserialize", async (t) => {
    const deserializeSchema = responseSchema.deserialize;
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof deserializeSchema>
      >().toEqualTypeOf<{
        errors?: ReadonlyArray<GraphQLFormattedError> | null;
        extensions?: Record<string, unknown> | null;
        data?: {
          currentlyPlaying: {
            title: string;
            kind: "MOVIE" | "SERIES";
            startedAt: string;
          };
        } | null;
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof deserializeSchema>
      >().toEqualTypeOf<{
        errors?: ReadonlyArray<GraphQLFormattedError> | null;
        extensions?: Record<string, unknown> | null;
        data?: {
          currentlyPlaying: {
            title: string;
            kind: "MOVIE" | "SERIES";
            startedAt: Date;
          };
        } | null;
      }>();
    });
    await t.test("validation", async (t) => {
      {
        const value = {
          data: {
            currentlyPlaying: {
              __typename: "Media",
              title: "Inception",
              kind: "MOVIE",
              startedAt: "2023-10-01",
            },
          },
        };
        const result = validateSync(deserializeSchema, value);
        t.assert.deepEqual(deserializeSchema(value), result);
        t.assert.deepEqual(result, {
          value: {
            data: {
              currentlyPlaying: {
                __typename: "Media",
                title: "Inception",
                kind: "MOVIE",
                startedAt: new Date("2023-10-01"),
              },
            },
          },
        });
      }
      {
        const value = {
          data: {
            currentlyPlaying: {
              __typename: "Media",
              kind: "MOVIE",
              startedAt: "2023-10-01",
            },
          },
        };
        const result = validateSync(deserializeSchema, value);
        t.assert.deepEqual(deserializeSchema(value), result);
        t.assert.deepEqual(result, {
          issues: [
            {
              message: "String cannot represent a non string value: undefined",
              path: ["data", "currentlyPlaying", "title"],
            },
          ],
        });
      }
      {
        const value = {
          data: {
            currentlyPlaying: {
              __typename: "Media",
              kind: "MOVIE",
              startedAt: "2023-10-01",
            },
          },
          errors: null as any,
        };
        const result = validateSync(deserializeSchema, value);
        t.assert.deepEqual(deserializeSchema(value), result);
        t.assert.deepEqual(result, {
          issues: [
            {
              message: "Expected 'errors' to be a non-empty array, got object",
              path: [],
            },
            {
              message: "String cannot represent a non string value: undefined",
              path: ["data", "currentlyPlaying", "title"],
            },
          ],
        });
      }
    });
  });
  await t.test("serialize", async (t) => {
    const serializeSchema = responseSchema.serialize;
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof serializeSchema>
      >().toEqualTypeOf<{
        errors?: ReadonlyArray<GraphQLFormattedError> | null;
        extensions?: Record<string, unknown> | null;
        data?: {
          currentlyPlaying: {
            title: string;
            kind: "MOVIE" | "SERIES";
            startedAt: Date;
          };
        } | null;
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof serializeSchema>
      >().toEqualTypeOf<{
        errors?: ReadonlyArray<GraphQLFormattedError> | null;
        extensions?: Record<string, unknown> | null;
        data?: {
          currentlyPlaying: {
            title: string;
            kind: "MOVIE" | "SERIES";
            startedAt: string;
          };
        } | null;
      }>();
    });
    await t.test("validation", async (t) => {
      {
        const value = {
          data: {
            currentlyPlaying: {
              __typename: "Media",
              title: "Inception",
              kind: "MOVIE",
              startedAt: new Date("2023-10-01"),
            },
          },
        };
        const result = validateSync(serializeSchema, value);
        t.assert.deepEqual(serializeSchema(value), result);
        t.assert.deepEqual(result, {
          value: {
            data: {
              currentlyPlaying: {
                __typename: "Media",
                title: "Inception",
                kind: "MOVIE",
                startedAt: "2023-10-01",
              },
            },
          },
        });
      }
      {
        const value = {
          data: {
            currentlyPlaying: {
              __typename: "Media",
              kind: "MOVIE",
              startedAt: "2023-10-01",
            },
          },
        };
        const result = validateSync(serializeSchema, value);
        t.assert.deepEqual(serializeSchema(value), result);
        t.assert.deepEqual(result, {
          issues: [
            {
              message: "Cannot return null for non-nullable field Media.title.",
              path: ["data", "currentlyPlaying", "title"],
            },
          ],
        });
      }
      {
        const value = {
          data: {
            currentlyPlaying: {
              __typename: "Media",
              title: "Inception",
              kind: "MOVIE",
              startedAt: false,
            },
          },
          errors: null as any,
        };
        const result = validateSync(serializeSchema, value);
        t.assert.deepEqual(serializeSchema(value), result);
        t.assert.deepEqual(result, {
          issues: [
            {
              message: "Expected 'errors' to be a non-empty array, got object",
              path: [],
            },
            {
              message: "Value is not a valid Date object: false",
              path: ["data", "currentlyPlaying", "startedAt"],
            },
          ],
        });
      }
    });
  });
  await t.test("JSON Schema", async (t) => {
    const { serializedJsonSchema, deserializedJsonSchema } =
      getBidirectionalJsonSchemas(responseSchema);

    const rootSchema = toJSONSchema.input(
      responseShapeSchema(getOperation(query))
    );

    let rootPatch: jsonPatch.Operation[];
    await t.test("expected changes to generic root schema", (t) => {
      rootPatch = jsonPatch.compare(rootSchema, serializedJsonSchema);
      t.assert.deepEqual(rootPatch, [
        {
          op: "add",
          path: "/properties/data",
          value: {
            anyOf: [
              {
                type: "null",
              },
              {
                type: "object",
                title: "query CurrentlyPlaying",
                properties: {
                  currentlyPlaying: {
                    title: "Media",
                    type: "object",
                    properties: {
                      __typename: {
                        const: "Media",
                      },
                      title: {
                        title: "Media.title: String!",
                        type: "string",
                      },
                      kind: {
                        title: "Media.kind: MediaKind!",
                        $ref: "#/$defs/data/enum/MediaKind",
                      },
                      startedAt: {
                        title: "Media.startedAt: Date!",
                        $ref: "#/$defs/data/scalar/Date",
                      },
                    },
                    required: ["__typename", "title", "kind", "startedAt"],
                  },
                },
                required: ["currentlyPlaying"],
              },
            ],
          },
        },
        {
          op: "add",
          path: "/$defs",
          value: {
            data: {
              enum: {
                MediaKind: {
                  title: "MediaKind",
                  enum: ["MOVIE", "SERIES"],
                },
              },
              scalar: {
                Date: {
                  title: "Date",
                  description: "A date string in YYYY-MM-DD format",
                  type: "string",
                  pattern: "\\d{4}-\\d{1,2}-\\d{1,2}",
                },
              },
            },
          },
        },
      ]);
    });

    await t.test("expected changes to data schema", (t) => {
      const added = (rootPatch as any)[0].value.anyOf[1];
      const dataPatch = jsonPatch.compare(
        getBidirectionalJsonSchemas(generator.getDataSchema(query))
          .serializedJsonSchema,
        added
      );
      t.assert.deepEqual(dataPatch, [
        {
          op: "remove",
          path: "/$defs",
        },
        {
          op: "replace",
          path: "/properties/currentlyPlaying/properties/startedAt/$ref",
          value: "#/$defs/data/scalar/Date",
        },
        {
          op: "replace",
          path: "/properties/currentlyPlaying/properties/kind/$ref",
          value: "#/$defs/data/enum/MediaKind",
        },
        {
          op: "remove",
          path: "/$schema",
        },
      ]);
    });

    await t.test(
      "expected differences between deserialize and serialized schemas",
      (t) => {
        t.assert.deepEqual(
          jsonPatch.compare(deserializedJsonSchema, serializedJsonSchema),
          [
            {
              op: "replace",
              path: "/$defs/data/scalar/Date/type",
              value: "string",
            },
            {
              op: "replace",
              path: "/$defs/data/scalar/Date/description",
              value: "A date string in YYYY-MM-DD format",
            },
            {
              op: "add",
              path: "/$defs/data/scalar/Date/pattern",
              value: "\\d{4}-\\d{1,2}-\\d{1,2}",
            },
          ]
        );
        t.assert.deepEqual(
          jsonPatch.compare(serializedJsonSchema, deserializedJsonSchema),
          [
            {
              op: "remove",
              path: "/$defs/data/scalar/Date/pattern",
            },
            {
              op: "replace",
              path: "/$defs/data/scalar/Date/type",
              value: "number",
            },
            {
              op: "replace",
              path: "/$defs/data/scalar/Date/description",
              value: "Unix timestamp in milliseconds",
            },
          ]
        );
      }
    );
    await t.test("serialized JSON schema snapshot", (t) =>
      t.assert.snapshot(serializedJsonSchema)
    );
    await t.test("deserialized JSON schema snapshot", (t) =>
      t.assert.snapshot(deserializedJsonSchema)
    );
  });
});
