import { test } from "node:test";

import { GraphQLStandardSchemaGenerator } from "../../src/index.ts";
import { buildSchema } from "graphql";
import { gql, validateWithAjv } from "../utils/test-helpers.ts";

test("getFragmentSchema/json-schema - generates schema for simple fragment", (t: test.TestContext) => {
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
    gql(`
      fragment UserDetails on Query {
        id
        name
        email
      }
    `)
  );

  const jsonSchema = fragmentSchema["~standard"].toJSONSchema({
    io: "input",
    target: "draft-2020-12",
  });

  t.assert.strictEqual(
    jsonSchema.$schema,
    "https://json-schema.org/draft/2020-12/schema"
  );
  t.assert.strictEqual(jsonSchema.title, "fragment UserDetails on Query");
  t.assert.strictEqual(jsonSchema.type, "object");
  t.assert.deepStrictEqual(jsonSchema.required, ["id", "name", "email"]);

  t.assert.deepStrictEqual(jsonSchema.properties.id, {
    title: "Query.id: Int!",
    type: "integer",
  });
  t.assert.deepStrictEqual(jsonSchema.properties.name, {
    title: "Query.name: String!",
    type: "string",
  });
  t.assert.deepStrictEqual(jsonSchema.properties.email, {
    title: "Query.email: String",
    type: ["string", "null"],
  });

  const validData = {
    id: 1,
    name: "Alice",
    email: "alice@example.com",
  };

  const { valid } = validateWithAjv(jsonSchema, validData);
  t.assert.ok(valid, "Should validate fragment data with AJV");

  t.assert.snapshot(jsonSchema);
});

test("getFragmentSchema/json-schema - handles fragment with nested objects", (t: test.TestContext) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        id: Int!
        name: String!
        profile: Profile
        settings: Settings!
      }

      type Profile {
        bio: String
        avatar: String!
        social: Social
      }

      type Social {
        twitter: String
        github: String
        website: String
      }

      type Settings {
        theme: String!
        notifications: Boolean
        privacy: Privacy
      }

      type Privacy {
        profileVisible: Boolean!
        emailVisible: Boolean!
      }
    `),
  });

  const fragmentSchema = generator.getFragmentSchema(
    gql(`
      fragment UserFullDetails on Query {
        id
        name
        profile {
          bio
          avatar
          social {
            twitter
            github
            website
          }
        }
        settings {
          theme
          notifications
          privacy {
            profileVisible
            emailVisible
          }
        }
      }
    `)
  );

  const jsonSchema = fragmentSchema["~standard"].toJSONSchema({
    io: "input",
    target: "draft-2020-12",
  });

  t.assert.strictEqual(jsonSchema.type, "object");
  t.assert.deepStrictEqual(jsonSchema.properties.id, {
    title: "Query.id: Int!",
    type: "integer",
  });

  // Check nested profile structure
  const profileSchema = jsonSchema.properties.profile;
  t.assert.deepStrictEqual(
    profileSchema.type,
    ["object", "null"],
    "Profile should be nullable"
  );

  // Check nested settings structure
  const settingsSchema = jsonSchema.properties.settings;
  t.assert.strictEqual(settingsSchema.type, "object");
  t.assert.deepStrictEqual(settingsSchema.properties.theme, {
    title: "Settings.theme: String!",
    type: "string",
  });

  const validData = {
    id: 1,
    name: "Alice",
    profile: {
      bio: "Developer",
      avatar: "avatar.jpg",
      social: {
        twitter: "@alice",
        github: "alice-dev",
        website: "https://alice.dev",
      },
    },
    settings: {
      theme: "dark",
      notifications: true,
      privacy: {
        profileVisible: true,
        emailVisible: false,
      },
    },
  };

  const { valid } = validateWithAjv(jsonSchema, validData);
  t.assert.ok(valid, "Should validate nested fragment data with AJV");

  t.assert.snapshot(jsonSchema);
});

test("getFragmentSchema/json-schema - handles fragment with arrays", (t: test.TestContext) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        id: Int!
        tags: [String!]!
        scores: [Int]
        items: [Item!]!
        matrix: [[Float!]!]
      }

      type Item {
        id: Int!
        name: String!
        attributes: [String]
      }
    `),
  });

  const fragmentSchema = generator.getFragmentSchema(
    gql(`
      fragment DataWithArrays on Query {
        id
        tags
        scores
        items {
          id
          name
          attributes
        }
        matrix
      }
    `)
  );

  const jsonSchema = fragmentSchema["~standard"].toJSONSchema({
    io: "input",
    target: "draft-2020-12",
  });

  // Check array schemas
  t.assert.deepStrictEqual(jsonSchema.properties.tags, {
    title: "Query.tags: [String!]!",
    type: "array",
    items: { type: "string" },
  });

  t.assert.deepStrictEqual(jsonSchema.properties.scores, {
    title: "Query.scores: [Int]",
    type: ["array", "null"],
    items: {
      type: ["integer", "null"],
    },
  });

  t.assert.deepStrictEqual(jsonSchema.properties.matrix, {
    title: "Query.matrix: [[Float!]!]",
    type: ["array", "null"],
    items: {
      type: "array",
      items: { type: "number" },
    },
  });

  const validData = {
    id: 1,
    tags: ["tech", "web"],
    scores: [95, null, 88],
    items: [
      { id: 1, name: "Item 1", attributes: ["fast", "reliable"] },
      { id: 2, name: "Item 2", attributes: null },
    ],
    matrix: [
      [1.0, 2.0],
      [3.0, 4.0],
    ],
  };

  const { valid } = validateWithAjv(jsonSchema, validData);
  t.assert.ok(valid, "Should validate arrays in fragment with AJV");

  t.assert.snapshot(jsonSchema);
});

test("getFragmentSchema/json-schema - handles fragment with aliases", (t: test.TestContext) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        id: Int!
        name: String!
        email: String!
        createdAt: String!
        updatedAt: String
      }
    `),
  });

  const fragmentSchema = generator.getFragmentSchema(
    gql(`
      fragment UserWithAliases on Query {
        userId: id
        userName: name
        userEmail: email
        joinDate: createdAt
        lastModified: updatedAt
      }
    `)
  );

  const jsonSchema = fragmentSchema["~standard"].toJSONSchema({
    io: "input",
    target: "draft-2020-12",
  });

  // Should use aliases as property names
  t.assert.deepStrictEqual(jsonSchema.properties.userId, {
    title: "Query.id: Int!",
    type: "integer",
  });
  t.assert.deepStrictEqual(jsonSchema.properties.userName, {
    title: "Query.name: String!",
    type: "string",
  });
  t.assert.deepStrictEqual(jsonSchema.properties.userEmail, {
    title: "Query.email: String!",
    type: "string",
  });
  t.assert.deepStrictEqual(jsonSchema.properties.joinDate, {
    title: "Query.createdAt: String!",
    type: "string",
  });
  t.assert.deepStrictEqual(jsonSchema.properties.lastModified, {
    title: "Query.updatedAt: String",
    type: ["string", "null"],
  });

  t.assert.ok(!jsonSchema.properties.id, "Should not have original field name");
  t.assert.ok(
    !jsonSchema.properties.name,
    "Should not have original field name"
  );

  const validData = {
    userId: 1,
    userName: "Alice",
    userEmail: "alice@example.com",
    joinDate: "2024-01-01",
    lastModified: "2024-02-01",
  };

  const { valid } = validateWithAjv(jsonSchema, validData);
  t.assert.ok(valid, "Should validate aliased fragment with AJV");

  t.assert.snapshot(jsonSchema);
});

test("getFragmentSchema/json-schema - handles fragment with __typename", (t: test.TestContext) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        id: Int!
        name: String!
        type: String!
      }
    `),
  });

  const fragmentSchema = generator.getFragmentSchema(
    gql(`
      fragment TypedData on Query {
        __typename
        id
        name
        type
      }
    `)
  );

  const jsonSchema = fragmentSchema["~standard"].toJSONSchema({
    io: "input",
    target: "draft-2020-12",
  });

  t.assert.deepStrictEqual(jsonSchema.properties.__typename, {
    const: "Query",
  });

  const validData = {
    __typename: "Query",
    id: 1,
    name: "Test",
    type: "example",
  };

  const { valid } = validateWithAjv(jsonSchema, validData);
  t.assert.ok(valid, "Should validate __typename with AJV");

  const invalidData = {
    __typename: "Mutation",
    id: 1,
    name: "Test",
    type: "example",
  };

  const { valid: invalid } = validateWithAjv(jsonSchema, invalidData);
  t.assert.ok(!invalid, "Should reject wrong __typename with AJV");

  t.assert.snapshot(jsonSchema);
});

test("getFragmentSchema/json-schema - handles multiple fragments with selection", (t: test.TestContext) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        id: Int!
        name: String!
        email: String
        phone: String
        address: Address
      }

      type Address {
        street: String!
        city: String!
        country: String!
      }
    `),
  });

  const basicFragmentSchema = generator.getFragmentSchema(
    gql(`
      fragment UserBasic on Query {
        id
        name
      }

      fragment UserContact on Query {
        id
        email
        phone
      }

      fragment UserFull on Query {
        id
        name
        email
        phone
        address {
          street
          city
          country
        }
      }
    `),
    { fragmentName: "UserBasic" }
  );

  const basicJsonSchema = basicFragmentSchema["~standard"].toJSONSchema({
    io: "input",
    target: "draft-2020-12",
  });

  t.assert.strictEqual(basicJsonSchema.title, "fragment UserBasic on Query");
  t.assert.deepStrictEqual(Object.keys(basicJsonSchema.properties), [
    "id",
    "name",
  ]);

  const fullFragmentSchema = generator.getFragmentSchema(
    gql(`
      fragment UserBasic on Query {
        id
        name
      }

      fragment UserContact on Query {
        id
        email
        phone
      }

      fragment UserFull on Query {
        id
        name
        email
        phone
        address {
          street
          city
          country
        }
      }
    `),
    { fragmentName: "UserFull" }
  );

  const fullJsonSchema = fullFragmentSchema["~standard"].toJSONSchema({
    io: "input",
    target: "draft-2020-12",
  });

  t.assert.strictEqual(fullJsonSchema.title, "fragment UserFull on Query");
  t.assert.ok(fullJsonSchema.properties.address, "Should have address field");

  const validFullData = {
    id: 1,
    name: "Alice",
    email: "alice@example.com",
    phone: "+1234567890",
    address: {
      street: "123 Main St",
      city: "New York",
      country: "USA",
    },
  };

  const { valid } = validateWithAjv(fullJsonSchema, validFullData);
  t.assert.ok(valid, "Should validate full fragment with AJV");

  t.assert.snapshot({
    basic: basicJsonSchema,
    full: fullJsonSchema,
  });
});

test("getFragmentSchema/json-schema - handles all scalar types in fragment", (t: test.TestContext) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        stringField: String!
        intField: Int!
        floatField: Float!
        booleanField: Boolean!
        idField: ID!
        nullableString: String
        nullableInt: Int
      }
    `),
  });

  const fragmentSchema = generator.getFragmentSchema(
    gql(`
      fragment AllScalars on Query {
        stringField
        intField
        floatField
        booleanField
        idField
        nullableString
        nullableInt
      }
    `)
  );

  const jsonSchema = fragmentSchema["~standard"].toJSONSchema({
    io: "input",
    target: "draft-2020-12",
  });

  t.assert.deepStrictEqual(jsonSchema.properties.stringField, {
    title: "Query.stringField: String!",
    type: "string",
  });
  t.assert.deepStrictEqual(jsonSchema.properties.intField, {
    title: "Query.intField: Int!",
    type: "integer",
  });
  t.assert.deepStrictEqual(jsonSchema.properties.floatField, {
    title: "Query.floatField: Float!",
    type: "number",
  });
  t.assert.deepStrictEqual(jsonSchema.properties.booleanField, {
    title: "Query.booleanField: Boolean!",
    type: "boolean",
  });
  t.assert.deepStrictEqual(jsonSchema.properties.idField, {
    title: "Query.idField: ID!",
    type: "string",
  });

  t.assert.deepStrictEqual(jsonSchema.properties.nullableString, {
    title: "Query.nullableString: String",
    type: ["string", "null"],
  });

  const validData = {
    stringField: "test",
    intField: 42,
    floatField: 3.14,
    booleanField: true,
    idField: "abc-123",
    nullableString: null as null,
    nullableInt: 100,
  };

  const { valid } = validateWithAjv(jsonSchema, validData);
  t.assert.ok(valid, "Should validate all scalar types with AJV");

  t.assert.snapshot(jsonSchema);
});
