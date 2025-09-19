import { test } from "node:test";

import { GraphQLStandardSchemaGenerator } from "../../src/index.ts";
import { buildSchema } from "graphql";
import {
  gql,
  validateSync,
} from "../utils/test-helpers.ts";

test.skip("getFragmentSchema/validation - validates single fragment on Query type", (t: test.TestContext) => {
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
    gql<{
      id: number;
      name: string;
      email: string | null;
    }>(`
      fragment UserDetails on Query {
        id
        name
        email
      }
    `)
  );

  const validResult = validateSync(fragmentSchema, {
    id: 1,
    name: "Alice",
    email: "alice@example.com",
  });

  t.assert.ok(validResult.value, "Should have a value");
  t.assert.strictEqual(validResult.value.id, 1);
  t.assert.strictEqual(validResult.value.name, "Alice");
  t.assert.strictEqual(validResult.value.email, "alice@example.com");

  // Test with null email (nullable field)
  const nullEmailResult = validateSync(fragmentSchema, {
    id: 2,
    name: "Bob",
    email: null,
  });

  t.assert.ok(nullEmailResult.value, "Should accept null email");
  t.assert.strictEqual(nullEmailResult.value.email, null);

  // Test invalid type
  const invalidResult = validateSync(fragmentSchema, {
    id: "not-a-number",
    name: "Charlie",
    email: "charlie@example.com",
  });

  t.assert.ok(invalidResult.issues, "Should reject invalid type");
});

test.skip("getFragmentSchema/validation - handles multiple fragments with fragmentName", (t: test.TestContext) => {
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
        website: String
      }
    `),
  });

  const fragmentSchema = generator.getFragmentSchema(
    gql<{
      id: number;
      name: string;
      email: string | null;
      profile: {
        bio: string | null;
        avatar: string | null;
        website: string | null;
      } | null;
    }>(`
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
          website
        }
      }
    `),
    { fragmentName: "UserFull" }
  );

  const validResult = validateSync(fragmentSchema, {
    id: 1,
    name: "Alice",
    email: "alice@example.com",
    profile: {
      bio: "Software developer",
      avatar: "avatar.jpg",
      website: "https://alice.dev",
    },
  });

  t.assert.ok(validResult.value, "Should validate UserFull fragment");
  t.assert.strictEqual(validResult.value.name, "Alice");
  t.assert.strictEqual(validResult.value.profile.bio, "Software developer");

  // Test with null profile
  const nullProfileResult = validateSync(fragmentSchema, {
    id: 2,
    name: "Bob",
    email: null,
    profile: null,
  });

  t.assert.ok(nullProfileResult.value, "Should accept null profile");
});

test.skip("getFragmentSchema/validation - validates fragment with nested selections", (t: test.TestContext) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        user: User!
      }

      type User {
        id: Int!
        name: String!
        posts: [Post!]!
        profile: Profile!
      }

      type Post {
        id: Int!
        title: String!
        comments: [Comment!]!
      }

      type Comment {
        id: Int!
        content: String!
        author: String!
      }

      type Profile {
        bio: String
        social: Social
      }

      type Social {
        twitter: String
        github: String
      }
    `),
  });

  // Note: Fragments need to be on types that exist at the root Query
  // Since getFragmentSchema creates a synthetic query, we need the fragment
  // to be on Query type itself. Let's update the schema:
  const generator2 = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        id: Int!
        name: String!
        posts: [Post!]!
        profile: Profile!
      }

      type Post {
        id: Int!
        title: String!
        comments: [Comment!]!
      }

      type Comment {
        id: Int!
        content: String!
        author: String!
      }

      type Profile {
        bio: String
        social: Social
      }

      type Social {
        twitter: String
        github: String
      }
    `),
  });

  const fragmentSchema = generator2.getFragmentSchema(
    gql<{
      id: number;
      name: string;
      posts: {
        id: number;
        title: string;
        comments: {
          id: number;
          content: string;
          author: string;
        }[];
      }[];
      profile: {
        bio: string | null;
        social: {
          twitter: string | null;
          github: string | null;
        } | null;
      };
    }>(`
      fragment UserWithPosts on Query {
        id
        name
        posts {
          id
          title
          comments {
            id
            content
            author
          }
        }
        profile {
          bio
          social {
            twitter
            github
          }
        }
      }
    `)
  );

  const validResult = validateSync(fragmentSchema, {
    id: 1,
    name: "Alice",
    posts: [
      {
        id: 1,
        title: "First Post",
        comments: [
          { id: 1, content: "Great post!", author: "Bob" },
          { id: 2, content: "Thanks for sharing", author: "Charlie" },
        ],
      },
      {
        id: 2,
        title: "Second Post",
        comments: [],
      },
    ],
    profile: {
      bio: "Developer",
      social: {
        twitter: "@alice",
        github: "alice-dev",
      },
    },
  });

  t.assert.ok(validResult.value, "Should validate nested fragment data");
  t.assert.strictEqual(
    validResult.value.posts[0].comments[0].content,
    "Great post!"
  );
  t.assert.strictEqual(validResult.value.profile.social.twitter, "@alice");
});

test.skip("getFragmentSchema/validation - validates fragment with field aliases", (t: test.TestContext) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        id: Int!
        name: String!
        email: String!
        createdAt: String!
      }
    `),
  });

  const fragmentSchema = generator.getFragmentSchema(
    gql<{
      userId: number;
      userName: string;
      userEmail: string;
      joinDate: string;
    }>(`
      fragment UserWithAliases on Query {
        userId: id
        userName: name
        userEmail: email
        joinDate: createdAt
      }
    `)
  );

  const validResult = validateSync(fragmentSchema, {
    userId: 1,
    userName: "Alice",
    userEmail: "alice@example.com",
    joinDate: "2024-01-01",
  });

  t.assert.ok(validResult.value, "Should validate with aliases");
  t.assert.strictEqual(validResult.value.userName, "Alice");

  // Test that original field names don't work
  const invalidResult = validateSync(fragmentSchema, {
    id: 1,
    name: "Alice",
    email: "alice@example.com",
    createdAt: "2024-01-01",
  });

  t.assert.ok(
    invalidResult.issues,
    "Should reject original field names when aliases used"
  );
});

test("getFragmentSchema/validation - throws error for multiple fragments without fragmentName", (t: test.TestContext) => {
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

  t.assert.throws(
    () => {
      generator.getFragmentSchema(
        gql(`
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

test("getFragmentSchema/validation - throws error for non-fragment documents", (t: test.TestContext) => {
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

  t.assert.throws(
    () => {
      generator.getFragmentSchema(
        gql(`
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

test("getFragmentSchema/validation - throws error when fragment not found", (t: test.TestContext) => {
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

  t.assert.throws(
    () => {
      generator.getFragmentSchema(
        gql(`
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

test("getFragmentSchema/validation - throws error for empty document", (t: test.TestContext) => {
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

  t.assert.throws(
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

test.skip("getFragmentSchema/validation - validates fragment with __typename", (t: test.TestContext) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        id: Int!
        name: String!
        role: String!
      }
    `),
  });

  const fragmentSchema = generator.getFragmentSchema(
    gql<{
      __typename: "Query";
      id: number;
      name: string;
      role: string;
    }>(`
      fragment UserWithType on Query {
        __typename
        id
        name
        role
      }
    `)
  );

  const validResult = validateSync(fragmentSchema, {
    __typename: "Query",
    id: 1,
    name: "Alice",
    role: "admin",
  });

  t.assert.ok(validResult.value, "Should validate with __typename");
  t.assert.strictEqual(validResult.value.__typename, "Query");

  // Test with wrong __typename
  const invalidResult = validateSync(fragmentSchema, {
    __typename: "User",
    id: 1,
    name: "Alice",
    role: "admin",
  });

  t.assert.ok(invalidResult.issues, "Should reject wrong __typename");
});

test.skip("getFragmentSchema/validation - validates fragment with arrays", (t: test.TestContext) => {
  const generator = new GraphQLStandardSchemaGenerator({
    schema: buildSchema(`
      type Query {
        id: Int!
        tags: [String!]!
        scores: [Int]
        matrix: [[Float!]!]
      }
    `),
  });

  const fragmentSchema = generator.getFragmentSchema(
    gql<{
      id: number;
      tags: string[];
      scores: (number | null)[] | null;
      matrix: number[][] | null;
    }>(`
      fragment DataWithArrays on Query {
        id
        tags
        scores
        matrix
      }
    `)
  );

  const validResult = validateSync(fragmentSchema, {
    id: 1,
    tags: ["tech", "web", "graphql"],
    scores: [95, null, 88, 92],
    matrix: [
      [1.0, 2.0],
      [3.0, 4.0],
    ],
  });

  t.assert.ok(validResult.value, "Should validate arrays in fragment");
  t.assert.deepStrictEqual(validResult.value.tags, ["tech", "web", "graphql"]);
  t.assert.strictEqual(validResult.value.scores[1], null);

  // Test with null matrix (nullable)
  const nullMatrixResult = validateSync(fragmentSchema, {
    id: 2,
    tags: [],
    scores: null,
    matrix: null,
  });

  t.assert.ok(nullMatrixResult.value, "Should accept null for nullable array");
});
