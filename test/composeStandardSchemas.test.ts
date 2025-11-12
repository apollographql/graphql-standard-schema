import z from "zod";
import {
  zodToExperimentalStandardJSONSchema as zodToStandardJSONSchemaV1,
  composeExperimentalStandardJSONSchemas as composeStandardSchemas,
  GraphQLStandardSchemaGenerator,
  toJSONSchema,
} from "../src/index.ts";
import { SearchCharacter, swSchema } from "./utils/swSchema.ts";
import test from "node:test";
import assert from "node:assert";
import { validateSync } from "./utils/test-helpers.ts";
import type { StandardSchemaV1 } from "@standard-schema/spec";

const generator = new GraphQLStandardSchemaGenerator({
  schema: swSchema,
});

const schema = generator.getDataSchema(SearchCharacter);
const basicSchemaJSON = toJSONSchema.input(schema);

const adjustedSchemaJSON = JSON.parse(JSON.stringify(basicSchemaJSON));
adjustedSchemaJSON.$ref = "#/$defs/" + "props.data/" + "type/Query";
adjustedSchemaJSON.properties.search.items.anyOf[0].properties.friends.items.$ref =
  "#/$defs/" + "props.data/" + "type/Character";
adjustedSchemaJSON.properties.search.items.anyOf[1].properties.friends.items.$ref =
  "#/$defs/" + "props.data/" + "type/Character";

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
  const zodSchema = z.strictObject({
    props: z.strictObject({
      height: z.number(),
      width: z.number(),
    }),
  });
  const zodStandard = zodToStandardJSONSchemaV1(zodSchema);
  const zodJson = toJSONSchema.input(zodStandard);

  test("basic assumption about zod schema", (t) => {
    assert.deepEqual(
      validateSync(zodStandard, { props: { height: 5, width: 10 } }),
      {
        value: { props: { height: 5, width: 10 } },
      }
    );
    assert.deepEqual(
      validateSync(zodStandard, {
        props: { height: 5, width: 10, data: validData },
      }),
      {
        issues: [
          {
            code: "unrecognized_keys",
            keys: ["data"],
            message: 'Unrecognized key: "data"',
            path: ["props"],
          },
        ],
      }
    );
  });

  assert.deepStrictEqual(zodJson, {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    additionalProperties: false,
    properties: {
      props: {
        type: "object",
        additionalProperties: false,
        properties: { height: { type: "number" }, width: { type: "number" } },
        required: ["height", "width"],
      },
    },
    required: ["props"],
  });

  await t.test("required (default)", async (t) => {
    const combinedSchema = composeStandardSchemas(
      zodStandard,
      ["props", "data"],
      schema
    );

    await t.test("validation", async (t) => {
      assert.deepEqual(
        validateSync(combinedSchema, { props: { height: 5, width: 10 } }),
        {
          issues: [
            {
              message: "Cannot read properties of undefined (reading 'search')",
              path: ["props", "data", "search"],
            },
          ],
        }
      );
      assert.deepEqual(
        validateSync(combinedSchema, {
          props: { height: 5, width: 10, data: validData },
        }),
        {
          value: {
            props: { height: 5, width: 10, data: validData },
          },
        }
      );
      await t.test(
        "will error when `hideAddedFieldFromRootSchema` is disabled",
        async (t) => {
          const schemaWithoutHiding = composeStandardSchemas(
            zodStandard,
            ["props", "data"],
            schema,
            true,
            false
          );
          assert.deepEqual(
            validateSync(schemaWithoutHiding, {
              props: { height: 5, width: 10, data: validData },
            }),
            {
              issues: [
                {
                  code: "unrecognized_keys",
                  keys: ["data"],
                  message: 'Unrecognized key: "data"',
                  path: ["props"],
                },
              ],
            }
          );
        }
      );
    });

    await t.test("JSON schema", (t) => {
      const { $defs, $schema, ...extension } = adjustedSchemaJSON;

      t.assert.deepEqual(toJSONSchema.input(combinedSchema), {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        additionalProperties: false,
        properties: {
          props: {
            type: "object",
            additionalProperties: false,
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
        $defs: { "props.data": $defs },
      });
      t.assert.snapshot(toJSONSchema.input(combinedSchema));
    });
  });
  await t.test("optional", async (t) => {
    const combinedSchema = composeStandardSchemas(
      zodStandard,
      ["props", "data"],
      schema,
      false
    );

    await t.test("validation", async (t) => {
      assert.deepEqual(
        validateSync(combinedSchema, { props: { height: 5, width: 10 } }),
        {
          value: {
            props: {
              height: 5,
              width: 10,
            },
          },
        }
      );
      assert.deepEqual(
        validateSync(combinedSchema, {
          props: { height: 5, width: 10, data: validData },
        }),
        {
          value: {
            props: { height: 5, width: 10, data: validData },
          },
        }
      );
      await t.test(
        "will error when `hideAddedFieldFromRootSchema` is disabled",
        async (t) => {
          const schemaWithoutHiding = composeStandardSchemas(
            zodStandard,
            ["props", "data"],
            schema,
            false,
            false
          );
          assert.deepEqual(
            validateSync(schemaWithoutHiding, {
              props: { height: 5, width: 10, data: validData },
            }),
            {
              issues: [
                {
                  code: "unrecognized_keys",
                  keys: ["data"],
                  message: 'Unrecognized key: "data"',
                  path: ["props"],
                },
              ],
            }
          );
        }
      );
    });

    await t.test("JSON schema", (t) => {
      const { $defs, $schema, ...extension } = adjustedSchemaJSON;

      t.assert.deepEqual(toJSONSchema.input(combinedSchema), {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        additionalProperties: false,
        properties: {
          props: {
            type: "object",
            additionalProperties: false,
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
        $defs: {
          "props.data": $defs,
        },
      });
      t.assert.snapshot(toJSONSchema.input(combinedSchema));
    });
  });
});
