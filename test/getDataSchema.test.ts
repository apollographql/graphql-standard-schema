import test from "node:test";
import { GraphQLStandardSchemaGenerator } from "../src/index.ts";
import { buildSchema } from "graphql";
import { gql, validateSync, validateWithAjv } from "./utils/test-helpers.ts";
import { expectTypeOf } from "expect-type";
import type { StandardSchemaV1 } from "../src/standard-schema-spec.ts";
import assert from "node:assert";
import { DateScalarDef } from "./utils/DateScalarDef.ts";
import { getBidirectionalJsonSchemas } from "./utils/getBidirectionalJsonSchemas.ts";

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

  await t.test("normalize", async (t) => {
    t.assert.equal(dataSchema, dataSchema.normalize);
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof dataSchema>
      >().toEqualTypeOf<{ hello: string; count: number }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof dataSchema>
      >().toEqualTypeOf<{ hello: string; count: number }>();
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof dataSchema>
      >().toEqualTypeOf<
        StandardSchemaV1.InferInput<typeof dataSchema.normalize>
      >();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof dataSchema>
      >().toEqualTypeOf<
        StandardSchemaV1.InferOutput<typeof dataSchema.normalize>
      >();
    });

    await t.test("validateSync", () => {
      {
        const value = {
          hello: "world",
          count: 42,
        };
        const result = validateSync(dataSchema, value);
        t.assert.deepEqual(dataSchema(value), result);
        t.assert.deepEqual(result, {
          value: { hello: "world", count: 42 },
        });
      }
      {
        const value = {
          hello: "world",
          count: "five",
        };
        const result = validateSync(dataSchema, value);
        t.assert.deepEqual(dataSchema(value), result);
        t.assert.deepEqual(result, {
          issues: [
            {
              message: 'Int cannot represent non-integer value: "five"',
              path: ["count"],
            },
          ],
        });
      }
    });
  });
  await t.test("deserialize", async (t) => {
    const deserializeSchema = dataSchema.deserialize;
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof deserializeSchema>
      >().toEqualTypeOf<{
        hello: string;
        count: number;
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof deserializeSchema>
      >().toEqualTypeOf<{
        hello: string;
        count: number;
      }>();
    });
    await t.test("validateSync", () => {
      {
        const value = {
          hello: "world",
          count: 42,
        };
        const result = validateSync(deserializeSchema, value);
        t.assert.deepEqual(deserializeSchema(value), result);
        t.assert.deepEqual(result, {
          value: { hello: "world", count: 42 },
        });
      }
      {
        const value = {
          hello: "world",
          count: "five",
        };
        const result = validateSync(deserializeSchema, value);
        t.assert.deepEqual(deserializeSchema(value), result);
        t.assert.deepEqual(result, {
          issues: [
            {
              message: 'Int cannot represent non-integer value: "five"',
              path: ["count"],
            },
          ],
        });
      }
    });
  });

  await t.test("serialize", async (t) => {
    const serializeSchema = dataSchema.serialize;

    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof serializeSchema>
      >().toEqualTypeOf<{
        hello: string;
        count: number;
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof serializeSchema>
      >().toEqualTypeOf<{
        hello: string;
        count: number;
      }>();
    });
    await t.test("validateSync", () => {
      {
        const value = {
          hello: "world",
          count: 42,
        };
        const result = validateSync(serializeSchema, value);
        t.assert.deepEqual(serializeSchema(value), result);
        t.assert.deepEqual(result, { value: { hello: "world", count: 42 } });
      }
      {
        const value = {
          hello: "world",
          count: "five",
        };
        const result = validateSync(serializeSchema, value);
        t.assert.deepEqual(serializeSchema(value), result);
        t.assert.deepEqual(result, {
          issues: [
            {
              message: 'Int cannot represent non-integer value: "five"',
              path: ["count"],
            },
          ],
        });
      }
    });
    await t.test("value coercion", () => {
      {
        const value = {
          hello: 42,
          count: "42",
        };
        const result = validateSync(serializeSchema, value);
        t.assert.deepEqual(serializeSchema(value), result);
        // deepEqual because validateSync returns null objects
        t.assert.deepEqual(result, { value: { hello: "42", count: 42 } });
      }
    });
  });
  await t.test("JSON schema", (t) => {
    const { serializedJsonSchema, deserializedJsonSchema } =
      getBidirectionalJsonSchemas(dataSchema);
    t.assert.deepEqual(serializedJsonSchema, deserializedJsonSchema);

    {
      const result = validateWithAjv(serializedJsonSchema, {
        hello: "world",
        count: 5,
      });
      t.assert.equal(result.valid, true);
    }
    {
      const result = validateWithAjv(serializedJsonSchema, {
        hello: "world",
        count: "five",
      });
      t.assert.equal(result.valid, false);
    }
    t.assert.snapshot(serializedJsonSchema);
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

  await t.test("normalize", async (t) => {
    assert.equal(dataSchema, dataSchema.normalize);
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof dataSchema>
      >().toEqualTypeOf<{ me: { id: string; name: string; age: number } }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof dataSchema>
      >().toEqualTypeOf<{ me: { id: string; name: string; age: number } }>();
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof dataSchema>
      >().toEqualTypeOf<
        StandardSchemaV1.InferInput<typeof dataSchema.normalize>
      >();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof dataSchema>
      >().toEqualTypeOf<
        StandardSchemaV1.InferOutput<typeof dataSchema.normalize>
      >();
    });
    await t.test("validateSync", () => {
      {
        const value = {
          me: {
            id: "1",
            name: "Alice",
            age: 42,
            bestFriend: { id: "2", name: "Bob" },
          },
        };
        const result = validateSync(dataSchema, value);
        t.assert.deepEqual(dataSchema(value), result);
        t.assert.deepEqual(result, {
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
        const value = {
          me: {
            id: "1",
            name: "Alice",
            age: "Bob",
            bestFriend: { id: "2", name: "Bob" },
          },
        };
        const result = validateSync(dataSchema, value);
        t.assert.deepEqual(dataSchema(value), result);
        t.assert.deepEqual(result, {
          issues: [
            {
              message: 'Int cannot represent non-integer value: "Bob"',
              path: ["me", "age"],
            },
          ],
        });
      }
    });
  });

  await t.test("deserialize", async (t) => {
    const deserializeSchema = dataSchema.deserialize;
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof deserializeSchema>
      >().toEqualTypeOf<{ me: { id: string; name: string; age: number } }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof deserializeSchema>
      >().toEqualTypeOf<{ me: { id: string; name: string; age: number } }>();
    });
    await t.test("validateSync", () => {
      {
        const value = {
          me: {
            id: "1",
            name: "Alice",
            age: 42,
            bestFriend: { id: "2", name: "Bob" },
          },
        };
        const result = validateSync(deserializeSchema, value);
        t.assert.deepEqual(deserializeSchema(value), result);
        t.assert.deepEqual(result, {
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
        const value = {
          me: {
            id: "1",
            name: "Alice",
            age: "Bob",
            bestFriend: { id: "2", name: "Bob" },
          },
        };
        const result = validateSync(deserializeSchema, value);
        t.assert.deepEqual(deserializeSchema(value), result);
        t.assert.deepEqual(result, {
          issues: [
            {
              message: 'Int cannot represent non-integer value: "Bob"',
              path: ["me", "age"],
            },
          ],
        });
      }
    });
  });

  await t.test("serialize", async (t) => {
    const serializeSchema = dataSchema.serialize;
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof serializeSchema>
      >().toEqualTypeOf<{ me: { id: string; name: string; age: number } }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof serializeSchema>
      >().toEqualTypeOf<{ me: { id: string; name: string; age: number } }>();
    });
    await t.test("validateSync", () => {
      {
        const value = {
          me: {
            id: "1",
            name: "Alice",
            age: 42,
            bestFriend: { id: "2", name: "Bob" },
          },
        };
        const result = validateSync(serializeSchema, value);
        t.assert.deepEqual(serializeSchema(value), result);
        t.assert.deepEqual(result, {
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
        const value = {
          me: {
            id: "1",
            name: "Alice",
            age: "Bob",
            bestFriend: { id: "2", name: "Bob" },
          },
        };
        const result = validateSync(serializeSchema, value);
        t.assert.deepEqual(serializeSchema(value), result);
        t.assert.deepEqual(result, {
          issues: [
            {
              message: 'Int cannot represent non-integer value: "Bob"',
              path: ["me", "age"],
            },
          ],
        });
      }
    });
  });
  await t.test("JSON schema", (t) => {
    const { deserializedJsonSchema, serializedJsonSchema } =
      getBidirectionalJsonSchemas(dataSchema);
    t.assert.deepEqual(serializedJsonSchema, deserializedJsonSchema);
    {
      const result = validateWithAjv(deserializedJsonSchema, {
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
      const result = validateWithAjv(deserializedJsonSchema, {
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
    t.assert.snapshot(deserializedJsonSchema);
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
  await t.test("normalize", async (t) => {
    t.assert.equal(dataSchema, dataSchema.normalize);
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof dataSchema>
      >().toEqualTypeOf<Data>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof dataSchema>
      >().toEqualTypeOf<Data>();
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof dataSchema>
      >().toEqualTypeOf<
        StandardSchemaV1.InferInput<typeof dataSchema.normalize>
      >();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof dataSchema>
      >().toEqualTypeOf<
        StandardSchemaV1.InferOutput<typeof dataSchema.normalize>
      >();
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
        t.assert.deepEqual(result2, result);
      }
      {
        const value: Record<string, unknown> = {
          hello: null,
          world: null,
          me: null,
          someoneElse: null,
        };
        const result = validateSync(dataSchema, value);
        t.assert.deepEqual(dataSchema(value), result);
        t.assert.deepEqual(result, {
          issues: [
            {
              message: "String cannot represent a non string value: null",
              path: ["hello"],
            },
            {
              message: 'Expected non-nullable type "Person" not to be null.',
              path: ["me"],
            },
          ],
        });
      }
      {
        const value: Record<string, unknown> = {
          hello: "world",
          world: null,
          me: {
            id: "1",
          },
          someoneElse: null,
        };
        const result = validateSync(dataSchema, value);
        t.assert.deepEqual(dataSchema(value), result);
        t.assert.deepEqual(result, {
          issues: [
            {
              message: "String cannot represent a non string value: undefined",
              path: ["me", "name"],
            },
          ],
        });
      }
    });
  });
  await t.test("deserialize", async (t) => {
    const deserializeSchema = dataSchema.deserialize;
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof deserializeSchema>
      >().toEqualTypeOf<Data>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof deserializeSchema>
      >().toEqualTypeOf<Data>();
    });
    await t.test("validateSync", () => {
      {
        const result = validateSync(deserializeSchema, {
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
        const result2 = validateSync(deserializeSchema, result.value);
        t.assert.deepEqual(result2, result);
      }
      {
        const value: Record<string, unknown> = {
          hello: null,
          world: null,
          me: null,
          someoneElse: null,
        };
        const result = validateSync(deserializeSchema, value);
        t.assert.deepEqual(deserializeSchema(value), result);
        t.assert.deepEqual(result, {
          issues: [
            {
              message: "String cannot represent a non string value: null",
              path: ["hello"],
            },
            {
              message: 'Expected non-nullable type "Person" not to be null.',
              path: ["me"],
            },
          ],
        });
      }
      {
        const value: Record<string, unknown> = {
          hello: "world",
          world: null,
          me: {
            id: "1",
          },
          someoneElse: null,
        };
        const result = validateSync(deserializeSchema, value);
        t.assert.deepEqual(deserializeSchema(value), result);
        t.assert.deepEqual(result, {
          issues: [
            {
              message: "String cannot represent a non string value: undefined",
              path: ["me", "name"],
            },
          ],
        });
      }
    });
  });
  await t.test("serialize", async (t) => {
    const serializeSchema = dataSchema.serialize;
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof serializeSchema>
      >().toEqualTypeOf<Data>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof serializeSchema>
      >().toEqualTypeOf<Data>();
    });
    await t.test("validateSync", () => {
      {
        const result = validateSync(serializeSchema, {
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
        const result2 = validateSync(serializeSchema, result.value);
        t.assert.deepEqual(result2, result);
      }
      {
        const value: Record<string, unknown> = {
          hello: null,
          world: null,
          me: null,
          someoneElse: null,
        };
        const result = validateSync(serializeSchema, value);
        t.assert.deepEqual(serializeSchema(value), result);
        t.assert.deepEqual(result, {
          issues: [
            {
              message: "Cannot return null for non-nullable field Query.hello.",
              path: ["hello"],
            },
          ],
        });
      }
      {
        const value: Record<string, unknown> = {
          hello: "world",
          world: null,
          me: {
            id: "1",
          },
          someoneElse: null,
        };
        const result = validateSync(serializeSchema, value);
        t.assert.deepEqual(serializeSchema(value), result);
        t.assert.deepEqual(result, {
          issues: [
            {
              message: "Cannot return null for non-nullable field Person.name.",
              path: ["me", "name"],
            },
          ],
        });
      }
    });
  });
  await t.test("JSON schema", (t) => {
    const { serializedJsonSchema, deserializedJsonSchema } =
      getBidirectionalJsonSchemas(dataSchema);
    t.assert.deepEqual(serializedJsonSchema, deserializedJsonSchema);
    {
      const result = validateWithAjv(serializedJsonSchema, {
        hello: "world",
        me: { __typename: "Person", id: "1", name: "Alice" },
      });
      t.assert.equal(result.valid, true);
    }
    {
      const result = validateWithAjv(serializedJsonSchema, {
        hello: "world",
        me: null,
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
            currentlyPlaying: MediaKind!
          }
        `),
  });

  const dataSchema = generator.getDataSchema(
    gql<{ currentlyPlaying: "MOVIE" | "SERIES" }>(`
          query SimpleQuery {
            currentlyPlaying
          }
        `)
  );

  await t.test("normalize", async (t) => {
    assert.equal(dataSchema, dataSchema.normalize);
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof dataSchema>
      >().toEqualTypeOf<{
        currentlyPlaying: "MOVIE" | "SERIES";
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof dataSchema>
      >().toEqualTypeOf<{
        currentlyPlaying: "MOVIE" | "SERIES";
      }>();
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof dataSchema>
      >().toEqualTypeOf<
        StandardSchemaV1.InferInput<typeof dataSchema.normalize>
      >();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof dataSchema>
      >().toEqualTypeOf<
        StandardSchemaV1.InferOutput<typeof dataSchema.normalize>
      >();
    });
    await t.test("validateSync", () => {
      {
        const value = {
          currentlyPlaying: "MOVIE",
        };
        const result = validateSync(dataSchema, value);
        t.assert.deepEqual(dataSchema(value), result);
        t.assert.deepEqual(result, { value: { currentlyPlaying: "MOVIE" } });
      }
      {
        const value = {
          currentlyPlaying: "OPERA",
        };
        const result = validateSync(dataSchema, value);
        t.assert.deepEqual(dataSchema(value), result);
        t.assert.deepEqual(result, {
          issues: [
            {
              message: 'Value "OPERA" does not exist in "MediaKind" enum.',
              path: ["currentlyPlaying"],
            },
          ],
        });
      }
    });
  });
  await t.test("deserialize", async (t) => {
    const deserializeSchema = dataSchema.deserialize;
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof deserializeSchema>
      >().toEqualTypeOf<{
        currentlyPlaying: "MOVIE" | "SERIES";
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof deserializeSchema>
      >().toEqualTypeOf<{
        currentlyPlaying: "MOVIE" | "SERIES";
      }>();
    });
    await t.test("validateSync", () => {
      {
        const value = {
          currentlyPlaying: "MOVIE",
        };
        const result = validateSync(deserializeSchema, value);
        t.assert.deepEqual(deserializeSchema(value), result);
        t.assert.deepEqual(result, { value: { currentlyPlaying: "MOVIE" } });
      }
      {
        const value = {
          currentlyPlaying: "OPERA",
        };
        const result = validateSync(deserializeSchema, value);
        t.assert.deepEqual(deserializeSchema(value), result);
        t.assert.deepEqual(result, {
          issues: [
            {
              message: 'Value "OPERA" does not exist in "MediaKind" enum.',
              path: ["currentlyPlaying"],
            },
          ],
        });
      }
    });
  });
  await t.test("serialize", async (t) => {
    const serializeSchema = dataSchema.serialize;
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof serializeSchema>
      >().toEqualTypeOf<{
        currentlyPlaying: "MOVIE" | "SERIES";
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof serializeSchema>
      >().toEqualTypeOf<{
        currentlyPlaying: "MOVIE" | "SERIES";
      }>();
    });
    await t.test("validateSync", () => {
      {
        const value = {
          currentlyPlaying: "MOVIE",
        };
        const result = validateSync(serializeSchema, value);
        t.assert.deepEqual(serializeSchema(value), result);
        t.assert.deepEqual(result, { value: { currentlyPlaying: "MOVIE" } });
      }
      {
        const value = {
          currentlyPlaying: "OPERA",
        };
        const result = validateSync(serializeSchema, value);
        t.assert.deepEqual(serializeSchema(value), result);
        t.assert.deepEqual(result, {
          issues: [
            {
              message: 'Enum "MediaKind" cannot represent value: "OPERA"',
              path: ["currentlyPlaying"],
            },
          ],
        });
      }
    });
  });
  await t.test("JSON schema", (t) => {
    const { serializedJsonSchema, deserializedJsonSchema } =
      getBidirectionalJsonSchemas(dataSchema);
    t.assert.deepEqual(serializedJsonSchema, deserializedJsonSchema);
    {
      const result = validateWithAjv(serializedJsonSchema, {
        currentlyPlaying: "MOVIE",
      });
      t.assert.equal(result.valid, true);
    }
    {
      const result = validateWithAjv(serializedJsonSchema, {
        currentlyPlaying: "OPERA",
      });
      t.assert.equal(result.valid, false);
    }
    t.assert.snapshot(serializedJsonSchema);
  });
});

test("handles custom scalars", async (t) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(/**GraphQL*/ `
          scalar Date

          type Query {
            now: Date!
          }
        `),
    scalarTypes: {
      Date: DateScalarDef,
    },
  });

  const dataSchema = generator.getDataSchema(
    gql<{ now: Date }>(`
          query {
            now
          }
        `)
  );
  await t.test("normalize", async (t) => {
    t.assert.equal(dataSchema, dataSchema.normalize);
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof dataSchema>
      >().toEqualTypeOf<{
        now: string;
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof dataSchema>
      >().toEqualTypeOf<{
        now: string;
      }>();
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof dataSchema>
      >().toEqualTypeOf<
        StandardSchemaV1.InferInput<typeof dataSchema.normalize>
      >();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof dataSchema>
      >().toEqualTypeOf<
        StandardSchemaV1.InferOutput<typeof dataSchema.normalize>
      >();
    });
    await t.test("validateSync", () => {
      {
        const value = {
          now: "2023-10-05",
        };
        const result = validateSync(dataSchema, value);
        t.assert.deepEqual(dataSchema(value), result);
        t.assert.deepEqual(result, { value: { now: "2023-10-05" } });
      }
      {
        const value = {
          now: "Oct 5 2023 23:00",
        };
        const result = validateSync(dataSchema, value);
        t.assert.deepEqual(dataSchema(value), result);
        t.assert.deepEqual(result, { value: { now: "2023-10-05" } });
      }
      {
        const value = {
          now: "not-a-date",
        };
        const result = validateSync(dataSchema, value);
        t.assert.deepEqual(dataSchema(value), result);
        t.assert.deepEqual(result, {
          issues: [
            {
              message: "Value is not a valid Date string: not-a-date",
              path: ["now"],
            },
          ],
        });
      }
    });
  });
  await t.test("deserialize", async (t) => {
    const deserializeSchema = dataSchema.deserialize;
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof deserializeSchema>
      >().toEqualTypeOf<{
        now: string;
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof deserializeSchema>
      >().toEqualTypeOf<{
        now: Date;
      }>();
    });
    await t.test("validateSync", () => {
      {
        const value = {
          now: "2023-10-05",
        };
        const result = validateSync(deserializeSchema, value);
        t.assert.deepEqual(deserializeSchema(value), result);
        t.assert.deepEqual(result, { value: { now: new Date("2023-10-05") } });
      }
      {
        const value = {
          now: "not-a-date",
        };
        const result = validateSync(deserializeSchema, value);
        t.assert.deepEqual(deserializeSchema(value), result);
        t.assert.deepEqual(result, {
          issues: [
            {
              message: "Value is not a valid Date string: not-a-date",
              path: ["now"],
            },
          ],
        });
      }
    });
  });

  await t.test("serialize", async (t) => {
    const serializeSchema = dataSchema.serialize;
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof serializeSchema>
      >().toEqualTypeOf<{
        now: Date;
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof serializeSchema>
      >().toEqualTypeOf<{
        now: string;
      }>();
    });
    await t.test("validateSync", () => {
      {
        const value = {
          now: new Date("2023-10-05"),
        };
        const result = validateSync(serializeSchema, value);
        t.assert.deepEqual(serializeSchema(value), result);
        t.assert.deepEqual(result, { value: { now: "2023-10-05" } });
      }
      {
        const value = {
          now: "not-a-date",
        };
        const result = validateSync(serializeSchema, value);
        t.assert.deepEqual(serializeSchema(value), result);
        t.assert.deepEqual(result, {
          issues: [
            {
              message: "Value is not a valid Date object: not-a-date",
              path: ["now"],
            },
          ],
        });
      }
    });
  });
  await t.test("JSON schema", (t) => {
    const { serializedJsonSchema, deserializedJsonSchema } =
      getBidirectionalJsonSchemas(dataSchema);
    {
      const result = validateWithAjv(serializedJsonSchema, {
        now: "2023-10-05",
      });
      t.assert.equal(result.valid, true);
    }
    {
      const result = validateWithAjv(serializedJsonSchema, {
        now: 1234,
      });
      t.assert.equal(result.valid, false);
    }
    t.assert.deepEqual(serializedJsonSchema, {
      $defs: {
        scalar: {
          Date: {
            description: "A date string in YYYY-MM-DD format",
            pattern: "\\d{4}-\\d{1,2}-\\d{1,2}",
            title: "Date",
            type: "string",
          },
        },
      },
      $schema: "https://json-schema.org/draft/2020-12/schema",
      properties: {
        now: {
          $ref: "#/$defs/scalar/Date",
          title: "Query.now: Date!",
        },
      },
      required: ["now"],
      title: "query Anonymous",
      type: "object",
    });
    {
      const result = validateWithAjv(deserializedJsonSchema, {
        now: 1234,
      });
      t.assert.equal(result.valid, true);
    }
    {
      const result = validateWithAjv(deserializedJsonSchema, {
        now: "2023-10-05",
      });
      t.assert.equal(result.valid, false);
    }
    t.assert.deepEqual(deserializedJsonSchema, {
      $defs: {
        scalar: {
          Date: {
            description: "Unix timestamp in milliseconds",
            title: "Date",
            type: "number",
          },
        },
      },
      $schema: "https://json-schema.org/draft/2020-12/schema",
      properties: {
        now: {
          $ref: "#/$defs/scalar/Date",
          title: "Query.now: Date!",
        },
      },
      required: ["now"],
      title: "query Anonymous",
      type: "object",
    });
  });
});

test("handles arrays", async (t) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(/**GraphQL*/ `
          type Query {
            greetings: [String!]!
            nullableGreetings: [String]
          }
        `),
  });

  const dataSchema = generator.getDataSchema(
    gql<{
      greetings: string[];
      nullableGreetings?: null | Array<string | null>;
    }>(`
          query {
            greetings
            nullableGreetings
          }
        `)
  );

  await t.test("normalize", async (t) => {
    t.assert.equal(dataSchema, dataSchema.normalize);
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof dataSchema>
      >().toEqualTypeOf<{
        greetings: string[];
        nullableGreetings?: null | Array<string | null>;
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof dataSchema>
      >().toEqualTypeOf<{
        greetings: string[];
        nullableGreetings?: null | Array<string | null>;
      }>();
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof dataSchema>
      >().toEqualTypeOf<
        StandardSchemaV1.InferInput<typeof dataSchema.normalize>
      >();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof dataSchema>
      >().toEqualTypeOf<
        StandardSchemaV1.InferOutput<typeof dataSchema.normalize>
      >();
    });
    await t.test("validateSync", () => {
      {
        const value = {
          greetings: ["hello", "hi"],
        };
        const result = validateSync(dataSchema, value);
        t.assert.deepEqual(dataSchema(value), result);
        t.assert.deepEqual(result, {
          value: { greetings: ["hello", "hi"], nullableGreetings: null },
        });
      }
      {
        const value: Record<string, unknown> = {
          greetings: [],
          nullableGreetings: ["hello", null, "hi"],
        };
        const result = validateSync(dataSchema, value);
        t.assert.deepEqual(dataSchema(value), result);
        t.assert.deepEqual(result, {
          value: { greetings: [], nullableGreetings: ["hello", null, "hi"] },
        });
      }
      {
        const value = {
          greetings: ["hello", "hi", null],
        };
        const result = validateSync(dataSchema, value);
        t.assert.deepEqual(dataSchema(value), result);
        t.assert.deepEqual(result, {
          issues: [
            {
              message: 'Expected non-nullable type "String" not to be null.',
              path: ["greetings", 2],
            },
          ],
        });
      }
    });
  });

  await t.test("deserialize", async (t) => {
    const deserializeSchema = dataSchema.deserialize;
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof deserializeSchema>
      >().toEqualTypeOf<{
        greetings: string[];
        nullableGreetings?: null | Array<string | null>;
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof deserializeSchema>
      >().toEqualTypeOf<{
        greetings: string[];
        nullableGreetings?: null | Array<string | null>;
      }>();
    });
    await t.test("validateSync", () => {
      {
        const value: Record<string, unknown> = {
          greetings: ["hello", "hi"],
        };
        const result = validateSync(deserializeSchema, value);
        t.assert.deepEqual(deserializeSchema(value), result);
        t.assert.deepEqual(result, {
          value: { greetings: ["hello", "hi"], nullableGreetings: null },
        });
      }
      {
        const value: Record<string, unknown> = {
          greetings: [],
          nullableGreetings: ["hello", null, "hi"],
        };
        const result = validateSync(deserializeSchema, value);
        t.assert.deepEqual(deserializeSchema(value), result);
        t.assert.deepEqual(result, {
          value: { greetings: [], nullableGreetings: ["hello", null, "hi"] },
        });
      }
      {
        const value = {
          greetings: ["hello", "hi", null],
        };
        const result = validateSync(deserializeSchema, value);
        t.assert.deepEqual(deserializeSchema(value), result);
        t.assert.deepEqual(result, {
          issues: [
            {
              message: 'Expected non-nullable type "String" not to be null.',
              path: ["greetings", 2],
            },
          ],
        });
      }
    });
  });

  await t.test("serialize", async (t) => {
    const serializeSchema = dataSchema.serialize;
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof serializeSchema>
      >().toEqualTypeOf<{
        greetings: string[];
        nullableGreetings?: null | Array<string | null>;
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof serializeSchema>
      >().toEqualTypeOf<{
        greetings: string[];
        nullableGreetings?: null | Array<string | null>;
      }>();
    });
    await t.test("validateSync", () => {
      {
        const value = {
          greetings: ["hello", "hi"],
        };
        const result = validateSync(serializeSchema, value);
        t.assert.deepEqual(serializeSchema(value), result);
        t.assert.deepEqual(result, {
          value: { greetings: ["hello", "hi"], nullableGreetings: null },
        });
      }
      {
        const value: Record<string, unknown> = {
          greetings: [],
          nullableGreetings: ["hello", null, "hi"],
        };
        const result = validateSync(serializeSchema, value);
        t.assert.deepEqual(serializeSchema(value), result);
        t.assert.deepEqual(result, {
          value: { greetings: [], nullableGreetings: ["hello", null, "hi"] },
        });
      }
      {
        const value = {
          greetings: ["hello", "hi", null],
        };
        const result = validateSync(serializeSchema, value);
        t.assert.deepEqual(serializeSchema(value), result);
        t.assert.deepEqual(result, {
          issues: [
            {
              message:
                "Cannot return null for non-nullable field Query.greetings.",
              path: ["greetings", 2],
            },
          ],
        });
      }
    });
  });
  await t.test("JSON schema", (t) => {
    const { serializedJsonSchema, deserializedJsonSchema } =
      getBidirectionalJsonSchemas(dataSchema);
    t.assert.deepEqual(serializedJsonSchema, deserializedJsonSchema);
    {
      const result = validateWithAjv(serializedJsonSchema, {
        greetings: ["hallo", "hey"],
        nullableGreetings: ["hello", null, "hi"],
      });
      t.assert.equal(result.valid, true);
    }
    {
      const result = validateWithAjv(serializedJsonSchema, {
        greetings: ["hallo", null, "hey"],
        nullableGreetings: ["hello", null, "hi"],
      });
      t.assert.equal(result.valid, false);
    }
    t.assert.snapshot(serializedJsonSchema);
  });
});

test("handles interfaces", async (t) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(/**GraphQL*/ `
          "Describes something that can be a 'favourite thing or concept'"
          interface Favourite {
            name: String!
          }

          interface Entity {
            id: ID!
          }

          "A color"
          type Color implements Favourite {
            "The name of the color"
            name: String!
            "The hex color value without a leading #"
            hex: String!
          }

          type Unreferenced implements Favourite {
            name: String!
          }

          "A book"
          type Book implements Favourite & Entity {
            "Book ID, should be the ISBN"
            id: ID!
            "Book name"
            name: String!
            "The book's author"
            author: String!
          }

          type Query {
            favourite: Favourite!
          }
        `),
  });

  const dataSchema = generator.getDataSchema(
    gql<{
      favourite:
        | { __typename: "Color"; name: string; hex: string }
        | { __typename: "Book"; id: string; name: string; author: string };
    }>(`
          query SimpleQuery {
            favourite {
              ... on Entity {
                id
              }
              ... on Favourite {
                name
              }
              ... on Color {
                hex
              }
              ... on Book {
                name
                author
              }
            }
          }
        `)
  );
  await t.test("normalize", async (t) => {
    t.assert.equal(dataSchema, dataSchema.normalize);
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof dataSchema>
      >().toEqualTypeOf<{
        favourite:
          | { __typename: "Color"; name: string; hex: string }
          | { __typename: "Book"; id: string; name: string; author: string };
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof dataSchema>
      >().toEqualTypeOf<{
        favourite:
          | { __typename: "Color"; name: string; hex: string }
          | { __typename: "Book"; id: string; name: string; author: string };
      }>();
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof dataSchema>
      >().toEqualTypeOf<
        StandardSchemaV1.InferInput<typeof dataSchema.normalize>
      >();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof dataSchema>
      >().toEqualTypeOf<
        StandardSchemaV1.InferOutput<typeof dataSchema.normalize>
      >();
    });
    await t.test("validateSync", () => {
      {
        const value = {
          favourite: {
            __typename: "Book",
            id: "978-0345391803",
            name: "The Hitchhiker's Guide to the Galaxy",
            author: "Douglas Adams",
          },
        };
        const result = validateSync(dataSchema, value);
        t.assert.deepEqual(dataSchema(value), result);
        t.assert.deepEqual(result, {
          value: {
            favourite: {
              __typename: "Book",
              id: "978-0345391803",
              name: "The Hitchhiker's Guide to the Galaxy",
              author: "Douglas Adams",
            },
          },
        });
      }
      {
        const value = {
          favourite: {
            __typename: "Color",
            name: "red",
            hex: "FF0000",
          },
        };
        const result = validateSync(dataSchema, value);
        t.assert.deepEqual(dataSchema(value), result);
        t.assert.deepEqual(result, {
          value: {
            favourite: {
              __typename: "Color",
              name: "red",
              hex: "FF0000",
            },
          },
        });
      }
      {
        const value = {
          favourite: {
            name: "red",
            hex: "FF0000",
          },
        };
        const result = validateSync(dataSchema, value);
        t.assert.deepEqual(dataSchema(value), result);
        t.assert.deepEqual(result, {
          issues: [
            {
              message:
                'Expected object with __typename for abstract type "Favourite"',
              path: ["favourite"],
            },
          ],
        });
      }
    });
  });
  await t.test("deserialize", async (t) => {
    const deserializeSchema = dataSchema.deserialize;
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof deserializeSchema>
      >().toEqualTypeOf<{
        favourite:
          | { __typename: "Color"; name: string; hex: string }
          | { __typename: "Book"; id: string; name: string; author: string };
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof deserializeSchema>
      >().toEqualTypeOf<{
        favourite:
          | { __typename: "Color"; name: string; hex: string }
          | { __typename: "Book"; id: string; name: string; author: string };
      }>();
    });
    await t.test("validateSync", () => {
      {
        const value = {
          favourite: {
            __typename: "Book",
            id: "978-0345391803",
            name: "The Hitchhiker's Guide to the Galaxy",
            author: "Douglas Adams",
          },
        };
        const result = validateSync(deserializeSchema, value);
        t.assert.deepEqual(deserializeSchema(value), result);
        t.assert.deepEqual(result, {
          value: {
            favourite: {
              __typename: "Book",
              id: "978-0345391803",
              name: "The Hitchhiker's Guide to the Galaxy",
              author: "Douglas Adams",
            },
          },
        });
      }
      {
        const value = {
          favourite: {
            __typename: "Color",
            name: "red",
            hex: "FF0000",
          },
        };
        const result = validateSync(deserializeSchema, value);
        t.assert.deepEqual(deserializeSchema(value), result);
        t.assert.deepEqual(result, {
          value: {
            favourite: {
              __typename: "Color",
              name: "red",
              hex: "FF0000",
            },
          },
        });
      }
      {
        const value = {
          favourite: {
            name: "red",
            hex: "FF0000",
          },
        };
        const result = validateSync(deserializeSchema, value);
        t.assert.deepEqual(deserializeSchema(value), result);
        t.assert.deepEqual(result, {
          issues: [
            {
              message:
                'Expected object with __typename for abstract type "Favourite"',
              path: ["favourite"],
            },
          ],
        });
      }
    });
  });
  await t.test("serialize", async (t) => {
    const serializeSchema = dataSchema.serialize;
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof serializeSchema>
      >().toEqualTypeOf<{
        favourite:
          | { __typename: "Color"; name: string; hex: string }
          | { __typename: "Book"; id: string; name: string; author: string };
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof serializeSchema>
      >().toEqualTypeOf<{
        favourite:
          | { __typename: "Color"; name: string; hex: string }
          | { __typename: "Book"; id: string; name: string; author: string };
      }>();
    });
    await t.test("validateSync", () => {
      {
        const value = {
          favourite: {
            __typename: "Book",
            id: "978-0345391803",
            name: "The Hitchhiker's Guide to the Galaxy",
            author: "Douglas Adams",
          },
        };
        const result = validateSync(serializeSchema, value);
        t.assert.deepEqual(serializeSchema(value), result);
        t.assert.deepEqual(result, {
          value: {
            favourite: {
              __typename: "Book",
              id: "978-0345391803",
              name: "The Hitchhiker's Guide to the Galaxy",
              author: "Douglas Adams",
            },
          },
        });
      }
      {
        const value = {
          favourite: {
            __typename: "Color",
            name: "red",
            hex: "FF0000",
          },
        };
        const result = validateSync(serializeSchema, value);
        t.assert.deepEqual(serializeSchema(value), result);
        t.assert.deepEqual(result, {
          value: {
            favourite: {
              __typename: "Color",
              name: "red",
              hex: "FF0000",
            },
          },
        });
      }
      {
        const value = {
          favourite: {
            name: "red",
            hex: "FF0000",
          },
        };
        const result = validateSync(serializeSchema, value);
        t.assert.deepEqual(serializeSchema(value), result);
        t.assert.deepEqual(result, {
          issues: [
            {
              message:
                'Abstract type "Favourite" must resolve to an Object type at runtime for field "Query.favourite". Either the "Favourite" type should provide a "resolveType" function or each possible type should provide an "isTypeOf" function.',
              path: ["favourite"],
            },
          ],
        });
      }
    });
  });
  await t.test("JSON schema", (t) => {
    const { deserializedJsonSchema, serializedJsonSchema } =
      getBidirectionalJsonSchemas(dataSchema);
    t.assert.deepEqual(serializedJsonSchema, deserializedJsonSchema);
    {
      const result = validateWithAjv(deserializedJsonSchema, {
        favourite: {
          __typename: "Book",
          id: "978-0345391803",
          name: "The Hitchhiker's Guide to the Galaxy",
          author: "Douglas Adams",
        },
      });
      t.assert.equal(result.valid, true);
    }
    {
      const result = validateWithAjv(deserializedJsonSchema, {
        favourite: {
          __typename: "Color",
          name: "red",
          hex: "FF0000",
        },
      });
      t.assert.equal(result.valid, true);
    }
    {
      const result = validateWithAjv(deserializedJsonSchema, {
        name: "red",
        hex: "FF0000",
      });
      t.assert.equal(result.valid, false);
    }
    t.assert.deepEqual(deserializedJsonSchema, {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      title: "query SimpleQuery",
      properties: {
        favourite: {
          title: "Query.favourite: Favourite!",
          $ref: "#/$defs/type/Favourite",
          anyOf: [
            {
              $ref: "#/$defs/type/Color",
              type: "object",
              title: "Color",
              properties: {
                __typename: {
                  const: "Color",
                },
                name: {
                  title: "Color.name: String!",
                  type: "string",
                },
                hex: {
                  title: "Color.hex: String!",
                  type: "string",
                },
              },
              required: ["__typename", "name", "hex"],
            },
            {
              type: "object",
              title: "Unreferenced",
              properties: {
                __typename: {
                  const: "Unreferenced",
                },
                name: {
                  title: "Unreferenced.name: String!",
                  type: "string",
                },
              },
              required: ["__typename", "name"],
            },
            {
              $ref: "#/$defs/type/Book",
              type: "object",
              title: "Book",
              properties: {
                __typename: {
                  const: "Book",
                },
                id: {
                  title: "Book.id: ID!",
                  type: "string",
                },
                name: {
                  title: "Book.name: String!",
                  type: "string",
                },
                author: {
                  title: "Book.author: String!",
                  type: "string",
                },
              },
              required: ["__typename", "id", "name", "author"],
            },
          ],
        },
      },
      required: ["favourite"],
      $defs: {
        type: {
          Color: {
            description: "A color",
          },
          Book: {
            description: "A book",
          },
          Favourite: {
            description:
              "Describes something that can be a 'favourite thing or concept'",
          },
        },
      },
    });
  });
});

test("handles unions", async (t) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(/**GraphQL*/ `
          "Describes something that can be a 'favourite thing or concept'"
          union Favourite = Color | Book | Unreferenced

          "A color"
          type Color {
            "The name of the color"
            name: String!
            "The hex color value without a leading #"
            hex: String!
          }

          type Unreferenced {
            name: String!
          }

          "A book"
          type Book {
            "Book ID, should be the ISBN"
            id: ID!
            "Book name"
            name: String!
            "The book's author"
            author: String!
          }

          type Query {
            favourite: Favourite!
          }
        `),
  });

  const dataSchema = generator.getDataSchema(
    gql<{
      favourite:
        | { __typename: "Color"; name: string; hex: string }
        | { __typename: "Book"; id: string; name: string; author: string };
    }>(`
          query SimpleQuery {
            favourite {
              ... on Color {
                name
                hex
              }
              ... on Book {
                id
                name
                author
              }
            }
          }
        `)
  );
  await t.test("normalize", async (t) => {
    t.assert.equal(dataSchema, dataSchema.normalize);
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof dataSchema>
      >().toEqualTypeOf<{
        favourite:
          | { __typename: "Color"; name: string; hex: string }
          | { __typename: "Book"; id: string; name: string; author: string };
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof dataSchema>
      >().toEqualTypeOf<{
        favourite:
          | { __typename: "Color"; name: string; hex: string }
          | { __typename: "Book"; id: string; name: string; author: string };
      }>();
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof dataSchema>
      >().toEqualTypeOf<
        StandardSchemaV1.InferInput<typeof dataSchema.normalize>
      >();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof dataSchema>
      >().toEqualTypeOf<
        StandardSchemaV1.InferOutput<typeof dataSchema.normalize>
      >();
    });
    await t.test("validateSync", () => {
      {
        const value = {
          favourite: {
            __typename: "Book",
            id: "978-0345391803",
            name: "The Hitchhiker's Guide to the Galaxy",
            author: "Douglas Adams",
          },
        };
        const result = validateSync(dataSchema, value);
        t.assert.deepEqual(dataSchema(value), result);
        t.assert.deepEqual(result, {
          value: {
            favourite: {
              __typename: "Book",
              id: "978-0345391803",
              name: "The Hitchhiker's Guide to the Galaxy",
              author: "Douglas Adams",
            },
          },
        });
      }
      {
        const value = {
          favourite: {
            __typename: "Color",
            name: "red",
            hex: "FF0000",
          },
        };
        const result = validateSync(dataSchema, value);
        t.assert.deepEqual(dataSchema(value), result);
        t.assert.deepEqual(result, {
          value: {
            favourite: {
              __typename: "Color",
              name: "red",
              hex: "FF0000",
            },
          },
        });
      }
      {
        const value = {
          favourite: {
            name: "red",
            hex: "FF0000",
          },
        };
        const result = validateSync(dataSchema, value);
        t.assert.deepEqual(dataSchema(value), result);
        t.assert.deepEqual(result, {
          issues: [
            {
              message:
                'Expected object with __typename for abstract type "Favourite"',
              path: ["favourite"],
            },
          ],
        });
      }
    });
  });
  await t.test("deserialize", async (t) => {
    const deserializeSchema = dataSchema.deserialize;
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof deserializeSchema>
      >().toEqualTypeOf<{
        favourite:
          | { __typename: "Color"; name: string; hex: string }
          | { __typename: "Book"; id: string; name: string; author: string };
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof deserializeSchema>
      >().toEqualTypeOf<{
        favourite:
          | { __typename: "Color"; name: string; hex: string }
          | { __typename: "Book"; id: string; name: string; author: string };
      }>();
    });
    await t.test("validateSync", () => {
      {
        const value = {
          favourite: {
            __typename: "Book",
            id: "978-0345391803",
            name: "The Hitchhiker's Guide to the Galaxy",
            author: "Douglas Adams",
          },
        };
        const result = validateSync(deserializeSchema, value);
        t.assert.deepEqual(deserializeSchema(value), result);
        t.assert.deepEqual(result, {
          value: {
            favourite: {
              __typename: "Book",
              id: "978-0345391803",
              name: "The Hitchhiker's Guide to the Galaxy",
              author: "Douglas Adams",
            },
          },
        });
      }
      {
        const value = {
          favourite: {
            __typename: "Color",
            name: "red",
            hex: "FF0000",
          },
        };
        const result = validateSync(deserializeSchema, value);
        t.assert.deepEqual(deserializeSchema(value), result);
        t.assert.deepEqual(result, {
          value: {
            favourite: {
              __typename: "Color",
              name: "red",
              hex: "FF0000",
            },
          },
        });
      }
      {
        const value = {
          favourite: {
            name: "red",
            hex: "FF0000",
          },
        };
        const result = validateSync(deserializeSchema, value);
        t.assert.deepEqual(deserializeSchema(value), result);
        t.assert.deepEqual(result, {
          issues: [
            {
              message:
                'Expected object with __typename for abstract type "Favourite"',
              path: ["favourite"],
            },
          ],
        });
      }
    });
  });
  await t.test("serialize", async (t) => {
    const serializeSchema = dataSchema.serialize;
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof serializeSchema>
      >().toEqualTypeOf<{
        favourite:
          | { __typename: "Color"; name: string; hex: string }
          | { __typename: "Book"; id: string; name: string; author: string };
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof serializeSchema>
      >().toEqualTypeOf<{
        favourite:
          | { __typename: "Color"; name: string; hex: string }
          | { __typename: "Book"; id: string; name: string; author: string };
      }>();
    });
    await t.test("validateSync", () => {
      {
        const value = {
          favourite: {
            __typename: "Book",
            id: "978-0345391803",
            name: "The Hitchhiker's Guide to the Galaxy",
            author: "Douglas Adams",
          },
        };
        const result = validateSync(serializeSchema, value);
        t.assert.deepEqual(serializeSchema(value), result);
        t.assert.deepEqual(result, {
          value: {
            favourite: {
              __typename: "Book",
              id: "978-0345391803",
              name: "The Hitchhiker's Guide to the Galaxy",
              author: "Douglas Adams",
            },
          },
        });
      }
      {
        const value = {
          favourite: {
            __typename: "Color",
            name: "red",
            hex: "FF0000",
          },
        };
        const result = validateSync(serializeSchema, value);
        t.assert.deepEqual(serializeSchema(value), result);
        t.assert.deepEqual(result, {
          value: {
            favourite: {
              __typename: "Color",
              name: "red",
              hex: "FF0000",
            },
          },
        });
      }
      {
        const value = {
          favourite: {
            name: "red",
            hex: "FF0000",
          },
        };
        const result = validateSync(serializeSchema, value);
        t.assert.deepEqual(serializeSchema(value), result);
        t.assert.deepEqual(result, {
          issues: [
            {
              message:
                'Abstract type "Favourite" must resolve to an Object type at runtime for field "Query.favourite". Either the "Favourite" type should provide a "resolveType" function or each possible type should provide an "isTypeOf" function.',
              path: ["favourite"],
            },
          ],
        });
      }
    });
  });
  await t.test("JSON schema", (t) => {
    const { deserializedJsonSchema, serializedJsonSchema } =
      getBidirectionalJsonSchemas(dataSchema);
    t.assert.deepEqual(serializedJsonSchema, deserializedJsonSchema);
    {
      const result = validateWithAjv(deserializedJsonSchema, {
        favourite: {
          __typename: "Book",
          id: "978-0345391803",
          name: "The Hitchhiker's Guide to the Galaxy",
          author: "Douglas Adams",
        },
      });
      t.assert.equal(result.valid, true);
    }
    {
      const result = validateWithAjv(deserializedJsonSchema, {
        favourite: {
          __typename: "Color",
          name: "red",
          hex: "FF0000",
        },
      });
      t.assert.equal(result.valid, true);
    }
    {
      const result = validateWithAjv(deserializedJsonSchema, {
        name: "red",
        hex: "FF0000",
      });
      t.assert.equal(result.valid, false);
    }
    t.assert.deepEqual(deserializedJsonSchema, {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      title: "query SimpleQuery",
      properties: {
        favourite: {
          title: "Query.favourite: Favourite!",
          $ref: "#/$defs/type/Favourite",
          anyOf: [
            {
              $ref: "#/$defs/type/Color",
              type: "object",
              title: "Color",
              properties: {
                __typename: {
                  const: "Color",
                },
                name: {
                  title: "Color.name: String!",
                  type: "string",
                },
                hex: {
                  title: "Color.hex: String!",
                  type: "string",
                },
              },
              required: ["__typename", "name", "hex"],
            },
            {
              $ref: "#/$defs/type/Book",
              type: "object",
              title: "Book",
              properties: {
                __typename: {
                  const: "Book",
                },
                id: {
                  title: "Book.id: ID!",
                  type: "string",
                },
                name: {
                  title: "Book.name: String!",
                  type: "string",
                },
                author: {
                  title: "Book.author: String!",
                  type: "string",
                },
              },
              required: ["__typename", "id", "name", "author"],
            },
            {
              type: "object",
              title: "Unreferenced",
              properties: {
                __typename: {
                  const: "Unreferenced",
                },
              },
              required: ["__typename"],
            },
          ],
        },
      },
      required: ["favourite"],
      $defs: {
        type: {
          Color: {
            description: "A color",
          },
          Book: {
            description: "A book",
          },
          Favourite: {
            description:
              "Describes something that can be a 'favourite thing or concept'",
          },
        },
      },
    });
  });
});
