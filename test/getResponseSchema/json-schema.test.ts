import { test } from "node:test";

import { GraphQLStandardSchemaGenerator } from "../../src/index.ts";
import { buildSchema } from "graphql";
// import { gql, validateWithAjv, snapshot } from "../utils/test-helpers.ts";

test.skip("getResponseSchema/json-schema - stub for future implementation", () => {
  // This method is not yet implemented
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        hello: String
      }
    `),
  });

  t.assert.throws(
    () => {
      generator.getResponseSchema(
        gql(`
          query Test {
            hello
          }
        `)
      );
    },
    /not implemented/,
    "getResponseSchema should throw not implemented error"
  );
});

test.skip("getResponseSchema/json-schema - should generate schema for full response", () => {
  // When implemented, this should generate JSON Schema for GraphQL responses
  // including data, errors, and extensions fields
  // const generator = new GraphQLStandardSchemaGenerator({
  //   schema: buildSchema(`
  //     type Query {
  //       user: User!
  //     }
  //     type User {
  //       id: Int!
  //       name: String!
  //     }
  //   `),
  // });
  // const responseSchema = generator.getResponseSchema(
  //   gql(`
  //     query GetUser {
  //       user {
  //         id
  //         name
  //       }
  //     }
  //   `)
  // );
  // const jsonSchema = responseSchema["~standard"].toJSONSchema({
  //   io: "input",
  //   target: "draft-2020-12",
  // });
  // assert.strictEqual(jsonSchema.type, "object");
  //assert.ok(jsonSchema.properties.data, "Should have data property");
  //assert.ok(jsonSchema.properties.errors, "Should have errors property");
  // const validData = {
  //   data: {
  //     user: {
  //       id: 1,
  //       name: "Alice",
  //     },
  //   },
  // };
  // const { valid } = validateWithAjv(jsonSchema, validData);
  //assert.ok(valid, "Should validate response with AJV");
  // assert.snapshot(jsonSchema);
});

test.skip("getResponseSchema/json-schema - should handle error schema", () => {
  // When implemented, should generate proper schema for GraphQL errors
  // with message, path, locations, and extensions fields
});
