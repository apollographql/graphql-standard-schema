import z from "zod";
import { zodToStandardJSONSchemaV1 } from "../src/zodToStandardJSONSchemaV1.ts";
import { GraphQLStandardSchemaGenerator } from "../src/index.ts";
import { toJSONSchema } from "./utils/toJsonSchema.ts";
import { SearchCharacter, swSchema } from "./utils/swSchema.ts";
import { composeStandardSchemas } from "../src/composeStandardSchemas.ts";
import test from "node:test";
import assert from "node:assert";
import { validateSync } from "./utils/test-helpers.ts";
import type { StandardSchemaV1 } from "../src/standard-schema-spec.ts";

const generator = new GraphQLStandardSchemaGenerator({
  schema: swSchema,
});

const schema = generator.getDataSchema(SearchCharacter);
const basicSchemaJSON = toJSONSchema(schema);

const validData: StandardSchemaV1.InferInput<typeof schema> = {
  search: [
    {
      __typename: "Human",
      id: "human-003",
      name: "Han",
      fullName: "Han Solo",
      friends: [],
      starships: [
        {
          __typename: "Starship",
          id: "starship-001",
          name: "Millennium Falcon",
        },
      ],
    },
    {
      __typename: "Droid",
      id: "droid-002",
      name: "R2-D2",
      friends: [],
      primaryFunction: "Astromech",
    },
  ],
};

test("basic assumption about test schema", (t) => {
  t.assert.snapshot(basicSchemaJSON);
  // not deepStrictEqual because of `null`-prototypes in the result
  assert.deepEqual(validateSync(schema, validData), { value: validData });
});

test("composes with zod", async (t) => {
  const zodSchema = z.object({
    props: z.object({
      height: z.number(),
      width: z.number(),
    }),
  });
  const zodStandard = zodToStandardJSONSchemaV1(zodSchema);

  const zodJson = toJSONSchema(zodStandard);
  assert.deepStrictEqual(zodJson, {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    properties: {
      props: {
        type: "object",
        properties: { height: { type: "number" }, width: { type: "number" } },
        required: ["height", "width"],
      },
    },
    required: ["props"],
  });

  assert.deepStrictEqual(
    validateSync(zodStandard, { props: { height: 100, width: 200 } }),
    { value: { props: { height: 100, width: 200 } } }
  );
  assert.deepStrictEqual(
    validateSync(zodStandard, { props: { height: 100, width: 200 } }),
    { value: { props: { height: 100, width: 200 } } }
  );

  await t.test("required (default)", (t) => {
    const combinedSchema = composeStandardSchemas(
      zodStandard,
      ["props", "data"],
      schema
    );

    const { $defs, $schema, ...extension } = basicSchemaJSON;

    assert.deepStrictEqual(toJSONSchema(combinedSchema), {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        props: {
          type: "object",
          properties: {
            height: { type: "number" },
            width: { type: "number" },
            // +
            data: extension,
          },
          // +
          required: ["height", "width", "data"],
        },
      },
      required: ["props"],
      // +
      $defs,
    });
  });
  await t.test("optional", (t) => {
    const combinedSchema = composeStandardSchemas(
      zodStandard,
      ["props", "data"],
      schema,
      false
    );

    const { $defs, $schema, ...extension } = basicSchemaJSON;

    assert.deepStrictEqual(toJSONSchema(combinedSchema), {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        props: {
          type: "object",
          properties: {
            height: { type: "number" },
            width: { type: "number" },
            // +
            data: extension,
          },
          // no addition!
          required: ["height", "width"],
        },
      },
      required: ["props"],
      // +
      $defs,
    });
  });
});
