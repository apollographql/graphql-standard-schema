import test from "node:test";
import { GraphQLStandardSchemaGenerator } from "../src/index.ts";
import { buildSchema } from "graphql";
import { gql, validateSync, validateWithAjv } from "./utils/test-helpers.ts";
import { expectTypeOf } from "expect-type";
import type { StandardSchemaV1 } from "../src/standard-schema-spec.ts";
import assert from "node:assert";
import { toJSONSchema } from "./utils/toJsonSchema.ts";

test("generates schema for simple query", async (t) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(/**GraphQL*/ `
          type Query {
            hello: String!
            count: Int!
          }
        `),
  });

  const dataSchema = generator.getDataSchema(
    gql<{ hello: string; count: number }>(`
          query SimpleQuery {
            hello
            count
          }
        `)
  );

  await t.test("types", () => {
    expectTypeOf<
      StandardSchemaV1.InferInput<typeof dataSchema>
    >().toEqualTypeOf<{
      hello: string;
      count: number;
    }>();
    expectTypeOf<
      StandardSchemaV1.InferOutput<typeof dataSchema>
    >().toEqualTypeOf<{
      hello: string;
      count: number;
    }>();
  });
  await t.test("validateSync", () => {
    {
      const result = validateSync(dataSchema, {
        hello: "world",
        count: 42,
      });
      // deepEqual because validateSync returns null objects
      assert.deepEqual(result, { value: { hello: "world", count: 42 } });
    }
    {
      const result = validateSync(dataSchema, {
        hello: "world",
        count: "five",
      });
      assert.deepEqual(result, {
        issues: [
          {
            message: 'Int cannot represent non-integer value: "five"',
            path: ["count"],
          },
        ],
      });
    }
  });
  await t.test("JSON schema", (t) => {
    const jsonSchema = toJSONSchema(dataSchema);
    {
      const result = validateWithAjv(jsonSchema, {
        hello: "world",
        count: 5,
      });
      t.assert.equal(result.valid, true);
    }
    {
      const result = validateWithAjv(jsonSchema, {
        hello: "world",
        count: "five",
      });
      t.assert.equal(result.valid, false);
    }
    t.assert.snapshot(jsonSchema);
  });
});

test("works with field selection set", async (t) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(/**GraphQL*/ `
          type Person {
            id: ID!
            name: String!
            age: Int!
            bestFriend: Person!
          }

          type Query {
            me: Person!
          }
        `),
  });

  const dataSchema = generator.getDataSchema(
    gql<{ me: { id: string; name: string; age: number } }>(`
          query {
            me {
              id
              name
              age
              bestFriend {
                id
                name
              }
            }
          }
        `)
  );

  await t.test("types", () => {
    expectTypeOf<
      StandardSchemaV1.InferInput<typeof dataSchema>
    >().toEqualTypeOf<{ me: { id: string; name: string; age: number } }>();
    expectTypeOf<
      StandardSchemaV1.InferOutput<typeof dataSchema>
    >().toEqualTypeOf<{ me: { id: string; name: string; age: number } }>();
  });
  await t.test("validateSync", () => {
    {
      const result = validateSync(dataSchema, {
        me: {
          id: "1",
          name: "Alice",
          age: 42,
          bestFriend: { id: "2", name: "Bob" },
        },
      });
      // deepEqual because validateSync returns null objects
      assert.deepEqual(result, {
        value: {
          me: {
            __typename: "Person",
            id: "1",
            name: "Alice",
            age: 42,
            bestFriend: { __typename: "Person", id: "2", name: "Bob" },
          },
        },
      });
    }
    {
      const result = validateSync(dataSchema, {
        me: {
          id: "1",
          name: "Alice",
          age: "Bob",
          bestFriend: { id: "2", name: "Bob" },
        },
      });
      assert.deepEqual(result, {
        issues: [
          {
            message: 'Int cannot represent non-integer value: "Bob"',
            path: ["me", "age"],
          },
        ],
      });
    }
  });
  await t.test("JSON schema", (t) => {
    const jsonSchema = toJSONSchema(dataSchema);
    {
      const result = validateWithAjv(jsonSchema, {
        me: {
          __typename: "Person",
          id: "1",
          name: "Alice",
          age: 42,
          bestFriend: { __typename: "Person", id: "2", name: "Bob" },
        },
      });
      t.assert.equal(result.valid, true);
    }
    {
      const result = validateWithAjv(jsonSchema, {
        me: {
          __typename: "Person",
          id: "1",
          name: "Alice",
          age: "Bob",
          bestFriend: { __typename: "Person", id: "2", name: "Bob" },
        },
      });
      t.assert.equal(result.valid, false);
    }
    t.assert.snapshot(jsonSchema);
  });
});

test("enforces non-null types", async (t) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(/**GraphQL*/ `
          type Person {
            id: ID!
            name: String!
            bestFriend: Person
          }

          type Query {
            hello: String!
            world: String
            me: Person!
            someoneElse: Person
          }
        `),
  });

  type Data = {
    hello: string;
    world?: string | null;
    me: {
      id: string;
      name: string;
      bestFriend?: { id: string; name: string } | null;
    };
    someoneElse?: {
      id: string;
      name: string;
      bestFriend?: { id: string; name: string } | null;
    } | null;
  };

  const dataSchema = generator.getDataSchema(
    gql<Data>(/** GraphQL*/ `
          query SimpleQuery {
            hello
            world
            me {
              id
              name
              bestFriend {
                id
                name
              }
            }
            someoneElse {
              id
              name
              bestFriend {
                id
                name
              }
            }
          }
        `)
  );

  await t.test("types", () => {
    expectTypeOf<
      StandardSchemaV1.InferInput<typeof dataSchema>
    >().toEqualTypeOf<Data>();
    expectTypeOf<
      StandardSchemaV1.InferOutput<typeof dataSchema>
    >().toEqualTypeOf<Data>();
  });
  await t.test("validateSync", () => {
    {
      const result = validateSync(dataSchema, {
        hello: "world",
        me: { id: "1", name: "Alice" },
      } satisfies Data);
      // optional values get filled in as null
      t.assert.deepEqual(result, {
        value: {
          hello: "world",
          world: null,
          me: {
            __typename: "Person",
            id: "1",
            name: "Alice",
            bestFriend: null,
          },
          someoneElse: null,
        },
      });
      assert("value" in result);
      // null values are also accepted
      const result2 = validateSync(dataSchema, result.value);
      assert.deepEqual(result2, result);
    }
    {
      const result = validateSync(dataSchema, {
        hello: null,
        world: null,
        me: null,
        someoneElse: null,
      });
      assert.deepEqual(result, {
        issues: [
          {
            message: "Cannot return null for non-nullable field Query.hello.",
            path: ["hello"],
          },
        ],
      });
    }
    {
      const result = validateSync(dataSchema, {
        hello: "world",
        world: null,
        me: {
          id: "1",
        },
        someoneElse: null,
      });
      assert.deepEqual(result, {
        issues: [
          {
            message: "Cannot return null for non-nullable field Person.name.",
            path: ["me", "name"],
          },
        ],
      });
    }
  });

  await t.test("JSON schema", (t) => {
    const jsonSchema = toJSONSchema(dataSchema);
    {
      const result = validateWithAjv(jsonSchema, {
        hello: "world",
        me: { __typename: "Person", id: "1", name: "Alice" },
      });
      t.assert.equal(result.valid, true);
    }
    {
      const result = validateWithAjv(jsonSchema, {
        hello: "world",
        me: null,
      });
      t.assert.equal(result.valid, false);
    }
    t.assert.snapshot(jsonSchema);
  });
});
