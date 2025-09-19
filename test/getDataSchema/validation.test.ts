import { test } from "node:test";

import { GraphQLStandardSchemaGenerator } from "../../src/index.ts";
import { buildSchema } from "graphql";
import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { gql, validateSync } from "../utils/test-helpers.ts";

test("getDataSchema/validation - validates simple query with string field", (t: test.TestContext) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        hello: String
      }
    `),
  });

  const dataSchema = generator.getDataSchema(
    gql<{ hello: string | null }>(`
      query GetHello {
        hello
      }
    `)
  );

  const validResult = validateSync(dataSchema, {
    hello: "world",
  });

  t.assert.ok("value" in validResult, "Should have a value");
  t.assert.strictEqual(validResult.value.hello, "world");

  const invalidResult = validateSync(dataSchema, {
    hello: 123, // Wrong type
  });

  t.assert.ok(
    "issues" in invalidResult,
    "Should have validation issues for invalid type"
  );
});

test("getDataSchema/validation - validates all scalar types", (t: test.TestContext) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        testString: String!
        testInt: Int!
        testFloat: Float!
        testBoolean: Boolean!
        testID: ID!
      }
    `),
  });

  const dataSchema = generator.getDataSchema(
    gql<{
      testString: string;
      testInt: number;
      testFloat: number;
      testBoolean: boolean;
      testID: string;
    }>(`
      query TestScalars {
        testString
        testInt
        testFloat
        testBoolean
        testID
      }
    `)
  );

  const validResult = validateSync(dataSchema, {
    testString: "test",
    testInt: 42,
    testFloat: 3.14,
    testBoolean: true,
    testID: "abc-123",
  });

  t.assert.ok("value" in validResult, "Should validate all scalar types");
  t.assert.strictEqual(validResult.value.testString, "test");
  t.assert.strictEqual(validResult.value.testInt, 42);
  t.assert.strictEqual(validResult.value.testFloat, 3.14);
  t.assert.strictEqual(validResult.value.testBoolean, true);
  t.assert.strictEqual(validResult.value.testID, "abc-123");

  // Test invalid types
  const invalidBooleanResult = validateSync(dataSchema, {
    testString: "test",
    testInt: 42,
    testFloat: 3.14,
    testBoolean: "true", // String instead of boolean
    testID: "abc-123",
  });

  t.assert.ok(
    "issues" in invalidBooleanResult,
    "Should reject string for boolean field"
  );

  const invalidIntResult = validateSync(dataSchema, {
    testString: "test",
    testInt: "42", // String instead of number
    testFloat: 3.14,
    testBoolean: true,
    testID: "abc-123",
  });

  t.assert.ok(
    "issues" in invalidIntResult,
    "Should reject string for int field"
  );
});

test("getDataSchema/validation - handles nullable vs non-nullable fields", (t: test.TestContext) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        nullableString: String
        nonNullableString: String!
        nullableInt: Int
        nonNullableInt: Int!
      }
    `),
  });

  const dataSchema = generator.getDataSchema(
    gql<{
      nullableString: string | null;
      nonNullableString: string;
      nullableInt: number | null;
      nonNullableInt: number;
    }>(`
      query TestNullability {
        nullableString
        nonNullableString
        nullableInt
        nonNullableInt
      }
    `)
  );

  // Test with null values for nullable fields
  const validNullResult = validateSync(dataSchema, {
    nullableString: null,
    nonNullableString: "required",
    nullableInt: null,
    nonNullableInt: 42,
  });

  t.assert.ok(
    "value" in validNullResult,
    "Should accept null for nullable fields"
  );
  t.assert.strictEqual(validNullResult.value.nullableString, null);
  t.assert.strictEqual(validNullResult.value.nullableInt, null);

  // Test with null value for non-nullable field
  const invalidNullResult = validateSync(dataSchema, {
    nullableString: "optional",
    nonNullableString: null, // Should fail
    nullableInt: 10,
    nonNullableInt: 42,
  });

  t.assert.ok(
    "issues" in invalidNullResult,
    "Should reject null for non-nullable string"
  );

  const invalidNullIntResult = validateSync(dataSchema, {
    nullableString: "optional",
    nonNullableString: "required",
    nullableInt: 10,
    nonNullableInt: null, // Should fail
  });

  t.assert.ok(
    "issues" in invalidNullIntResult,
    "Should reject null for non-nullable int"
  );
});

test.skip("getDataSchema/validation - validates arrays and lists", (t: test.TestContext) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        strings: [String!]!
        nullableStrings: [String]
        users: [User!]!
        matrix: [[Int!]!]!
      }

      type User {
        id: Int!
        name: String!
      }
    `),
  });

  const dataSchema = generator.getDataSchema(
    gql<{
      strings: string[];
      nullableStrings: (string | null)[] | null;
      users: { id: number; name: string }[];
      matrix: number[][];
    }>(`
      query TestArrays {
        strings
        nullableStrings
        users {
          id
          name
        }
        matrix
      }
    `)
  );

  const validResult = validateSync(dataSchema, {
    strings: ["a", "b", "c"],
    nullableStrings: ["d", null, "e"],
    users: [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ],
    matrix: [
      [1, 2, 3],
      [4, 5, 6],
    ],
  });

  t.assert.ok("value" in validResult, "Should validate arrays correctly");
  t.assert.deepStrictEqual(validResult.value.strings, ["a", "b", "c"]);
  t.assert.deepStrictEqual(validResult.value.nullableStrings, [
    "d",
    null,
    "e",
  ]);
  t.assert.strictEqual(validResult.value.users.length, 2);
  t.assert.strictEqual(validResult.value.matrix[0][1], 2);

  // Test invalid array element
  const invalidResult = validateSync(dataSchema, {
    strings: ["a", 123, "c"], // Number in string array
    nullableStrings: [],
    users: [],
    matrix: [[]],
  });

  t.assert.ok(
    "issues" in invalidResult,
    "Should reject invalid array element type"
  );
});

test("getDataSchema/validation - validates nested objects", (t: test.TestContext) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        user: User!
      }

      type User {
        id: Int!
        name: String!
        profile: Profile!
        settings: Settings
      }

      type Profile {
        bio: String
        avatar: Avatar!
      }

      type Avatar {
        url: String!
        size: Int!
      }

      type Settings {
        theme: String
        notifications: Boolean
      }
    `),
  });

  const dataSchema = generator.getDataSchema(
    gql<{
      user: {
        id: number;
        name: string;
        profile: {
          bio: string | null;
          avatar: {
            url: string;
            size: number;
          };
        };
        settings: {
          theme: string | null;
          notifications: boolean | null;
        } | null;
      };
    }>(`
      query GetUser {
        user {
          id
          name
          profile {
            bio
            avatar {
              url
              size
            }
          }
          settings {
            theme
            notifications
          }
        }
      }
    `)
  );

  const validResult = validateSync(dataSchema, {
    user: {
      id: 1,
      name: "Alice",
      profile: {
        bio: "Developer",
        avatar: {
          url: "https://example.com/avatar.jpg",
          size: 256,
        },
      },
      settings: {
        theme: "dark",
        notifications: true,
      },
    },
  });

  t.assert.ok("value" in validResult, "Should validate nested objects");
  t.assert.strictEqual(
    validResult.value.user.profile.avatar.url,
    "https://example.com/avatar.jpg"
  );

  // Test with null settings (nullable)
  const validWithNullSettings = validateSync(dataSchema, {
    user: {
      id: 2,
      name: "Bob",
      profile: {
        bio: null,
        avatar: {
          url: "https://example.com/bob.jpg",
          size: 128,
        },
      },
      settings: null,
    },
  });

  t.assert.ok(
    "value" in validWithNullSettings,
    "Should accept null for nullable nested object"
  );

  // Test invalid nested field
  const invalidResult = validateSync(dataSchema, {
    user: {
      id: 3,
      name: "Charlie",
      profile: {
        bio: "Artist",
        avatar: {
          url: 123, // Should be string
          size: 512,
        },
      },
      settings: null,
    },
  });

  t.assert.ok(
    "issues" in invalidResult,
    "Should reject invalid nested field type"
  );
});

test("getDataSchema/validation - validates mutations", (t: test.TestContext) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        dummy: String
      }

      type Mutation {
        createUser(name: String!, email: String!): User
        updateUser(id: Int!, name: String): User
        deleteUser(id: Int!): Boolean!
      }

      type User {
        id: Int!
        name: String!
        email: String!
        createdAt: String!
      }
    `),
  });

  const createSchema = generator.getDataSchema(
    gql<{
      createUser: {
        id: number;
        name: string;
        email: string;
        createdAt: string;
      } | null;
    }>(`
      mutation CreateUser {
        createUser(name: "Alice", email: "alice@example.com") {
          id
          name
          email
          createdAt
        }
      }
    `)
  );

  const validCreateResult = validateSync(createSchema, {
    createUser: {
      id: 1,
      name: "Alice",
      email: "alice@example.com",
      createdAt: "2024-01-01T00:00:00Z",
    },
  });

  t.assert.ok("value" in validCreateResult, "Should validate mutation result");
  if ("value" in validCreateResult && validCreateResult.value.createUser) {
    t.assert.strictEqual(validCreateResult.value.createUser.name, "Alice");
  }

  // Test null result (when mutation returns nullable User)
  const nullResult = validateSync(createSchema, {
    createUser: null,
  });

  t.assert.ok(
    "value" in nullResult,
    "Should accept null for nullable mutation result"
  );

  // Test delete mutation returning boolean
  const deleteSchema = generator.getDataSchema(
    gql<{
      deleteUser: boolean;
    }>(`
      mutation DeleteUser {
        deleteUser(id: 1)
      }
    `)
  );

  const validDeleteResult = validateSync(deleteSchema, {
    deleteUser: true,
  });

  t.assert.ok(
    "value" in validDeleteResult,
    "Should validate boolean mutation result"
  );
  t.assert.strictEqual(validDeleteResult.value.deleteUser, true);

  const invalidDeleteResult = validateSync(deleteSchema, {
    deleteUser: "true", // String instead of boolean
  });

  t.assert.ok(
    "issues" in invalidDeleteResult,
    "Should reject wrong type for mutation result"
  );
});

test("getDataSchema/validation - validates subscriptions", (t: test.TestContext) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        dummy: String
      }

      type Subscription {
        messageAdded(channel: String!): Message!
        userStatusChanged: UserStatus
        counter: Int!
      }

      type Message {
        id: Int!
        content: String!
        timestamp: Float!
        author: User!
      }

      type User {
        id: Int!
        name: String!
      }

      type UserStatus {
        userId: Int!
        status: String!
        lastSeen: Float
      }
    `),
  });

  const messageSchema = generator.getDataSchema(
    gql<{
      messageAdded: {
        id: number;
        content: string;
        timestamp: number;
        author: {
          id: number;
          name: string;
        };
      };
    }>(`
      subscription OnMessage {
        messageAdded(channel: "general") {
          id
          content
          timestamp
          author {
            id
            name
          }
        }
      }
    `)
  );

  const validMessageResult = validateSync(messageSchema, {
    messageAdded: {
      id: 1,
      content: "Hello, world!",
      timestamp: 1234567890.123,
      author: {
        id: 42,
        name: "Alice",
      },
    },
  });

  t.assert.ok(
    "value" in validMessageResult,
    "Should validate subscription message"
  );
  t.assert.strictEqual(
    validMessageResult.value.messageAdded.content,
    "Hello, world!"
  );

  // Test counter subscription
  const counterSchema = generator.getDataSchema(
    gql<{
      counter: number;
    }>(`
      subscription CounterUpdates {
        counter
      }
    `)
  );

  const validCounterResult = validateSync(counterSchema, {
    counter: 42,
  });

  t.assert.ok(
    "value" in validCounterResult,
    "Should validate simple counter subscription"
  );
  t.assert.strictEqual(validCounterResult.value.counter, 42);

  const invalidCounterResult = validateSync(counterSchema, {
    counter: "42", // String instead of number
  });

  t.assert.ok(
    "issues" in invalidCounterResult,
    "Should reject wrong type in subscription"
  );
});

test.skip("getDataSchema/validation - validates field aliases", (t: test.TestContext) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        user(id: Int!): User!
        posts(limit: Int): [Post!]!
      }

      type User {
        id: Int!
        name: String!
        email: String!
      }

      type Post {
        id: Int!
        title: String!
        content: String!
      }
    `),
  });

  const dataSchema = generator.getDataSchema(
    gql<{
      currentUser: {
        userId: number;
        userName: string;
        userEmail: string;
      };
      recentPosts: {
        postId: number;
        postTitle: string;
      }[];
    }>(`
      query TestAliases {
        currentUser: user(id: 1) {
          userId: id
          userName: name
          userEmail: email
        }
        recentPosts: posts(limit: 5) {
          postId: id
          postTitle: title
        }
      }
    `)
  );

  const validResult = validateSync(dataSchema, {
    currentUser: {
      userId: 1,
      userName: "Alice",
      userEmail: "alice@example.com",
    },
    recentPosts: [
      { postId: 1, postTitle: "First Post" },
      { postId: 2, postTitle: "Second Post" },
    ],
  });

  t.assert.ok("value" in validResult, "Should use aliases as field names");
  t.assert.strictEqual(validResult.value.currentUser.userName, "Alice");
  t.assert.strictEqual(
    validResult.value.recentPosts[0].postTitle,
    "First Post"
  );

  // Original field names should not work
  const invalidResult = validateSync(dataSchema, {
    user: {
      // Wrong: using original field name
      id: 1,
      name: "Alice",
      email: "alice@example.com",
    },
    posts: [],
  });

  t.assert.ok(
    "issues" in invalidResult,
    "Should not accept original field names when aliases are used"
  );
});

test.skip("getDataSchema/validation - validates __typename introspection field", (t: test.TestContext) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        user: User!
        admin: Admin!
      }

      type User {
        id: Int!
        name: String!
      }

      type Admin {
        id: Int!
        name: String!
        permissions: [String!]!
      }
    `),
  });

  const dataSchema = generator.getDataSchema(
    gql<{
      user: {
        __typename: "User";
        id: number;
        name: string;
      };
      admin: {
        __typename: "Admin";
        id: number;
        name: string;
        permissions: string[];
      };
    }>(`
      query TestTypename {
        user {
          __typename
          id
          name
        }
        admin {
          __typename
          id
          name
          permissions
        }
      }
    `)
  );

  const validResult = validateSync(dataSchema, {
    user: {
      __typename: "User",
      id: 1,
      name: "Alice",
    },
    admin: {
      __typename: "Admin",
      id: 2,
      name: "Bob",
      permissions: ["read", "write"],
    },
  });

  t.assert.ok("value" in validResult, "Should validate with __typename");
  t.assert.strictEqual(validResult.value.user.__typename, "User");
  t.assert.strictEqual(validResult.value.admin.__typename, "Admin");

  // Test with wrong __typename
  const invalidResult = validateSync(dataSchema, {
    user: {
      __typename: "Admin", // Wrong type name
      id: 1,
      name: "Alice",
    },
    admin: {
      __typename: "Admin",
      id: 2,
      name: "Bob",
      permissions: [],
    },
  });

  t.assert.ok(
    "issues" in invalidResult,
    "Should reject wrong __typename value"
  );
});
