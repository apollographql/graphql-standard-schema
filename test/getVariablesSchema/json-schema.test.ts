import { test } from "node:test";

import { GraphQLStandardSchemaGenerator } from "../../src/index.ts";
import { buildSchema } from "graphql";
// import { gql, validateWithAjv, snapshot } from "../utils/test-helpers.ts";

test.skip("getVariablesSchema/json-schema - stub for future implementation", () => {
  // This method is not yet implemented
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        user(id: Int!): User
      }

      type User {
        id: Int!
        name: String!
      }
    `),
  });

  // When implemented, should generate JSON Schema for operation variables
  // const variablesSchema = generator.getVariablesSchema(
  //   gql(`
  //     query GetUser($userId: Int!) {
  //       user(id: $userId) {
  //         id
  //         name
  //       }
  //     }
  //   `)
  // );

  // const jsonSchema = variablesSchema["~standard"].toJSONSchema({
  //   io: "input",
  //   target: "draft-2020-12",
  // });

  // assert.strictEqual(jsonSchema.type, "object");
  // assert.deepStrictEqual(jsonSchema.properties.userId, { type: "integer" });
  // assert.deepStrictEqual(jsonSchema.required, ["userId"]);

  // const validVariables = { userId: 1 };
  // const { valid } = validateWithAjv(jsonSchema, validVariables);
  //assert.ok(valid, "Should validate variables with AJV");

  // assert.snapshot(jsonSchema);
});

test.skip("getVariablesSchema/json-schema - should handle nullable and default values", () => {
  // When implemented, should properly represent nullable and default values
  // in the JSON Schema
  // Variables with defaults should be optional
  // Nullable variables should have anyOf with null
});

test.skip("getVariablesSchema/json-schema - should handle input object types", () => {
  // When implemented, should generate nested object schemas for input types
  // const generator = new GraphQLStandardSchemaGenerator({
  //   schema: buildSchema(`
  //     input CreateUserInput {
  //       name: String!
  //       email: String!
  //       profile: ProfileInput
  //     }
  //     input ProfileInput {
  //       bio: String
  //       avatar: String!
  //     }
  //     type Mutation {
  //       createUser(input: CreateUserInput!): User!
  //     }
  //     type User {
  //       id: Int!
  //     }
  //     type Query {
  //       dummy: String
  //     }
  //   `),
  // });
  // Should generate proper nested structure for input objects
});

test.skip("getVariablesSchema/json-schema - should handle enum types", () => {
  // When implemented, should generate enum schemas in JSON Schema
  // with proper enum values constraint
});

test.skip("getVariablesSchema/json-schema - should handle list types", () => {
  // When implemented, should generate array schemas for list types
  // including nested arrays and nullable variations
});
