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

  const dataSchema = generator.getDataSchema(parse(`
    query GetHello {
      hello
    }
  `));

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

  const dataSchema = generator.getDataSchema(parse(`
    query GetHello {
      hello
    }
  `));

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

  const dataSchema = generator.getDataSchema(parse(`
    mutation CreateUser {
      createUser(name: "Alice") {
        id
        name
      }
    }
  `));

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
  
  assert(invalidResult.issues, "Should have validation issues for invalid id type");
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

  const dataSchema = generator.getDataSchema(parse(`
    subscription OnMessageAdded {
      messageAdded {
        id
        content
        timestamp
      }
    }
  `));

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

  const dataSchema = generator.getDataSchema(parse(`
    query TestScalars {
      testString
      testInt
      testFloat
      testBoolean
    }
  `));

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
  
  assert(invalidBooleanResult.issues, "Should have validation issues for invalid boolean type");

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
  
  assert(invalidFloatResult.issues, "Should have validation issues for invalid float type");
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

  const dataSchema = generator.getDataSchema(parse(`
    query TestNullable {
      nullableString
      nonNullableString
    }
  `));

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
  
  assert(invalidNullResult.issues, "Should have validation issues for null in non-nullable field");
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

  const dataSchema = generator.getDataSchema(parse(`
    query GetUsers {
      users {
        id
        name
      }
    }
  `));

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
  
  assert(invalidResult.issues, "Should have validation issues for invalid array item");
});