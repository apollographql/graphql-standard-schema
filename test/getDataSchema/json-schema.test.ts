import { test } from "node:test";
import { GraphQLStandardSchemaGenerator } from "../../src/index.ts";
import { buildSchema } from "graphql";
import { gql, validateWithAjv } from "../utils/test-helpers.ts";

test("getDataSchema/json-schema - generates schema for simple query", (t: test.TestContext) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        hello: String
        count: Int
      }
    `),
  });

  const dataSchema = generator.getDataSchema(
    gql(`
      query SimpleQuery {
        hello
        count
      }
    `)
  );

  const jsonSchema = dataSchema["~standard"].toJSONSchema({
    io: "input",
    target: "draft-2020-12",
  });

  t.assert.strictEqual(
    jsonSchema.$schema,
    "https://json-schema.org/draft/2020-12/schema"
  );
  t.assert.strictEqual(jsonSchema.title, "query SimpleQuery");
  t.assert.strictEqual(jsonSchema.type, "object");
  t.assert.deepStrictEqual(jsonSchema.required, ["hello", "count"]);

  // Validate with AJV
  const validData = { hello: "world", count: 42 };
  const { valid } = validateWithAjv(jsonSchema, validData);
  t.assert.ok(valid, "Should validate correct data with AJV");

  // Snapshot the schema
  t.assert.snapshot(jsonSchema);
});

test("getDataSchema/json-schema - handles all scalar types", (t: test.TestContext) => {
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
    gql(`
      query AllScalars {
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

  t.assert.deepStrictEqual(jsonSchema.properties.string, {
    title: "Query.string: String!",
    type: "string",
  });
  t.assert.deepStrictEqual(jsonSchema.properties.int, {
    title: "Query.int: Int!",
    type: "integer",
  });
  t.assert.deepStrictEqual(jsonSchema.properties.float, {
    title: "Query.float: Float!",
    type: "number",
  });
  t.assert.deepStrictEqual(jsonSchema.properties.boolean, {
    title: "Query.boolean: Boolean!",
    type: "boolean",
  });
  t.assert.deepStrictEqual(jsonSchema.properties.id, {
    title: "Query.id: ID!",
    type: "string",
  });

  const validData = {
    string: "test",
    int: 42,
    float: 3.14,
    boolean: true,
    id: "abc-123",
  };

  const { valid } = validateWithAjv(jsonSchema, validData);
  t.assert.ok(valid, "Should validate all scalar types with AJV");

  t.assert.snapshot(jsonSchema);
});

test("getDataSchema/json-schema - handles nullable vs non-nullable", (t: test.TestContext) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        required: String!
        optional: String
        requiredInt: Int!
        optionalInt: Int
      }
    `),
  });

  const dataSchema = generator.getDataSchema(
    gql(`
      query NullabilityTest {
        required
        optional
        requiredInt
        optionalInt
      }
    `)
  );

  const jsonSchema = dataSchema["~standard"].toJSONSchema({
    io: "input",
    target: "draft-2020-12",
  });

  // Non-nullable fields should not have anyOf with null
  t.assert.deepStrictEqual(jsonSchema.properties.required, {
    title: "Query.required: String!",
    type: "string",
  });
  t.assert.deepStrictEqual(jsonSchema.properties.requiredInt, {
    title: "Query.requiredInt: Int!",
    type: "integer",
  });

  // Nullable fields should have type array with null
  t.assert.deepStrictEqual(jsonSchema.properties.optional, {
    title: "Query.optional: String",
    type: ["string", "null"],
  });
  t.assert.deepStrictEqual(jsonSchema.properties.optionalInt, {
    title: "Query.optionalInt: Int",
    type: ["integer", "null"],
  });

  const validData = {
    required: "test",
    optional: null as null,
    requiredInt: 42,
    optionalInt: null as null,
  };

  const { valid } = validateWithAjv(jsonSchema, validData);
  t.assert.ok(valid, "Should validate nullability correctly with AJV");

  t.assert.snapshot(jsonSchema);
});

test("getDataSchema/json-schema - handles arrays", (t: test.TestContext) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        strings: [String!]!
        nullableStrings: [String]
        matrix: [[Int!]!]!
        deeplyNested: [[[String!]!]!]!
      }
    `),
  });

  const dataSchema = generator.getDataSchema(
    gql(`
      query ArrayTest {
        strings
        nullableStrings
        matrix
        deeplyNested
      }
    `)
  );

  const jsonSchema = dataSchema["~standard"].toJSONSchema({
    io: "input",
    target: "draft-2020-12",
  });

  // Non-nullable array of non-nullable strings
  t.assert.deepStrictEqual(jsonSchema.properties.strings, {
    title: "Query.strings: [String!]!",
    type: "array",
    items: { type: "string" },
  });

  // Nullable array of nullable strings
  t.assert.deepStrictEqual(jsonSchema.properties.nullableStrings, {
    title: "Query.nullableStrings: [String]",
    type: ["array", "null"],
    items: {
      type: ["string", "null"],
    },
  });

  // 2D matrix
  t.assert.deepStrictEqual(jsonSchema.properties.matrix, {
    title: "Query.matrix: [[Int!]!]!",
    type: "array",
    items: {
      type: "array",
      items: { type: "integer" },
    },
  });

  // 3D array
  t.assert.deepStrictEqual(jsonSchema.properties.deeplyNested, {
    title: "Query.deeplyNested: [[[String!]!]!]!",
    type: "array",
    items: {
      type: "array",
      items: {
        type: "array",
        items: { type: "string" },
      },
    },
  });

  const validData = {
    strings: ["a", "b", "c"],
    nullableStrings: ["d", null, "e"],
    matrix: [
      [1, 2],
      [3, 4],
    ],
    deeplyNested: [[["a", "b"]], [["c"]]],
  };

  const { valid } = validateWithAjv(jsonSchema, validData);
  t.assert.ok(valid, "Should validate arrays with AJV");

  t.assert.snapshot(jsonSchema);
});

test("getDataSchema/json-schema - handles nested objects", (t: test.TestContext) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        user: User!
      }

      type User {
        id: Int!
        name: String!
        profile: Profile
        posts: [Post!]!
      }

      type Profile {
        bio: String
        avatar: String!
        settings: Settings
      }

      type Settings {
        theme: String!
        notifications: Boolean
      }

      type Post {
        id: Int!
        title: String!
        tags: [String!]
      }
    `),
  });

  const dataSchema = generator.getDataSchema(
    gql(`
      query NestedObjects {
        user {
          id
          name
          profile {
            bio
            avatar
            settings {
              theme
              notifications
            }
          }
          posts {
            id
            title
            tags
          }
        }
      }
    `)
  );

  const jsonSchema = dataSchema["~standard"].toJSONSchema({
    io: "input",
    target: "draft-2020-12",
  });

  t.assert.strictEqual(jsonSchema.properties.user.type, "object");
  t.assert.deepStrictEqual(jsonSchema.properties.user.properties.id, {
    title: "User.id: Int!",
    type: "integer",
  });
  t.assert.deepStrictEqual(jsonSchema.properties.user.properties.name, {
    title: "User.name: String!",
    type: "string",
  });

  // Check nested profile structure
  const profileSchema = jsonSchema.properties.user.properties.profile;
  t.assert.deepStrictEqual(
    profileSchema.type,
    ["object", "null"],
    "Profile should be nullable"
  );
  const validData = {
    user: {
      id: 1,
      name: "Alice",
      profile: {
        bio: "Developer",
        avatar: "avatar.jpg",
        settings: {
          theme: "dark",
          notifications: true,
        },
      },
      posts: [
        { id: 1, title: "First Post", tags: ["tech", "web"] },
        { id: 2, title: "Second Post", tags: null },
      ],
    },
  };

  const { valid } = validateWithAjv(jsonSchema, validData);
  t.assert.ok(valid, "Should validate nested objects with AJV");

  t.assert.snapshot(jsonSchema);
});

test("getDataSchema/json-schema - handles field aliases", (t: test.TestContext) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        user: User!
        posts: [Post!]!
      }

      type User {
        id: Int!
        name: String!
      }

      type Post {
        id: Int!
        title: String!
      }
    `),
  });

  const dataSchema = generator.getDataSchema(
    gql(`
      query AliasTest {
        currentUser: user {
          userId: id
          userName: name
        }
        recentPosts: posts {
          postId: id
          postTitle: title
        }
      }
    `)
  );

  const jsonSchema = dataSchema["~standard"].toJSONSchema({
    io: "input",
    target: "draft-2020-12",
  });

  // Should use aliases as property names
  t.assert.ok(
    jsonSchema.properties.currentUser,
    "Should have currentUser property"
  );
  t.assert.ok(
    jsonSchema.properties.recentPosts,
    "Should have recentPosts property"
  );
  t.assert.ok(!jsonSchema.properties.user, "Should not have user property");
  t.assert.ok(!jsonSchema.properties.posts, "Should not have posts property");

  t.assert.deepStrictEqual(
    jsonSchema.properties.currentUser.properties.userId,
    {
      title: "User.id: Int!",
      type: "integer",
    }
  );
  t.assert.deepStrictEqual(
    jsonSchema.properties.currentUser.properties.userName,
    {
      title: "User.name: String!",
      type: "string",
    }
  );

  const validData = {
    currentUser: {
      userId: 1,
      userName: "Alice",
    },
    recentPosts: [
      { postId: 1, postTitle: "First" },
      { postId: 2, postTitle: "Second" },
    ],
  };

  const { valid } = validateWithAjv(jsonSchema, validData);
  t.assert.ok(valid, "Should validate aliased fields with AJV");

  t.assert.snapshot(jsonSchema);
});

test("getDataSchema/json-schema - handles mutations", (t: test.TestContext) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        dummy: String
      }

      type Mutation {
        createUser(name: String!): User!
        updateUser(id: Int!): User
        deleteUser(id: Int!): Boolean!
      }

      type User {
        id: Int!
        name: String!
        email: String!
      }
    `),
  });

  const createSchema = generator.getDataSchema(
    gql(`
      mutation CreateUser {
        createUser(name: "Test") {
          id
          name
          email
        }
      }
    `)
  );

  const createJsonSchema = createSchema["~standard"].toJSONSchema({
    io: "input",
    target: "draft-2020-12",
  });

  t.assert.strictEqual(createJsonSchema.title, "mutation CreateUser");
  t.assert.strictEqual(createJsonSchema.type, "object");
  t.assert.deepStrictEqual(createJsonSchema.properties.createUser, {
    title: "User",
    type: "object",
    properties: {
      id: { title: "User.id: Int!", type: "integer" },
      name: { title: "User.name: String!", type: "string" },
      email: { title: "User.email: String!", type: "string" },
    },
    required: ["id", "name", "email"],
    additionalProperties: false,
  });

  const validCreateData = {
    createUser: {
      id: 1,
      name: "Test",
      email: "test@example.com",
    },
  };

  const { valid: createValid } = validateWithAjv(
    createJsonSchema,
    validCreateData
  );
  t.assert.ok(createValid, "Should validate create mutation with AJV");

  // Test update mutation with nullable result
  const updateSchema = generator.getDataSchema(
    gql(`
      mutation UpdateUser {
        updateUser(id: 1) {
          id
          name
        }
      }
    `)
  );

  const updateJsonSchema = updateSchema["~standard"].toJSONSchema({
    io: "input",
    target: "draft-2020-12",
  });

  t.assert.deepStrictEqual(
    updateJsonSchema.properties.updateUser.type,
    ["object", "null"],
    "Update result should be nullable"
  );

  const validUpdateData = { updateUser: null as null };
  const { valid: updateValid } = validateWithAjv(
    updateJsonSchema,
    validUpdateData
  );
  t.assert.ok(updateValid, "Should validate null mutation result with AJV");

  t.assert.snapshot({
    create: createJsonSchema,
    update: updateJsonSchema,
  });
});

test("getDataSchema/json-schema - handles subscriptions", (t: test.TestContext) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        dummy: String
      }

      type Subscription {
        messageAdded: Message!
        counter: Int!
      }

      type Message {
        id: Int!
        content: String!
        author: User!
      }

      type User {
        id: Int!
        name: String!
      }
    `),
  });

  const dataSchema = generator.getDataSchema(
    gql(`
      subscription OnMessage {
        messageAdded {
          id
          content
          author {
            id
            name
          }
        }
        counter
      }
    `)
  );

  const jsonSchema = dataSchema["~standard"].toJSONSchema({
    io: "input",
    target: "draft-2020-12",
  });

  t.assert.strictEqual(jsonSchema.title, "subscription OnMessage");
  t.assert.deepStrictEqual(jsonSchema.properties.counter, {
    title: "Subscription.counter: Int!",
    type: "integer",
  });

  const messageSchema = jsonSchema.properties.messageAdded;
  t.assert.strictEqual(messageSchema.type, "object");
  t.assert.deepStrictEqual(messageSchema.properties.content, {
    title: "Message.content: String!",
    type: "string",
  });

  const validData = {
    messageAdded: {
      id: 1,
      content: "Hello",
      author: {
        id: 42,
        name: "Alice",
      },
    },
    counter: 10,
  };

  const { valid } = validateWithAjv(jsonSchema, validData);
  t.assert.ok(valid, "Should validate subscription data with AJV");

  t.assert.snapshot(jsonSchema);
});

test("getDataSchema/json-schema - handles __typename field", (t: test.TestContext) => {
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
    gql(`
      query WithTypename {
        user {
          __typename
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

  t.assert.deepStrictEqual(jsonSchema.properties.user.properties.__typename, {
    const: "User",
  });

  const validData = {
    user: {
      __typename: "User",
      id: 1,
      name: "Alice",
    },
  };

  const { valid } = validateWithAjv(jsonSchema, validData);
  t.assert.ok(valid, "Should validate __typename with AJV");

  const invalidData = {
    user: {
      __typename: "WrongType",
      id: 1,
      name: "Alice",
    },
  };

  const { valid: invalid } = validateWithAjv(jsonSchema, invalidData);
  t.assert.ok(!invalid, "Should reject wrong __typename with AJV");

  t.assert.snapshot(jsonSchema);
});

test("getDataSchema/json-schema - throws for unsupported target", (t: test.TestContext) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        hello: String
      }
    `),
  });

  const dataSchema = generator.getDataSchema(
    gql(`
      query Test {
        hello
      }
    `)
  );

  t.assert.throws(
    () => {
      dataSchema["~standard"].toJSONSchema({
        io: "input",
        target: "draft-07" as any,
      });
    },
    /Only draft-2020-12 is supported/,
    "Should throw for unsupported JSON Schema version"
  );
});
