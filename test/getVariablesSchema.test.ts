import { test } from "node:test";

import { GraphQLStandardSchemaGenerator } from "../src/index.ts";
import { gql, validateSync, validateWithAjv } from "./utils/test-helpers.ts";
import { buildSchema } from "graphql";
import assert from "node:assert";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { expectTypeOf } from "expect-type";
import { DateScalarDef } from "./utils/DateScalarDef.ts";
import { getBidirectionalJsonSchemas } from "./utils/getBidirectionalJsonSchemas.ts";

test("handles nullable and non-nullable arguments", async (t) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(/**GraphQL*/ `
      type Query {
        search(text: String!, maxCount: Int): String
      }
    `),
  });
  const variablesSchema = generator.getVariablesSchema(
    gql<
      { search: string },
      { text: string; maxCount?: number }
    >(/** GraphQL */ `
      query Search($text: String!, $maxCount: Int = 5) {
        search(text: $text, maxCount: $maxCount)
      }
    `)
  );
  await t.test("normalize", async (t) => {
    t.assert.equal(variablesSchema, variablesSchema.normalize);
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof variablesSchema>
      >().toEqualTypeOf<{
        text: string;
        maxCount?: number | null | undefined;
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof variablesSchema>
      >().toEqualTypeOf<{
        text: string;
        maxCount?: number | null | undefined;
      }>();
    });
    await t.test("validateSync", () => {
      {
        const result = validateSync(variablesSchema, {
          text: "Han",
          maxCount: null,
        });
        assert.deepStrictEqual(result, {
          value: {
            maxCount: null,
            text: "Han",
          },
        });
      }
      {
        const result = validateSync(variablesSchema, {
          text: "Han",
          maxCount: 5,
        });
        assert.deepStrictEqual(result, {
          value: {
            maxCount: 5,
            text: "Han",
          },
        });
      }
      {
        const result = validateSync(variablesSchema, {
          text: null,
          maxCount: null,
        });
        assert.deepStrictEqual(result, {
          issues: [
            {
              message: "Expected value to be non-null.",
              path: ["text"],
            },
          ],
        });
      }
    });
  });
  await t.test("deserialize", async (t) => {
    const deserializeSchema = variablesSchema.deserialize;
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof deserializeSchema>
      >().toEqualTypeOf<{
        text: string;
        maxCount?: number | null | undefined;
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof deserializeSchema>
      >().toEqualTypeOf<{
        text: string;
        maxCount?: number | null | undefined;
      }>();
    });
    await t.test("validateSync", () => {
      {
        const result = validateSync(deserializeSchema, {
          text: "Han",
          maxCount: null,
        });
        assert.deepStrictEqual(result, {
          value: {
            maxCount: null,
            text: "Han",
          },
        });
      }
      {
        const result = validateSync(deserializeSchema, {
          text: "Han",
          maxCount: 5,
        });
        assert.deepStrictEqual(result, {
          value: {
            maxCount: 5,
            text: "Han",
          },
        });
      }
      {
        const result = validateSync(deserializeSchema, {
          text: null,
          maxCount: null,
        });
        assert.deepStrictEqual(result, {
          issues: [
            {
              message: "Expected value to be non-null.",
              path: ["text"],
            },
          ],
        });
      }
    });
  });
  await t.test("serialize", async (t) => {
    const serializeSchema = variablesSchema.serialize;
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof serializeSchema>
      >().toEqualTypeOf<{
        text: string;
        maxCount?: number | null | undefined;
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof serializeSchema>
      >().toEqualTypeOf<{
        text: string;
        maxCount?: number | null | undefined;
      }>();
    });
    await t.test("validateSync", () => {
      {
        const result = validateSync(serializeSchema, {
          text: "Han",
          maxCount: null,
        });
        assert.deepStrictEqual(result, {
          value: {
            maxCount: null,
            text: "Han",
          },
        });
      }
      {
        const result = validateSync(serializeSchema, {
          text: "Han",
          maxCount: 5,
        });
        assert.deepStrictEqual(result, {
          value: {
            maxCount: 5,
            text: "Han",
          },
        });
      }
      {
        const result = validateSync(serializeSchema, {
          text: null,
          maxCount: null,
        });
        assert.deepStrictEqual(result, {
          issues: [
            {
              message: "Expected value to be non-null.",
              path: ["text"],
            },
          ],
        });
      }
    });
  });
  await t.test("JSON schema", (t) => {
    const { serializedJsonSchema, deserializedJsonSchema } =
      getBidirectionalJsonSchemas(variablesSchema);
    t.assert.deepEqual(serializedJsonSchema, deserializedJsonSchema);
    {
      const result = validateWithAjv(serializedJsonSchema, {
        text: "Han",
        maxCount: null,
      });
      t.assert.equal(result.valid, true);
    }
    {
      const result = validateWithAjv(serializedJsonSchema, {
        text: "Han",
        maxCount: 5,
      });
      t.assert.equal(result.valid, true);
    }
    {
      const result = validateWithAjv(serializedJsonSchema, {
        text: null,
        maxCount: null,
      });
      t.assert.equal(result.valid, false);
    }
    t.assert.snapshot(serializedJsonSchema);
  });
});

test("handles basic scalar types", async (t) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(/**GraphQL*/ `
      type Query {
        mixed(int: Int, num: Float, str: String, bool: Boolean, id: ID): String
      }
    `),
  });
  const variablesSchema = generator.getVariablesSchema(
    gql<
      { mixed: string },
      {
        int: number;
        num: number;
        str: string;
        bool: boolean;
        id: string | number;
      }
    >(/** GraphQL */ `
      query Search($int: Int, $num: Float, $str: String, $bool: Boolean, $id: ID) {
        mixed(int: $int, num: $num, str: $str, bool: $bool, id: $id)
      }
    `)
  );
  await t.test("normalize", async (t) => {
    t.assert.equal(variablesSchema, variablesSchema.normalize);
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof variablesSchema>
      >().toEqualTypeOf<{
        int: number;
        num: number;
        str: string;
        bool: boolean;
        id: string | number;
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof variablesSchema>
      >().toEqualTypeOf<{
        int: number;
        num: number;
        str: string;
        bool: boolean;
        id: string | number;
      }>();
    });
    await t.test("validateSync", () => {
      {
        const result = validateSync(variablesSchema, {
          int: 5,
          num: 3.14,
          str: "Hello",
          bool: true,
          id: 123,
        });
        assert.deepStrictEqual(result, {
          value: {
            int: 5,
            num: 3.14,
            str: "Hello",
            bool: true,
            id: "123",
          },
        });
      }
      {
        const result = validateSync(variablesSchema, {
          int: 5.12,
          num: 3.14,
          str: "Hello",
          bool: true,
          id: "foo",
        });
        assert.deepStrictEqual(result, {
          issues: [
            {
              message: "Int cannot represent non-integer value: 5.12",
              path: ["int"],
            },
          ],
        });
      }
    });
  });
  await t.test("deserialize", async (t) => {
    const deserializeSchema = variablesSchema.deserialize;
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof deserializeSchema>
      >().toEqualTypeOf<{
        int: number;
        num: number;
        str: string;
        bool: boolean;
        id: string | number;
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof deserializeSchema>
      >().toEqualTypeOf<{
        int: number;
        num: number;
        str: string;
        bool: boolean;
        id: string | number;
      }>();
    });
    await t.test("validateSync", () => {
      {
        const result = validateSync(deserializeSchema, {
          int: 5,
          num: 3.14,
          str: "Hello",
          bool: true,
          id: 123,
        });
        assert.deepStrictEqual(result, {
          value: {
            int: 5,
            num: 3.14,
            str: "Hello",
            bool: true,
            id: "123",
          },
        });
      }
      {
        const result = validateSync(deserializeSchema, {
          int: 5.12,
          num: 3.14,
          str: "Hello",
          bool: true,
          id: "foo",
        });
        assert.deepStrictEqual(result, {
          issues: [
            {
              message: "Int cannot represent non-integer value: 5.12",
              path: ["int"],
            },
          ],
        });
      }
    });
  });
  await t.test("serialize", async (t) => {
    const serializeSchema = variablesSchema.serialize;
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof serializeSchema>
      >().toEqualTypeOf<{
        int: number;
        num: number;
        str: string;
        bool: boolean;
        id: string | number;
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof serializeSchema>
      >().toEqualTypeOf<{
        int: number;
        num: number;
        str: string;
        bool: boolean;
        id: string | number;
      }>();
    });
    await t.test("validateSync", () => {
      {
        const result = validateSync(serializeSchema, {
          int: 5,
          num: 3.14,
          str: "Hello",
          bool: true,
          id: 123,
        });
        assert.deepStrictEqual(result, {
          value: {
            int: 5,
            num: 3.14,
            str: "Hello",
            bool: true,
            id: "123",
          },
        });
      }
      {
        const result = validateSync(serializeSchema, {
          int: 5.12,
          num: 3.14,
          str: "Hello",
          bool: true,
          id: "foo",
        });
        assert.deepStrictEqual(result, {
          issues: [
            {
              message: "Int cannot represent non-integer value: 5.12",
              path: ["int"],
            },
          ],
        });
      }
    });
  });
  await t.test("JSON schema", (t) => {
    const { serializedJsonSchema, deserializedJsonSchema } =
      getBidirectionalJsonSchemas(variablesSchema);
    t.assert.deepEqual(serializedJsonSchema, deserializedJsonSchema);
    {
      const result = validateWithAjv(serializedJsonSchema, {
        int: 5,
        num: 3.14,
        str: "Hello",
        bool: true,
      });
      t.assert.equal(result.valid, true);
    }
    {
      const result = validateWithAjv(serializedJsonSchema, {
        int: 5.12,
        num: 3.14,
        str: "Hello",
        bool: true,
      });
      t.assert.equal(result.valid, false);
    }
    t.assert.snapshot(serializedJsonSchema);
  });
});

test("handles variable-level list types", async (t) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(/**GraphQL*/ `
      type Query {
        mixed(required: [String!]!, mixed: [String]!, optional: [String]): String
      }
    `),
  });
  const variablesSchema = generator.getVariablesSchema(
    gql<
      { mixed: string },
      {
        required: string[];
        mixed: (string | null)[];
        optional?: (string | null)[];
      }
    >(/** GraphQL */ `
      query Search($required: [String!]!, $mixed: [String]!, $optional: [String]) {
        mixed(required: $required, mixed: $mixed, optional: $optional)
      }
    `)
  );
  await t.test("normalize", async (t) => {
    t.assert.equal(variablesSchema, variablesSchema.normalize);
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof variablesSchema>
      >().toEqualTypeOf<{
        required: string[];
        mixed: (string | null)[];
        optional?: (string | null)[];
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof variablesSchema>
      >().toEqualTypeOf<{
        required: string[];
        mixed: (string | null)[];
        optional?: (string | null)[];
      }>();
    });
    await t.test("validateSync", () => {
      {
        const result = validateSync(variablesSchema, {
          required: ["a", "b"],
          mixed: ["c", null, "d"],
          optional: null,
        });
        assert.deepStrictEqual(result, {
          value: {
            required: ["a", "b"],
            mixed: ["c", null, "d"],
            optional: null,
          },
        });
      }
      {
        const result = validateSync(variablesSchema, {
          required: ["a", null],
          optional: ["e", "f"],
        });
        assert.deepStrictEqual(result, {
          issues: [
            {
              message: "Expected value to be non-null.",
              path: ["required", 1],
            },
            {
              message: "Expected value to be non-null.",
              path: ["mixed"],
            },
          ],
        });
      }
    });
  });
  await t.test("deserialize", async (t) => {
    const deserializeSchema = variablesSchema.deserialize;
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof deserializeSchema>
      >().toEqualTypeOf<{
        required: string[];
        mixed: (string | null)[];
        optional?: (string | null)[];
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof deserializeSchema>
      >().toEqualTypeOf<{
        required: string[];
        mixed: (string | null)[];
        optional?: (string | null)[];
      }>();
    });
    await t.test("validateSync", () => {
      {
        const result = validateSync(deserializeSchema, {
          required: ["a", "b"],
          mixed: ["c", null, "d"],
          optional: null,
        });
        assert.deepStrictEqual(result, {
          value: {
            required: ["a", "b"],
            mixed: ["c", null, "d"],
            optional: null,
          },
        });
      }
      {
        const result = validateSync(deserializeSchema, {
          required: ["a", null],
          optional: ["e", "f"],
        });
        assert.deepStrictEqual(result, {
          issues: [
            {
              message: "Expected value to be non-null.",
              path: ["required", 1],
            },
            {
              message: "Expected value to be non-null.",
              path: ["mixed"],
            },
          ],
        });
      }
    });
  });
  await t.test("serialize", async (t) => {
    const serializeSchema = variablesSchema.serialize;
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof serializeSchema>
      >().toEqualTypeOf<{
        required: string[];
        mixed: (string | null)[];
        optional?: (string | null)[];
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof serializeSchema>
      >().toEqualTypeOf<{
        required: string[];
        mixed: (string | null)[];
        optional?: (string | null)[];
      }>();
    });
    await t.test("validateSync", () => {
      {
        const result = validateSync(serializeSchema, {
          required: ["a", "b"],
          mixed: ["c", null, "d"],
          optional: null,
        });
        assert.deepStrictEqual(result, {
          value: {
            required: ["a", "b"],
            mixed: ["c", null, "d"],
            optional: null,
          },
        });
      }
      {
        const result = validateSync(serializeSchema, {
          required: ["a", null],
          optional: ["e", "f"],
        });
        assert.deepStrictEqual(result, {
          issues: [
            {
              message: "Expected value to be non-null.",
              path: ["required", 1],
            },
            {
              message: "Expected value to be non-null.",
              path: ["mixed"],
            },
          ],
        });
      }
    });
  });
  await t.test("JSON schema", (t) => {
    const { serializedJsonSchema, deserializedJsonSchema } =
      getBidirectionalJsonSchemas(variablesSchema);
    t.assert.deepEqual(serializedJsonSchema, deserializedJsonSchema);
    {
      const result = validateWithAjv(serializedJsonSchema, {
        required: ["a", "b"],
        mixed: ["c", null, "d"],
        optional: null,
      });
      t.assert.equal(result.valid, true);
    }
    {
      const result = validateWithAjv(serializedJsonSchema, {
        required: ["a", null],
        optional: ["e", "f"],
      });
      t.assert.equal(result.valid, false);
    }
    t.assert.snapshot(serializedJsonSchema);
  });
});

test("handles enums", async (t) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(/**GraphQL*/ `
      enum MediaKind {
        MOVIE
        SERIES
      }
      type Query {
        searchMovie(text: String!, kind: MediaKind!): [String]
      }
    `),
  });
  const variablesSchema = generator.getVariablesSchema(
    gql<
      { searchMovie: string[] },
      { text: string; kind: "MOVIE" | "SERIES" }
    >(/** GraphQL */ `
      query Search($text: String!, $kind: MediaKind!) {
        searchMovie(text: $text, kind: $kind)
      }
    `)
  );
  await t.test("normalize", async (t) => {
    t.assert.equal(variablesSchema, variablesSchema.normalize);
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof variablesSchema>
      >().toEqualTypeOf<{
        text: string;
        kind: "MOVIE" | "SERIES";
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof variablesSchema>
      >().toEqualTypeOf<{
        text: string;
        kind: "MOVIE" | "SERIES";
      }>();
    });
    await t.test("validateSync", () => {
      {
        const result = validateSync(variablesSchema, {
          text: "Han",
          kind: "MOVIE",
        });
        assert.deepStrictEqual(result, {
          value: { text: "Han", kind: "MOVIE" },
        });
      }
      {
        const result = validateSync(variablesSchema, {
          text: "Han",
          kind: "WRONG",
        });
        assert.deepStrictEqual(result, {
          issues: [
            {
              message: 'Value "WRONG" does not exist in "MediaKind" enum.',
              path: ["kind"],
            },
          ],
        });
      }
    });
  });
  await t.test("deserialize", async (t) => {
    const deserializeSchema = variablesSchema.deserialize;
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof deserializeSchema>
      >().toEqualTypeOf<{
        text: string;
        kind: "MOVIE" | "SERIES";
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof deserializeSchema>
      >().toEqualTypeOf<{
        text: string;
        kind: "MOVIE" | "SERIES";
      }>();
    });
    await t.test("validateSync", () => {
      {
        const result = validateSync(deserializeSchema, {
          text: "Han",
          kind: "MOVIE",
        });
        assert.deepStrictEqual(result, {
          value: { text: "Han", kind: "MOVIE" },
        });
      }
      {
        const result = validateSync(deserializeSchema, {
          text: "Han",
          kind: "WRONG",
        });
        assert.deepStrictEqual(result, {
          issues: [
            {
              message: 'Value "WRONG" does not exist in "MediaKind" enum.',
              path: ["kind"],
            },
          ],
        });
      }
    });
  });
  await t.test("serialize", async (t) => {
    const serializeSchema = variablesSchema.serialize;
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof serializeSchema>
      >().toEqualTypeOf<{
        text: string;
        kind: "MOVIE" | "SERIES";
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof serializeSchema>
      >().toEqualTypeOf<{
        text: string;
        kind: "MOVIE" | "SERIES";
      }>();
    });
    await t.test("validateSync", () => {
      {
        const result = validateSync(serializeSchema, {
          text: "Han",
          kind: "MOVIE",
        });
        assert.deepStrictEqual(result, {
          value: { text: "Han", kind: "MOVIE" },
        });
      }
      {
        const result = validateSync(serializeSchema, {
          text: "Han",
          kind: "WRONG",
        });
        assert.deepStrictEqual(result, {
          issues: [
            {
              message: 'Enum "MediaKind" cannot represent value: "WRONG"',
              path: ["kind"],
            },
          ],
        });
      }
    });
  });
  await t.test("JSON schema", (t) => {
    const { serializedJsonSchema, deserializedJsonSchema } =
      getBidirectionalJsonSchemas(variablesSchema);
    t.assert.deepEqual(serializedJsonSchema, deserializedJsonSchema);
    {
      const result = validateWithAjv(serializedJsonSchema, {
        text: "Han",
        kind: "MOVIE",
      });
      t.assert.equal(result.valid, true);
    }
    {
      const result = validateWithAjv(serializedJsonSchema, {
        text: "Han",
        kind: "WRONG",
      });
      t.assert.equal(result.valid, false);
    }
    t.assert.snapshot(serializedJsonSchema);
  });
});

test("handles custom scalars", async (t) => {
  const schema = buildSchema(/**GraphQL*/ `
      scalar Date
      type Query {
        searchEvent(after: Date!, before: Date!): [String]
      }
    `);
  const generator = new GraphQLStandardSchemaGenerator({
    schema,
    scalarTypes: {
      Date: DateScalarDef,
    },
  });
  const variablesSchema = generator.getVariablesSchema(
    gql<
      { searchEvent: string[] },
      { before: Date; after: Date }
    >(/** GraphQL */ `
      query Search($after: Date!, $before: Date!) {
        searchEvent(after: $after, before: $before)
      }
    `)
  );
  await t.test("normalize", async (t) => {
    t.assert.equal(variablesSchema, variablesSchema.normalize);
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof variablesSchema>
      >().toEqualTypeOf<{
        after: string;
        before: string;
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof variablesSchema>
      >().toEqualTypeOf<{
        after: string;
        before: string;
      }>();
    });
    await t.test("validateSync", () => {
      {
        const result = validateSync(variablesSchema, {
          after: "Jan 1 2023 UTC",
          before: "2023-12-31",
        });
        assert.deepStrictEqual(result, {
          value: {
            after: "2023-01-01",
            before: "2023-12-31",
          },
        });
      }
      {
        const result = validateSync(variablesSchema, {
          after: "2023-01-01",
          before: "foobar",
        });
        assert.deepStrictEqual(result, {
          issues: [
            {
              message: "Value is not a valid Date string: foobar",
              path: ["before"],
            },
          ],
        });
      }
    });
  });
  await t.test("deserialize", async (t) => {
    const deserializeSchema = variablesSchema.deserialize;
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof deserializeSchema>
      >().toEqualTypeOf<{
        after: string;
        before: string;
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof deserializeSchema>
      >().toEqualTypeOf<{
        after: Date;
        before: Date;
      }>();
    });
    await t.test("validateSync", () => {
      {
        const result = validateSync(deserializeSchema, {
          after: "2023-01-01",
          before: "2023-12-31",
        });
        assert.deepStrictEqual(result, {
          value: {
            after: new Date("2023-01-01"),
            before: new Date("2023-12-31"),
          },
        });
      }
      {
        const result = validateSync(deserializeSchema, {
          after: "2023-01-01",
          before: "foobar",
        });
        assert.deepStrictEqual(result, {
          issues: [
            {
              message: "Value is not a valid Date string: foobar",
              path: ["before"],
            },
          ],
        });
      }
    });
  });
  await t.test("serialize", async (t) => {
    const serializeSchema = variablesSchema.serialize;
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof serializeSchema>
      >().toEqualTypeOf<{
        after: Date;
        before: Date;
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof serializeSchema>
      >().toEqualTypeOf<{
        after: string;
        before: string;
      }>();
    });
    await t.test("validateSync", () => {
      {
        const result = validateSync(serializeSchema, {
          after: new Date("2023-01-01"),
          before: new Date("2023-12-31"),
        });
        assert.deepStrictEqual(result, {
          value: {
            after: "2023-01-01",
            before: "2023-12-31",
          },
        });
      }
      {
        const result = validateSync(serializeSchema, {
          after: new Date("2023-01-01"),
          before: "foobar",
        });
        assert.deepStrictEqual(result, {
          issues: [
            {
              message: "Value is not a valid Date object: foobar",
              path: ["before"],
            },
          ],
        });
      }
    });
  });
  await t.test("JSON schema", (t) => {
    const {
      serializedJsonSchema,
      // TODO test backwards direction too
      deserializedJsonSchema,
    } = getBidirectionalJsonSchemas(variablesSchema);

    {
      const result = validateWithAjv(serializedJsonSchema, {
        after: "2023-01-01",
        before: "2023-12-31",
      });
      t.assert.equal(result.valid, true);
    }
    {
      const result = validateWithAjv(serializedJsonSchema, {
        after: "2023-01-01",
        before: "foobar",
      });
      t.assert.equal(result.valid, false);
    }
    t.assert.snapshot(serializedJsonSchema);
  });
});

test("handles input types", async (t) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(/**GraphQL*/ `
      scalar Date
      input EventSearchInput {
        after: Date
        before: Date
        city: String!
      }
      type Query {
        searchEvent(input: EventSearchInput!): [String]
      }
    `),
    scalarTypes: {
      Date: DateScalarDef,
    },
  });
  const variablesSchema = generator.getVariablesSchema(
    gql<
      { searchEvent: string[] },
      { input: { city: string; before?: Date; after?: Date } }
    >(/** GraphQL */ `
      query Search($input: EventSearchInput!) {
        searchEvent(input: $input)
      }
    `)
  );

  await t.test("normalize", async (t) => {
    t.assert.equal(variablesSchema, variablesSchema.normalize);
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof variablesSchema>
      >().toEqualTypeOf<{
        input: { city: string; before?: string; after?: string };
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof variablesSchema>
      >().toEqualTypeOf<{
        input: { city: string; before?: string; after?: string };
      }>();
    });
    await t.test("validateSync", () => {
      {
        const result = validateSync(variablesSchema, {
          input: {
            city: "New York",
            after: "2023-01-01",
            before: null,
          },
        });
        assert.deepStrictEqual(result, {
          value: {
            input: {
              city: "New York",
              after: "2023-01-01",
              before: null,
            },
          },
        });
      }
      {
        const result = validateSync(variablesSchema, {
          input: {
            city: 5,
            after: "2023-01-01",
            before: null,
          },
        });
        assert.deepStrictEqual(result, {
          issues: [
            {
              message: "String cannot represent a non string value: 5",
              path: ["input", "city"],
            },
          ],
        });
      }
    });
  });
  await t.test("deserialize", async (t) => {
    const deserializeSchema = variablesSchema.deserialize;
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof deserializeSchema>
      >().toEqualTypeOf<{
        input: { city: string; before?: string; after?: string };
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof deserializeSchema>
      >().toEqualTypeOf<{
        input: { city: string; before?: Date; after?: Date };
      }>();
    });
    await t.test("validateSync", () => {
      {
        const result = validateSync(deserializeSchema, {
          input: {
            city: "New York",
            after: "2023-01-01",
            before: null,
          },
        });
        assert.deepStrictEqual(result, {
          value: {
            input: {
              city: "New York",
              after: new Date("2023-01-01"),
              before: null,
            },
          },
        });
      }
      {
        const result = validateSync(deserializeSchema, {
          input: {
            city: 5,
            after: "2023-01-01",
            before: null,
          },
        });
        assert.deepStrictEqual(result, {
          issues: [
            {
              message: "String cannot represent a non string value: 5",
              path: ["input", "city"],
            },
          ],
        });
      }
    });
  });
  await t.test("serialize", async (t) => {
    const serializeSchema = variablesSchema.serialize;
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof serializeSchema>
      >().toEqualTypeOf<{
        input: { city: string; before?: Date; after?: Date };
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof serializeSchema>
      >().toEqualTypeOf<{
        input: { city: string; before?: string; after?: string };
      }>();
    });
    await t.test("validateSync", () => {
      {
        const result = validateSync(serializeSchema, {
          input: {
            city: "New York",
            after: new Date("2023-01-01"),
            before: null,
          },
        });
        assert.deepStrictEqual(result, {
          value: {
            input: {
              city: "New York",
              after: "2023-01-01",
              before: null,
            },
          },
        });
      }
      {
        const result = validateSync(serializeSchema, {
          input: {
            city: 5,
            after: new Date("2023-01-01"),
            before: null,
          },
        });
        assert.deepStrictEqual(result, {
          value: {
            input: {
              city: "5",
              after: "2023-01-01",
              before: null,
            },
          },
        });
      }
      {
        const result = validateSync(serializeSchema, {
          input: {
            city: "New York",
            after: "2023-01-01",
            before: null,
          },
        });
        assert.deepStrictEqual(result, {
          issues: [
            {
              message: "Value is not a valid Date object: 2023-01-01",
              path: ["input", "after"],
            },
          ],
        });
      }
    });
  });
  await t.test("JSON schema", (t) => {
    const {
      serializedJsonSchema,
      // TODO test backwards direction too
      deserializedJsonSchema,
    } = getBidirectionalJsonSchemas(variablesSchema);
    {
      const result = validateWithAjv(serializedJsonSchema, {
        input: {
          city: "New York",
          after: "2023-01-01",
          before: null,
        },
      });
      t.assert.equal(result.valid, true);
    }
    {
      const result = validateWithAjv(serializedJsonSchema, {
        input: {
          city: 5,
          after: "2023-01-01",
          before: null,
        },
      });
      t.assert.equal(result.valid, false);
    }
    t.assert.snapshot(serializedJsonSchema);
  });
});

test("handles recursive input types", async (t) => {
  const schema = buildSchema(/**GraphQL*/ `
      scalar Date
      input FilterInput {
        and: [FilterInput!]
        or: [FilterInput!]
        not: FilterInput
        after: Date
        before: Date
        city: String
      }
      type Query {
        searchEvent(input: FilterInput!): [String]
      }
    `);
  const scalarTypes = {
    Date: DateScalarDef,
  } as const;

  const generator = new GraphQLStandardSchemaGenerator({
    schema,
    scalarTypes,
  });
  const openAIGenerator = new GraphQLStandardSchemaGenerator({
    schema,
    scalarTypes,
    defaultJSONSchemaOptions: "OpenAI",
  });
  interface FilterInput {
    and: FilterInput[] | null;
    or: FilterInput[] | null;
    not: FilterInput | null;
    after: Date | null;
    before: Date | null;
    city: string | null;
  }
  const variablesSchema = generator.getVariablesSchema(
    gql<{ searchEvent: string[] }, { input: FilterInput }>(/** GraphQL */ `
      query Search($input: FilterInput!) {
        searchEvent(input: $input)
      }
    `)
  );

  const openAISchema = openAIGenerator.getVariablesSchema(
    gql<{ searchEvent: string[] }, { input: FilterInput }>(/** GraphQL */ `
      query Search($input: FilterInput!) {
        searchEvent(input: $input)
      }
    `)
  );

  type SerializedType = StandardSchemaV1.InferInput<
    typeof variablesSchema.deserialize
  >;
  type DeserializedType = StandardSchemaV1.InferOutput<
    typeof variablesSchema.deserialize
  >;

  const fullFilterInputSerialized: SerializedType["input"] = {
    city: "New York",
    and: [
      {
        after: "2023-01-01",
        and: null,
        or: null,
        not: null,
        before: null,
        city: null,
      },
      {
        not: {
          after: "2023-12-31",
          and: null,
          or: null,
          not: null,
          before: null,
          city: null,
        },
        and: null,
        or: null,
        before: null,
        after: null,
        city: null,
      },
    ],
    or: null,
    not: null,
    after: null,
    before: null,
  };
  const fullFilterInputDeserialized: DeserializedType["input"] = {
    city: "New York",
    and: [
      {
        after: new Date("2023-01-01"),
        and: null,
        or: null,
        not: null,
        before: null,
        city: null,
      },
      {
        not: {
          after: new Date("2023-12-31"),
          and: null,
          or: null,
          not: null,
          before: null,
          city: null,
        },
        and: null,
        or: null,
        before: null,
        after: null,
        city: null,
      },
    ],
    or: null,
    not: null,
    after: null,
    before: null,
  };
  const partialFilterInputSerialized = {
    city: "New York",
    and: [
      {
        after: "2023-01-01",
      },
      {
        not: {
          after: "2023-12-31",
        },
      },
    ],
  } as const;
  const partialFilterInputDeserialized = {
    city: "New York",
    and: [
      {
        after: new Date("2023-01-01"),
      },
      {
        not: {
          after: new Date("2023-12-31"),
        },
      },
    ],
  } as const;

  await t.test("normalize", async (t) => {
    t.assert.equal(variablesSchema, variablesSchema.normalize);
    t.assert.equal(openAISchema, openAISchema.normalize);

    await t.test("validateSync", () => {
      {
        const result = validateSync(variablesSchema, {
          input: fullFilterInputSerialized,
        });
        assert.deepStrictEqual(result, {
          value: { input: fullFilterInputSerialized },
        });
      }
      {
        const result = validateSync(openAISchema, {
          input: fullFilterInputSerialized,
        });
        assert.deepStrictEqual(result, {
          value: { input: fullFilterInputSerialized },
        });
      }
      {
        const result = validateSync(variablesSchema, {
          input: partialFilterInputSerialized,
        });
        assert.deepStrictEqual(result, {
          value: { input: partialFilterInputSerialized },
        });
      }
      {
        // will only create a different JSON schema, but behave the same as `variablesSchema` in runtime
        const result = validateSync(openAISchema, {
          input: partialFilterInputSerialized,
        });
        assert.deepStrictEqual(result, {
          value: { input: partialFilterInputSerialized },
        });
      }
    });
  });
  await t.test("deserialize", async (t) => {
    const deserializeSchema = variablesSchema.deserialize;
    const deserializeOpenAISchema = openAISchema.deserialize;

    await t.test("validateSync", () => {
      {
        const result = validateSync(deserializeSchema, {
          input: fullFilterInputSerialized,
        });
        assert.deepStrictEqual(result, {
          value: { input: fullFilterInputDeserialized },
        });
      }
      {
        const result = validateSync(deserializeOpenAISchema, {
          input: fullFilterInputSerialized,
        });
        assert.deepStrictEqual(result, {
          value: { input: fullFilterInputDeserialized },
        });
      }
      {
        const result = validateSync(deserializeSchema, {
          input: partialFilterInputSerialized,
        });
        assert.deepStrictEqual(result, {
          value: { input: partialFilterInputDeserialized },
        });
      }
      {
        // will only create a different JSON schema, but behave the same as `variablesSchema` in runtime
        const result = validateSync(deserializeOpenAISchema, {
          input: partialFilterInputSerialized,
        });
        assert.deepStrictEqual(result, {
          value: { input: partialFilterInputDeserialized },
        });
      }
    });
  });
  await t.test("serialize", async (t) => {
    const serializeSchema = variablesSchema.serialize;
    const serializeOpenAISchema = openAISchema.serialize;

    await t.test("validateSync", () => {
      {
        const result = validateSync(serializeSchema, {
          input: fullFilterInputDeserialized,
        });
        assert.deepStrictEqual(result, {
          value: { input: fullFilterInputSerialized },
        });
      }
      {
        const result = validateSync(serializeOpenAISchema, {
          input: fullFilterInputDeserialized,
        });
        assert.deepStrictEqual(result, {
          value: { input: fullFilterInputSerialized },
        });
      }
      {
        const result = validateSync(serializeSchema, {
          input: partialFilterInputDeserialized,
        });
        assert.deepStrictEqual(result, {
          value: { input: partialFilterInputSerialized },
        });
      }
      {
        // will only create a different JSON schema, but behave the same as `variablesSchema` in runtime
        const result = validateSync(serializeOpenAISchema, {
          input: partialFilterInputDeserialized,
        });
        assert.deepStrictEqual(result, {
          value: { input: partialFilterInputSerialized },
        });
      }
    });
  });

  await t.test("JSON schema", (t) => {
    const {
      serializedJsonSchema: jsonSchema,
      // TODO test backwards direction too
      deserializedJsonSchema: _1,
    } = getBidirectionalJsonSchemas(variablesSchema);
    const {
      serializedJsonSchema: openAIJsonSchema,
      // TODO test backwards direction too
      deserializedJsonSchema: _2,
    } = getBidirectionalJsonSchemas(openAISchema);
    {
      const result = validateWithAjv(jsonSchema, {
        input: fullFilterInputSerialized,
      });
      t.assert.equal(result.valid, true);
    }
    {
      const result = validateWithAjv(openAIJsonSchema, {
        input: fullFilterInputSerialized,
      });
      t.assert.equal(result.valid, true);
    }
    {
      const result = validateWithAjv(jsonSchema, {
        input: partialFilterInputSerialized,
      });
      t.assert.equal(result.valid, true);
    }
    {
      const result = validateWithAjv(openAIJsonSchema, {
        input: partialFilterInputSerialized,
      });
      t.assert.equal(result.valid, false);
    }
    t.assert.snapshot(jsonSchema);
    t.assert.snapshot(openAIJsonSchema);
  });
});
