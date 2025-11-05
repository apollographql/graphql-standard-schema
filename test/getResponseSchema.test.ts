import { test } from "node:test";
import { expectTypeOf } from "expect-type";
import { GraphQLStandardSchemaGenerator } from "../src/index.ts";
import { swSchema } from "./utils/swSchema.ts";
import { gql, validateSync, validateWithAjv } from "./utils/test-helpers.ts";
import type { StandardSchemaV1 } from "../src/standard-schema-spec.ts";
import { DateScalarDef } from "./utils/DateScalarDef.ts";
import { toJSONSchema } from "./utils/toJsonSchema.ts";
import { buildSchema, type GraphQLFormattedError } from "graphql";
import { getBidirectionalJsonSchemas } from "./utils/getBidirectionalJsonSchemas.ts";

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
                currentlyPlaying: Media
              }
            `),
    scalarTypes: {
      Date: DateScalarDef,
    },
  });
  const responseSchema = generator.getResponseSchema(
    gql<{
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
  `)
  );
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
  });
  await t.test("JSON Schema", async (t) => {
    const { serializedJsonSchema, deserializedJsonSchema } =
      getBidirectionalJsonSchemas(responseSchema);

    console.log(JSON.stringify(serializedJsonSchema, null, 2));
  });
});
