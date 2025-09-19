import { test } from "node:test";

import { GraphQLStandardSchemaGenerator } from "../../src/index.ts";
import { buildSchema } from "graphql";
import { gql } from "../utils/test-helpers.ts";

test.skip("getVariablesSchema/validation - stub for future implementation", () => {
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

  // When implemented, getVariablesSchema should validate operation variables
  // based on the variable definitions in the operation

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

  // const validVariables = validateSync(variablesSchema, {
  //   userId: 1,
  // });

  //assert.ok(validVariables.value, "Should validate correct variables");
});

test.skip("getVariablesSchema/validation - should validate scalar variable types", () => {
  // When implemented, should validate all GraphQL scalar types in variables
  // const generator = new GraphQLStandardSchemaGenerator({
  //   schema: buildSchema(`
  //     type Query {
  //       search(
  //         query: String!
  //         limit: Int
  //         offset: Int
  //         includeArchived: Boolean
  //       ): [Result!]!
  //     }
  //     type Result {
  //       id: ID!
  //       title: String!
  //     }
  //   `),
  // });
  // const variablesSchema = generator.getVariablesSchema(
  //   gql(`
  //     query Search(
  //       $query: String!
  //       $limit: Int
  //       $offset: Int
  //       $includeArchived: Boolean
  //     ) {
  //       search(
  //         query: $query
  //         limit: $limit
  //         offset: $offset
  //         includeArchived: $includeArchived
  //       ) {
  //         id
  //         title
  //       }
  //     }
  //   `)
  // );
  // Test various variable combinations
});

test.skip("getVariablesSchema/validation - should validate input object types", () => {
  // When implemented, should validate custom input object types
  // const generator = new GraphQLStandardSchemaGenerator({
  //   schema: buildSchema(`
  //     type Query {
  //       dummy: String
  //     }
  //     type Mutation {
  //       createUser(input: CreateUserInput!): User!
  //     }
  //     input CreateUserInput {
  //       name: String!
  //       email: String!
  //       age: Int
  //       preferences: UserPreferencesInput
  //     }
  //     input UserPreferencesInput {
  //       theme: String!
  //       notifications: Boolean
  //     }
  //     type User {
  //       id: Int!
  //       name: String!
  //     }
  //   `),
  // });
  // Test nested input objects
});

test.skip("getVariablesSchema/validation - should validate enum types", () => {
  // When implemented, should validate enum types in variables
  // const generator = new GraphQLStandardSchemaGenerator({
  //   schema: buildSchema(`
  //     enum Role {
  //       ADMIN
  //       USER
  //       GUEST
  //     }
  //     type Query {
  //       usersByRole(role: Role!): [User!]!
  //     }
  //     type User {
  //       id: Int!
  //       name: String!
  //       role: Role!
  //     }
  //   `),
  // });
  // Test enum validation
});

test.skip("getVariablesSchema/validation - should validate list types", () => {
  // When implemented, should validate array/list types in variables
  // const generator = new GraphQLStandardSchemaGenerator({
  //   schema: buildSchema(`
  //     type Query {
  //       usersByIds(ids: [Int!]!): [User!]!
  //       filterByTags(tags: [String]): [Item!]!
  //     }
  //     type User {
  //       id: Int!
  //       name: String!
  //     }
  //     type Item {
  //       id: Int!
  //       tags: [String!]!
  //     }
  //   `),
  // });
  // Test various list configurations
});

test.skip("getVariablesSchema/validation - should handle default values", () => {
  // When implemented, should respect default values in variable definitions
  // const generator = new GraphQLStandardSchemaGenerator({
  //   schema: buildSchema(`
  //     type Query {
  //       search(
  //         query: String!
  //         limit: Int = 10
  //         sortBy: String = "relevance"
  //       ): [Result!]!
  //     }
  //     type Result {
  //       id: Int!
  //       title: String!
  //     }
  //   `),
  // });
  // Variables with defaults should be optional in validation
});
