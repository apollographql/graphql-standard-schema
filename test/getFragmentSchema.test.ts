import { test } from "node:test";
import { expectTypeOf } from "expect-type";
import { GraphQLStandardSchemaGenerator } from "../src/index.ts";
import { swSchema } from "./utils/swSchema.ts";
import { gql, validateSync, validateWithAjv } from "./utils/test-helpers.ts";
import type { StandardSchemaV1 } from "../src/standard-schema-spec.ts";
import { DateScalarDef } from "./utils/DateScalarDef.ts";
import { toJSONSchema } from "./utils/toJsonSchema.ts";

await test("single fragment, picks only fragment", async (t) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: swSchema,
    scalarTypes: {
      Date: DateScalarDef,
    },
  });

  const fragmentSchema = generator.getFragmentSchema(
    gql<{
      id: string;
      name: string;
      born: Date;
    }>(/*GraphQL*/ `
    fragment HumanFragment on Human {
      id
      name
      born
    }
  `)
  );

  await t.test("normalize", async (t) => {
    t.assert.equal(fragmentSchema, fragmentSchema.normalize);
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof fragmentSchema>
      >().toEqualTypeOf<{
        id: string;
        name: string;
        born: string;
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof fragmentSchema>
      >().toEqualTypeOf<{
        id: string;
        name: string;
        born: string;
      }>();
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof fragmentSchema>
      >().toEqualTypeOf<
        StandardSchemaV1.InferInput<typeof fragmentSchema.normalize>
      >();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof fragmentSchema>
      >().toEqualTypeOf<
        StandardSchemaV1.InferOutput<typeof fragmentSchema.normalize>
      >();
    });
    await t.test("validateSync", async (t) => {
      {
        const value = {
          __typename: "Human",
          id: "human-042",
          name: "Luke Skywalker",
          born: "1977-05-25",
        };
        const result = validateSync(fragmentSchema, value);
        t.assert.deepEqual(fragmentSchema(value), result);
        t.assert.deepEqual(result, {
          value: {
            __typename: "Human",
            id: "human-042",
            name: "Luke Skywalker",
            born: "1977-05-25",
          },
        });
      }
      {
        const value = {
          id: "human-042",
          name: "Luke Skywalker",
          born: "1977-05-25",
        };
        const result = validateSync(fragmentSchema, value);
        t.assert.deepEqual(fragmentSchema(value), result);
        t.assert.deepEqual(result, {
          issues: [
            {
              message: "Expected __typename field in fragment data",
            },
          ],
        });
      }
    });
  });
  await t.test("deserialize", async (t) => {
    const deserializeSchema = fragmentSchema.deserialize;
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof deserializeSchema>
      >().toEqualTypeOf<{
        id: string;
        name: string;
        born: string;
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof deserializeSchema>
      >().toEqualTypeOf<{
        id: string;
        name: string;
        born: Date;
      }>();
    });
    await t.test("validateSync", async (t) => {
      {
        const value = {
          __typename: "Human",
          id: "human-042",
          name: "Luke Skywalker",
          born: "1977-05-25",
        };
        const result = validateSync(deserializeSchema, value);
        t.assert.deepEqual(deserializeSchema(value), result);
        t.assert.deepEqual(result, {
          value: {
            __typename: "Human",
            id: "human-042",
            name: "Luke Skywalker",
            born: new Date("1977-05-25"),
          },
        });
      }
      {
        const value = {
          id: "human-042",
          name: "Luke Skywalker",
          born: "1977-05-25",
        };
        const result = validateSync(deserializeSchema, value);
        t.assert.deepEqual(deserializeSchema(value), result);
        t.assert.deepEqual(result, {
          issues: [
            {
              message: "Expected __typename field in fragment data",
            },
          ],
        });
      }
    });
  });
  await t.test("serialize", async (t) => {
    const serializeSchema = fragmentSchema.serialize;
    await t.test("types", () => {
      expectTypeOf<
        StandardSchemaV1.InferInput<typeof serializeSchema>
      >().toEqualTypeOf<{
        id: string;
        name: string;
        born: Date;
      }>();
      expectTypeOf<
        StandardSchemaV1.InferOutput<typeof serializeSchema>
      >().toEqualTypeOf<{
        id: string;
        name: string;
        born: string;
      }>();
    });
    await t.test("validateSync", async (t) => {
      {
        const value = {
          __typename: "Human",
          id: "human-042",
          name: "Luke Skywalker",
          born: new Date("1977-05-25"),
        };
        const result = validateSync(serializeSchema, value);
        t.assert.deepEqual(serializeSchema(value), result);
        t.assert.deepEqual(result, {
          value: {
            __typename: "Human",
            id: "human-042",
            name: "Luke Skywalker",
            born: "1977-05-25",
          },
        });
      }
      {
        const value = {
          id: "human-042",
          name: "Luke Skywalker",
          born: new Date("1977-05-25"),
        };
        const result = validateSync(serializeSchema, value);
        t.assert.deepEqual(serializeSchema(value), result);
        t.assert.deepEqual(result, {
          issues: [
            {
              message: "Expected __typename field in fragment data",
            },
          ],
        });
      }
    });
  });

  await t.test("JSON schema", (t) => {
    const serializedJsonSchema = toJSONSchema.input(fragmentSchema);
    {
      const result = validateWithAjv(serializedJsonSchema, {
        __typename: "Human",
        id: "human-042",
        name: "Luke Skywalker",
        born: "1977-05-25",
      });
      t.assert.equal(result.valid, true);
    }
    {
      const result = validateWithAjv(serializedJsonSchema, {
        __typename: "Human",
        id: 42,
        name: "Luke Skywalker",
        born: "1977-05-25",
      });
      t.assert.equal(result.valid, false);
    }
    t.assert.snapshot(serializedJsonSchema);
  });
});
