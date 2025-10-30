import { test } from "node:test";

import { GraphQLStandardSchemaGenerator } from "../src/index.ts";
import { toJSONSchema } from "./utils/toJsonSchema.ts";
import { gql, validateWithAjv } from "./utils/test-helpers.ts";
import { buildSchema } from "graphql";

test("handles nullable and non-nullable arguments", (t) => {
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

  const jsonSchema = toJSONSchema(variablesSchema);
  {
    const result = validateWithAjv(jsonSchema, { text: "Han", maxCount: null });
    t.assert.equal(result.valid, true);
  }
  {
    const result = validateWithAjv(jsonSchema, { text: "Han", maxCount: 5 });
    t.assert.equal(result.valid, true);
  }
  {
    const result = validateWithAjv(jsonSchema, { text: 3, maxCount: null });
    t.assert.equal(result.valid, false);
  }
  t.assert.snapshot(jsonSchema);
});

test("handles enums", (t) => {
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
  const jsonSchema = toJSONSchema(variablesSchema);
  {
    const result = validateWithAjv(jsonSchema, { text: "Han", kind: "MOVIE" });
    t.assert.equal(result.valid, true);
  }
  {
    const result = validateWithAjv(jsonSchema, { text: "Han", kind: "WRONG" });
    t.assert.equal(result.valid, false);
  }
  t.assert.snapshot(jsonSchema);
});

test("handles custom scalars", (t) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(/**GraphQL*/ `
      scalar Date
      type Query {
        searchEvent(after: Date!, before: Date!): [String]
      }
    `),
    scalarTypes: {
      Date: { type: "string", pattern: "\\d{4}-\\d{1,2}-\\d{1,2}" },
    },
  });
  const variablesSchema = generator.getVariablesSchema(
    gql<
      { searchEvent: string[] },
      { before: string; after: string }
    >(/** GraphQL */ `
      query Search($after: Date!, $before: Date!) {
        searchEvent(after: $after, before: $before)
      }
    `)
  );
  const jsonSchema = toJSONSchema(variablesSchema);
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

test("handles input types", (t) => {
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
      Date: { type: "string", pattern: "\\d{4}-\\d{1,2}-\\d{1,2}" },
    },
  });
  const variablesSchema = generator.getVariablesSchema(
    gql<
      { searchEvent: string[] },
      { input: { city: string; before?: string; after?: string } }
    >(/** GraphQL */ `
      query Search($input: EventSearchInput!) {
        searchEvent(input: $input)
      }
    `)
  );
  const jsonSchema = toJSONSchema(variablesSchema);
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

test("handles recursive input types", (t) => {
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
    Date: { type: "string", pattern: "\\d{4}-\\d{1,2}-\\d{1,2}" },
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
    after: string | null;
    before: string | null;
    city: string | null;
  }
  const variablesSchema = generator.getVariablesSchema(
    gql<{ searchEvent: string[] }, { input: FilterInput }>(/** GraphQL */ `
      query Search($input: FilterInput!) {
        searchEvent(input: $input)
      }
    `)
  );
  const jsonSchema = toJSONSchema(variablesSchema);

  const openAISchema = openAIGenerator.getVariablesSchema(
    gql<{ searchEvent: string[] }, { input: FilterInput }>(/** GraphQL */ `
      query Search($input: FilterInput!) {
        searchEvent(input: $input)
      }
    `)
  );
  const openAIJsonSchema = toJSONSchema(openAISchema);

  const fullFilterInput: FilterInput = {
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
    // t.assert.equal(result.valid, false);
  }
  t.assert.snapshot(jsonSchema);
  t.assert.snapshot(openAIJsonSchema);
});
