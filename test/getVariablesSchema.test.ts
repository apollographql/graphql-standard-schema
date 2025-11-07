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
            message:
              'Variable "$text" of non-null type "String!" must not be null.',
          },
        ],
      });
    }
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
            message:
              'Variable "$int" got invalid value 5.12; Int cannot represent non-integer value: 5.12',
          },
        ],
      });
    }
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
            message:
              'Variable "$required" got invalid value null at "required[1]"; Expected non-nullable type "String!" not to be null.',
          },
          {
            message:
              'Variable "$mixed" of required type "[String]!" was not provided.',
          },
        ],
      });
    }
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
      assert.deepStrictEqual(result, { value: { text: "Han", kind: "MOVIE" } });
    }
    {
      const result = validateSync(variablesSchema, {
        text: "Han",
        kind: "WRONG",
      });
      assert.deepStrictEqual(result, {
        issues: [
          {
            message:
              'Variable "$kind" got invalid value "WRONG"; Value "WRONG" does not exist in "MediaKind" enum.',
          },
        ],
      });
    }
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
      after: Date;
      before: Date;
    }>();
  });
  await t.test("validateSync", () => {
    {
      const result = validateSync(variablesSchema, {
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
      const result = validateSync(variablesSchema, {
        after: "2023-01-01",
        before: "foobar",
      });
      assert.deepStrictEqual(result, {
        issues: [
          {
            message:
              'Variable "$before" got invalid value "foobar"; Expected type "Date". Value is not a valid Date string: foobar',
          },
        ],
      });
    }
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

  await t.test("types", () => {
    expectTypeOf<
      StandardSchemaV1.InferInput<typeof variablesSchema>
    >().toEqualTypeOf<{
      input: { city: string; before?: string; after?: string };
    }>();
    expectTypeOf<
      StandardSchemaV1.InferOutput<typeof variablesSchema>
    >().toEqualTypeOf<{
      input: { city: string; before?: Date; after?: Date };
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
            after: new Date("2023-01-01"),
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
            message:
              'Variable "$input" got invalid value 5 at "input.city"; String cannot represent a non string value: 5',
          },
        ],
      });
    }
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

  type InputType = StandardSchemaV1.InferInput<typeof variablesSchema>;
  type OutputType = StandardSchemaV1.InferOutput<typeof variablesSchema>;
  const fullFilterInput: InputType["input"] = {
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
  const fullFilterInputResult: OutputType["input"] = {
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

  await t.test("validateSync", () => {
    {
      const result = validateSync(variablesSchema, {
        input: fullFilterInput,
      });
      assert.deepStrictEqual(result, {
        value: { input: fullFilterInputResult },
      });
    }
    {
      const result = validateSync(openAISchema, {
        input: fullFilterInput,
      });
      assert.deepStrictEqual(result, {
        value: { input: fullFilterInputResult },
      });
    }
    {
      const result = validateSync(variablesSchema, {
        input: partialFilterInput,
      });
      assert.deepStrictEqual(result, {
        value: { input: partialFilterInputResult },
      });
    }
    {
      // will only create a different JSON schema, but behave the same as `variablesSchema` in runtime
      const result = validateSync(openAISchema, {
        input: partialFilterInput,
      });
      assert.deepStrictEqual(result, {
        value: { input: partialFilterInputResult },
      });
    }
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
