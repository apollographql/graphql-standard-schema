import { test } from "node:test";
import { GraphQLStandardSchemaGenerator } from "../../src/index.ts";
import { buildSchema } from "graphql";
import { gql } from "../utils/test-helpers.ts";

test.skip("getResponseSchema/validation - stub for future implementation", (t) => {
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

test.skip("getResponseSchema/validation - should validate full GraphQL response", () => {
  // When implemented, this should validate responses with data and errors
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        user: User!
      }

      type User {
        id: Int!
        name: String!
      }
    `),
  });

  // Future test for validating successful response
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

  // const validResponse = validateSync(responseSchema, {
  //   data: {
  //     user: {
  //       id: 1,
  //       name: "Alice",
  //     },
  //   },
  // });

  //assert.ok(validResponse.value, "Should validate successful response");
});

test.skip("getResponseSchema/validation - should validate error responses", () => {
  // When implemented, this should validate GraphQL error responses
  // const errorResponse = validateSync(responseSchema, {
  //   data: null,
  //   errors: [
  //     {
  //       message: "User not found",
  //       path: ["user"],
  //       extensions: {
  //         code: "NOT_FOUND",
  //       },
  //     },
  //   ],
  // });
  //assert.ok(errorResponse.value, "Should validate error response");
});

test.skip("getResponseSchema/validation - should validate partial responses", () => {
  // When implemented, this should validate partial responses with both data and errors
  // const partialResponse = validateSync(responseSchema, {
  //   data: {
  //     user: {
  //       id: 1,
  //       name: null,
  //     },
  //   },
  //   errors: [
  //     {
  //       message: "Failed to fetch name",
  //       path: ["user", "name"],
  //     },
  //   ],
  // });
  //assert.ok(partialResponse.value, "Should validate partial response");
});
