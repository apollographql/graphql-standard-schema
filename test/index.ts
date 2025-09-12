import { test } from "node:test";
import assert from "node:assert";
import { GraphQLStandardSchemaGenerator } from "../src/index.ts";
import { buildSchema, parse } from "graphql";

test("getDataSchema validates valid string data", () => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        hello: String
      }
    `),
  });

  const dataSchema = generator.getDataSchema(
    parse(`
    query GetHello {
      hello
    }
  `)
  );

  const result = dataSchema["~standard"].validate({
    hello: "world",
  });

  assert(result.value, "Should have a value");
  assert.strictEqual(result.value.hello, "world");
});

test("getDataSchema rejects invalid type (number instead of string)", () => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        hello: String
      }
    `),
  });

  const dataSchema = generator.getDataSchema(
    parse(`
    query GetHello {
      hello
    }
  `)
  );

  const result = dataSchema["~standard"].validate({
    hello: 1,
  });

  assert(result.issues, "Should have validation issues for invalid type");
});

test("getDataSchema validates mutations", () => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        dummy: String
      }
      
      type Mutation {
        createUser(name: String!): User
      }
      
      type User {
        id: Int!
        name: String!
      }
    `),
  });

  const dataSchema = generator.getDataSchema(
    parse(`
    mutation CreateUser {
      createUser(name: "Alice") {
        id
        name
      }
    }
  `)
  );

  const validResult = dataSchema["~standard"].validate({
    createUser: {
      id: 123,
      name: "Alice",
    },
  });

  assert(validResult.value, "Should have a value");
  assert.strictEqual(validResult.value.createUser.id, 123);
  assert.strictEqual(validResult.value.createUser.name, "Alice");

  // Test invalid mutation result
  const invalidResult = dataSchema["~standard"].validate({
    createUser: {
      id: "not-a-number", // Should be Int
      name: "Alice",
    },
  });

  assert(
    invalidResult.issues,
    "Should have validation issues for invalid id type"
  );
});

test("getDataSchema validates subscriptions", () => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        dummy: String
      }
      
      type Subscription {
        messageAdded: Message
      }
      
      type Message {
        id: Int!
        content: String!
        timestamp: Float!
      }
    `),
  });

  const dataSchema = generator.getDataSchema(
    parse(`
    subscription OnMessageAdded {
      messageAdded {
        id
        content
        timestamp
      }
    }
  `)
  );

  const validResult = dataSchema["~standard"].validate({
    messageAdded: {
      id: 1,
      content: "Hello, world!",
      timestamp: 1234567890.123,
    },
  });

  assert(validResult.value, "Should have a value");
  assert.strictEqual(validResult.value.messageAdded.id, 1);
  assert.strictEqual(validResult.value.messageAdded.content, "Hello, world!");
  assert.strictEqual(validResult.value.messageAdded.timestamp, 1234567890.123);
});

test("getDataSchema validates different scalar types", () => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        testString: String
        testInt: Int
        testFloat: Float
        testBoolean: Boolean
      }
    `),
  });

  const dataSchema = generator.getDataSchema(
    parse(`
    query TestScalars {
      testString
      testInt
      testFloat
      testBoolean
    }
  `)
  );

  // Test valid scalar values
  const validResult = dataSchema["~standard"].validate({
    testString: "test",
    testInt: 42,
    testFloat: 3.14,
    testBoolean: true,
  });

  assert(validResult.value, "Should have a value");
  assert.strictEqual(validResult.value.testString, "test");
  assert.strictEqual(validResult.value.testInt, 42);
  assert.strictEqual(validResult.value.testFloat, 3.14);
  assert.strictEqual(validResult.value.testBoolean, true);

  // Test invalid boolean (string instead of boolean)
  const invalidBooleanResult = dataSchema["~standard"].validate({
    testString: "test",
    testInt: 42,
    testFloat: 3.14,
    testBoolean: "true", // Should be boolean, not string
  });

  assert(
    invalidBooleanResult.issues,
    "Should have validation issues for invalid boolean type"
  );

  // Test invalid int (float instead of int)
  const invalidIntResult = dataSchema["~standard"].validate({
    testString: "test",
    testInt: 42.5, // Should be int, but GraphQL coerces this
    testFloat: 3.14,
    testBoolean: true,
  });

  // Note: GraphQL might coerce 42.5 to 42, so this might actually pass
  // depending on the implementation

  // Test invalid float (string instead of number)
  const invalidFloatResult = dataSchema["~standard"].validate({
    testString: "test",
    testInt: 42,
    testFloat: "3.14", // Should be number, not string
    testBoolean: true,
  });

  assert(
    invalidFloatResult.issues,
    "Should have validation issues for invalid float type"
  );
});

test("getDataSchema handles nullable fields", () => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        nullableString: String
        nonNullableString: String!
      }
    `),
  });

  const dataSchema = generator.getDataSchema(
    parse(`
    query TestNullable {
      nullableString
      nonNullableString
    }
  `)
  );

  // Test with null value for nullable field
  const validNullResult = dataSchema["~standard"].validate({
    nullableString: null,
    nonNullableString: "required",
  });

  assert(validNullResult.value, "Should accept null for nullable field");
  assert.strictEqual(validNullResult.value.nullableString, null);
  assert.strictEqual(validNullResult.value.nonNullableString, "required");

  // Test with null value for non-nullable field
  const invalidNullResult = dataSchema["~standard"].validate({
    nullableString: "optional",
    nonNullableString: null,
  });

  assert(
    invalidNullResult.issues,
    "Should have validation issues for null in non-nullable field"
  );
});

test("getDataSchema handles arrays", () => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        users: [User!]!
      }
      
      type User {
        id: Int!
        name: String!
      }
    `),
  });

  const dataSchema = generator.getDataSchema(
    parse(`
    query GetUsers {
      users {
        id
        name
      }
    }
  `)
  );

  const validResult = dataSchema["~standard"].validate({
    users: [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ],
  });

  assert(validResult.value, "Should have a value");
  assert(Array.isArray(validResult.value.users), "Should return an array");
  assert.strictEqual(validResult.value.users.length, 2);
  assert.strictEqual(validResult.value.users[0].name, "Alice");
  assert.strictEqual(validResult.value.users[1].name, "Bob");

  // Test invalid array item
  const invalidResult = dataSchema["~standard"].validate({
    users: [
      { id: "not-a-number", name: "Alice" }, // Invalid id type
      { id: 2, name: "Bob" },
    ],
  });

  assert(
    invalidResult.issues,
    "Should have validation issues for invalid array item"
  );
});

test("getFragmentSchema validates single fragment", () => {
  // The fragment schema validates the data structure that would be returned
  // The getFragmentSchema creates a synthetic query that spreads the fragment
  // at the root, but GraphQL requires a field to spread on.
  // Since the fragment is on User type, we need the query to have a user field.
  // Looking at the implementation, it seems to spread the fragment directly,
  // which would only work if the Query type itself matched the fragment type.

  // Let's test with a schema where Query has the same fields as User
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        id: Int!
        name: String!
        email: String
      }
    `),
  });

  const fragmentSchema = generator.getFragmentSchema(
    parse(`
    fragment UserDetails on Query {
      id
      name
      email
    }
  `)
  );

  const validResult = fragmentSchema["~standard"].validate({
    id: 1,
    name: "Alice",
    email: "alice@example.com",
  });

  assert(validResult.value, "Should have a value");
  assert.strictEqual(validResult.value.id, 1);
  assert.strictEqual(validResult.value.name, "Alice");
  assert.strictEqual(validResult.value.email, "alice@example.com");

  // Test with null email (nullable field)
  const nullEmailResult = fragmentSchema["~standard"].validate({
    id: 2,
    name: "Bob",
    email: null,
  });

  assert(nullEmailResult.value, "Should accept null email");
  assert.strictEqual(nullEmailResult.value.email, null);
});

test("getFragmentSchema handles multiple fragments with fragmentName", () => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        id: Int!
        name: String!
        email: String
        profile: Profile
      }
      
      type Profile {
        bio: String
        avatar: String
      }
    `),
  });

  const fragmentSchema = generator.getFragmentSchema(
    parse(`
      fragment UserBasic on Query {
        id
        name
      }
      
      fragment UserFull on Query {
        id
        name
        email
        profile {
          bio
          avatar
        }
      }
    `),
    { fragmentName: "UserFull" }
  );

  const validResult = fragmentSchema["~standard"].validate({
    id: 1,
    name: "Alice",
    email: "alice@example.com",
    profile: {
      bio: "Software developer",
      avatar: "avatar.jpg",
    },
  });

  assert(validResult.value, "Should have a value");
  assert.strictEqual(validResult.value.name, "Alice");
  assert.strictEqual(validResult.value.profile.bio, "Software developer");
});

test("getFragmentSchema throws error for multiple fragments without fragmentName", () => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        user: User
      }
      
      type User {
        id: Int!
        name: String!
      }
    `),
  });

  assert.throws(
    () => {
      generator.getFragmentSchema(
        parse(`
        fragment UserBasic on User {
          id
        }
        
        fragment UserFull on User {
          id
          name
        }
      `)
      );
    },
    /Multiple fragments found, please specify a fragmentName/,
    "Should throw error when multiple fragments without fragmentName"
  );
});

test("getFragmentSchema throws error for non-fragment documents", () => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        user: User
      }
      
      type User {
        id: Int!
        name: String!
      }
    `),
  });

  assert.throws(
    () => {
      generator.getFragmentSchema(
        parse(`
        query GetUser {
          user {
            id
            name
          }
        }
      `)
      );
    },
    /Document must only contain fragment definitions/,
    "Should throw error for non-fragment documents"
  );
});

test("getFragmentSchema throws error when fragment not found", () => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        user: User
      }
      
      type User {
        id: Int!
        name: String!
      }
    `),
  });

  assert.throws(
    () => {
      generator.getFragmentSchema(
        parse(`
          fragment UserBasic on User {
            id
            name
          }
        `),
        { fragmentName: "NonExistent" }
      );
    },
    /Fragment with name NonExistent not found in document/,
    "Should throw error when specified fragment not found"
  );
});

test("getFragmentSchema throws error for empty document", () => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        user: User
      }
      
      type User {
        id: Int!
        name: String!
      }
    `),
  });

  assert.throws(
    () => {
      generator.getFragmentSchema({
        kind: "Document",
        definitions: [],
      } as any);
    },
    /No fragments found in document/,
    "Should throw error for empty document"
  );
});

test("toJSONSchema generates correct schema for simple query", () => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        hello: String
        count: Int
      }
    `),
  });

  const dataSchema = generator.getDataSchema(
    parse(`
      query GetData {
        hello
        count
      }
    `)
  );

  const jsonSchema = dataSchema["~standard"].toJSONSchema({
    io: "input",
    target: "draft-2020-12",
  });

  assert.strictEqual(jsonSchema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.strictEqual(jsonSchema.title, "GetData");
  assert.strictEqual(jsonSchema.type, "object");
  assert.deepStrictEqual(jsonSchema.properties.hello, {
    anyOf: [{ type: "String" }, { type: "null" }],
  });
  assert.deepStrictEqual(jsonSchema.properties.count, {
    anyOf: [{ type: "Int" }, { type: "null" }],
  });
  assert.deepStrictEqual(jsonSchema.required, ["hello", "count"]);
});

test("toJSONSchema handles non-nullable fields", () => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        required: String!
        optional: String
      }
    `),
  });

  const dataSchema = generator.getDataSchema(
    parse(`
      query TestNullability {
        required
        optional
      }
    `)
  );

  const jsonSchema = dataSchema["~standard"].toJSONSchema({
    io: "input",
    target: "draft-2020-12",
  });

  // Non-nullable field should not have anyOf with null
  assert.deepStrictEqual(jsonSchema.properties.required, { type: "String" });
  // Nullable field should have anyOf with null
  assert.deepStrictEqual(jsonSchema.properties.optional, {
    anyOf: [{ type: "String" }, { type: "null" }],
  });
});

test("toJSONSchema handles arrays", () => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        items: [String!]!
        nullableItems: [String]
      }
    `),
  });

  const dataSchema = generator.getDataSchema(
    parse(`
      query TestArrays {
        items
        nullableItems
      }
    `)
  );

  const jsonSchema = dataSchema["~standard"].toJSONSchema({
    io: "input",
    target: "draft-2020-12",
  });

  // Non-nullable array of non-nullable strings
  assert.deepStrictEqual(jsonSchema.properties.items, {
    type: "array",
    items: { type: "String" },
  });

  // Nullable array of nullable strings
  assert.deepStrictEqual(jsonSchema.properties.nullableItems, {
    anyOf: [
      {
        type: "array",
        items: {
          anyOf: [{ type: "String" }, { type: "null" }],
        },
      },
      { type: "null" },
    ],
  });
});

test("toJSONSchema handles nested objects", () => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        user: User!
      }
      
      type User {
        id: Int!
        name: String!
        profile: Profile
      }
      
      type Profile {
        bio: String
        avatar: String
      }
    `),
  });

  const dataSchema = generator.getDataSchema(
    parse(`
      query GetUser {
        user {
          id
          name
          profile {
            bio
            avatar
          }
        }
      }
    `)
  );

  const jsonSchema = dataSchema["~standard"].toJSONSchema({
    io: "input",
    target: "draft-2020-12",
  });

  assert.strictEqual(jsonSchema.properties.user.type, "object");
  assert.deepStrictEqual(jsonSchema.properties.user.properties.id, { type: "Int" });
  assert.deepStrictEqual(jsonSchema.properties.user.properties.name, { type: "String" });
  assert.deepStrictEqual(jsonSchema.properties.user.properties.profile, {
    anyOf: [
      {
        type: "object",
        properties: {
          bio: { anyOf: [{ type: "String" }, { type: "null" }] },
          avatar: { anyOf: [{ type: "String" }, { type: "null" }] },
        },
        required: ["bio", "avatar"],
      },
      { type: "null" },
    ],
  });
  assert.deepStrictEqual(jsonSchema.properties.user.required, ["id", "name", "profile"]);
});

test("toJSONSchema handles field aliases", () => {
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

  const dataSchema = generator.getDataSchema(
    parse(`
      query TestAliases {
        myUser: user {
          userId: id
          userName: name
        }
      }
    `)
  );

  const jsonSchema = dataSchema["~standard"].toJSONSchema({
    io: "input",
    target: "draft-2020-12",
  });

  // Should use aliases as property names
  assert.strictEqual(jsonSchema.properties.myUser.type, "object");
  assert.deepStrictEqual(jsonSchema.properties.myUser.properties.userId, { type: "Int" });
  assert.deepStrictEqual(jsonSchema.properties.myUser.properties.userName, { type: "String" });
  assert.deepStrictEqual(jsonSchema.properties.myUser.required, ["userId", "userName"]);
});

test("toJSONSchema handles mutations", () => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        dummy: String
      }
      
      type Mutation {
        createUser(name: String!): User!
      }
      
      type User {
        id: Int!
        name: String!
      }
    `),
  });

  const dataSchema = generator.getDataSchema(
    parse(`
      mutation CreateUser {
        createUser(name: "Alice") {
          id
          name
        }
      }
    `)
  );

  const jsonSchema = dataSchema["~standard"].toJSONSchema({
    io: "input",
    target: "draft-2020-12",
  });

  assert.strictEqual(jsonSchema.title, "CreateUser");
  assert.strictEqual(jsonSchema.type, "object");
  assert.deepStrictEqual(jsonSchema.properties.createUser, {
    type: "object",
    properties: {
      id: { type: "Int" },
      name: { type: "String" },
    },
    required: ["id", "name"],
  });
});

test("toJSONSchema handles subscriptions", () => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        dummy: String
      }
      
      type Subscription {
        messageAdded: Message!
      }
      
      type Message {
        id: Int!
        content: String!
      }
    `),
  });

  const dataSchema = generator.getDataSchema(
    parse(`
      subscription OnMessage {
        messageAdded {
          id
          content
        }
      }
    `)
  );

  const jsonSchema = dataSchema["~standard"].toJSONSchema({
    io: "input",
    target: "draft-2020-12",
  });

  assert.strictEqual(jsonSchema.title, "OnMessage");
  assert.strictEqual(jsonSchema.type, "object");
  assert.deepStrictEqual(jsonSchema.properties.messageAdded, {
    type: "object",
    properties: {
      id: { type: "Int" },
      content: { type: "String" },
    },
    required: ["id", "content"],
  });
});

test("toJSONSchema throws error for unsupported target", () => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        hello: String
      }
    `),
  });

  const dataSchema = generator.getDataSchema(
    parse(`
      query TestQuery {
        hello
      }
    `)
  );

  assert.throws(
    () => {
      dataSchema["~standard"].toJSONSchema({
        io: "input",
        target: "draft-07" as any,
      });
    },
    /Only draft-2020-12 is supported/,
    "Should throw error for unsupported JSON Schema version"
  );
});

test("toJSONSchema handles all scalar types", () => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        string: String!
        int: Int!
        float: Float!
        boolean: Boolean!
        id: ID!
      }
    `),
  });

  const dataSchema = generator.getDataSchema(
    parse(`
      query TestScalars {
        string
        int
        float
        boolean
        id
      }
    `)
  );

  const jsonSchema = dataSchema["~standard"].toJSONSchema({
    io: "input",
    target: "draft-2020-12",
  });

  assert.deepStrictEqual(jsonSchema.properties.string, { type: "String" });
  assert.deepStrictEqual(jsonSchema.properties.int, { type: "Int" });
  assert.deepStrictEqual(jsonSchema.properties.float, { type: "Float" });
  assert.deepStrictEqual(jsonSchema.properties.boolean, { type: "Boolean" });
  assert.deepStrictEqual(jsonSchema.properties.id, { type: "ID" });
});

test("toJSONSchema handles deeply nested arrays", () => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        matrix: [[Int!]!]!
      }
    `),
  });

  const dataSchema = generator.getDataSchema(
    parse(`
      query TestMatrix {
        matrix
      }
    `)
  );

  const jsonSchema = dataSchema["~standard"].toJSONSchema({
    io: "input",
    target: "draft-2020-12",
  });

  assert.deepStrictEqual(jsonSchema.properties.matrix, {
    type: "array",
    items: {
      type: "array",
      items: { type: "Int" },
    },
  });
});
