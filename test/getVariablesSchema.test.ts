import { test } from "node:test";

import { GraphQLStandardSchemaGenerator, toJSONSchema } from "../src/index.ts";
import { gql, validateSync, validateWithAjv } from "./utils/test-helpers.ts";
import { buildSchema } from "graphql";
import assert from "node:assert";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { expectTypeOf } from "expect-type";
import { DateScalarDef } from "./utils/DateScalarDef.ts";

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
  await t.test("JSON schema", (t) => {
    const jsonSchema = toJSONSchema.input(variablesSchema);
    {
      const result = validateWithAjv(jsonSchema, {
        text: "Han",
        maxCount: null,
      });
      t.assert.equal(result.valid, true);
    }
    {
      const result = validateWithAjv(jsonSchema, { text: "Han", maxCount: 5 });
      t.assert.equal(result.valid, true);
    }
    {
      const result = validateWithAjv(jsonSchema, {
        text: null,
        maxCount: null,
      });
      t.assert.equal(result.valid, false);
    }
    t.assert.snapshot(jsonSchema);
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
  await t.test("JSON schema", (t) => {
    const jsonSchema = toJSONSchema.input(variablesSchema);
    {
      const result = validateWithAjv(jsonSchema, {
        int: 5,
        num: 3.14,
        str: "Hello",
        bool: true,
      });
      t.assert.equal(result.valid, true);
    }
    {
      const result = validateWithAjv(jsonSchema, {
        int: 5.12,
        num: 3.14,
        str: "Hello",
        bool: true,
      });
      t.assert.equal(result.valid, false);
    }
    t.assert.snapshot(jsonSchema);
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
  await t.test("JSON schema", (t) => {
    const jsonSchema = toJSONSchema.input(variablesSchema);
    {
      const result = validateWithAjv(jsonSchema, {
        required: ["a", "b"],
        mixed: ["c", null, "d"],
        optional: null,
      });
      t.assert.equal(result.valid, true);
    }
    {
      const result = validateWithAjv(jsonSchema, {
        required: ["a", null],
        optional: ["e", "f"],
      });
      t.assert.equal(result.valid, false);
    }
    t.assert.snapshot(jsonSchema);
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
  await t.test("JSON schema", (t) => {
    const jsonSchema = toJSONSchema.input(variablesSchema);
    {
      const result = validateWithAjv(jsonSchema, {
        text: "Han",
        kind: "MOVIE",
      });
      t.assert.equal(result.valid, true);
    }
    {
      const result = validateWithAjv(jsonSchema, {
        text: "Han",
        kind: "WRONG",
      });
      t.assert.equal(result.valid, false);
    }
    t.assert.snapshot(jsonSchema);
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
  await t.test("JSON schema", (t) => {
    const jsonSchema = toJSONSchema.input(variablesSchema);
    {
      const result = validateWithAjv(jsonSchema, {
        after: "2023-01-01",
        before: "2023-12-31",
      });
      t.assert.equal(result.valid, true);
    }
    {
      const result = validateWithAjv(jsonSchema, {
        after: "2023-01-01",
        before: "foobar",
      });
      t.assert.equal(result.valid, false);
    }
    t.assert.snapshot(jsonSchema);
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
  await t.test("JSON schema", (t) => {
    const jsonSchema = toJSONSchema.input(variablesSchema);
    {
      const result = validateWithAjv(jsonSchema, {
        input: {
          city: "New York",
          after: "2023-01-01",
          before: null,
        },
      });
      t.assert.equal(result.valid, true);
    }
    {
      const result = validateWithAjv(jsonSchema, {
        input: {
          city: 5,
          after: "2023-01-01",
          before: null,
        },
      });
      t.assert.equal(result.valid, false);
    }
    t.assert.snapshot(jsonSchema);
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

  const fullFilterInput: SerializedType["input"] = {
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
  const fullFilterInputResult: DeserializedType["input"] = {
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
  const partialFilterInput = {
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
  const partialFilterInputResult = {
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

  await t.test("deserialize", async (t) => {
    const deserializeSchema = variablesSchema.deserialize;
    const deserializeOpenAISchema = openAISchema.deserialize;

    await t.test("validateSync", () => {
      {
        const result = validateSync(deserializeSchema, {
          input: fullFilterInput,
        });
        assert.deepStrictEqual(result, {
          value: { input: fullFilterInputResult },
        });
      }
      {
        const result = validateSync(deserializeOpenAISchema, {
          input: fullFilterInput,
        });
        assert.deepStrictEqual(result, {
          value: { input: fullFilterInputResult },
        });
      }
      {
        const result = validateSync(deserializeSchema, {
          input: partialFilterInput,
        });
        assert.deepStrictEqual(result, {
          value: { input: partialFilterInputResult },
        });
      }
      {
        // will only create a different JSON schema, but behave the same as `variablesSchema` in runtime
        const result = validateSync(deserializeOpenAISchema, {
          input: partialFilterInput,
        });
        assert.deepStrictEqual(result, {
          value: { input: partialFilterInputResult },
        });
      }
    });
  });
  await t.test("JSON schema", (t) => {
    const openAIJsonSchema = toJSONSchema.input(openAISchema);
    const jsonSchema = toJSONSchema.input(variablesSchema);
    {
      const result = validateWithAjv(jsonSchema, {
        input: fullFilterInput,
      });
      t.assert.equal(result.valid, true);
    }
    {
      const result = validateWithAjv(openAIJsonSchema, {
        input: fullFilterInput,
      });
      t.assert.equal(result.valid, true);
    }
    {
      const result = validateWithAjv(jsonSchema, {
        input: partialFilterInput,
      });
      t.assert.equal(result.valid, true);
    }
    {
      const result = validateWithAjv(openAIJsonSchema, {
        input: partialFilterInput,
      });
      t.assert.equal(result.valid, false);
    }
    t.assert.snapshot(jsonSchema);
    t.assert.snapshot(openAIJsonSchema);
  });
});
