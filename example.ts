import Ajv from "ajv/dist/2020.js";
import { parse } from "graphql";
import { writeFileSync } from "node:fs";
import { GraphQLStandardSchemaGenerator } from "./src/index.ts";

const testSchema = new GraphQLStandardSchemaGenerator({
  schema: parse(/** GraphQL */ `
      "System user roles"
      enum Role {
        "Role for Admin users"
        ADMIN
        "Role for regular users"
        USER
        "Role for guest users"
        GUEST
      }

      "Describes something that can be a 'favourite thing or concept'"
      interface Favourite {
        name: String!
      }

      "A color"
      interface Color implements Favourite {
        "The name of the color"
        name: String!
        "The hex color value without a leading #"
        hex: String!
      }

      "A book"
      type Book implements Favourite {
        "Book ID, should be the ISBN"
        id: ID!
        "Book name"
        name: String!
        "The book's author"
        author: String!
      }

      "A possible search result for the Omnibar"
      union SearchResult = User | Book | Color

      type Query {
        "Lists all users"
        users: [User]
        "Search for users, books or colors, e.g. with an Omnibar"
        search(term: String!): [SearchResult!]!
      }

      """
      The user type
      """
      type User {
        "The user's unique ID"
        id: Int!
        "The user's full name"
        name: String!
        "The user's role in the system"
        role: Role
        "The user's favourite things"
        favourites: [Favourite!]!
        "The user's birth date"
        birthDate: Date
      }

      """A custom date scalar in YYYY-MM-DD format"""
      scalar Date
    `),
  scalarTypes: {
    Date: {
      type: "string",
      pattern: "^\\d\\d\\d\\d-\\d\\d-\\d\\d$",
    },
  },
})
  .getDataSchema(
    parse(/** GraphQL */ `
      "A query that fetches users and does a search"
      query GetUsers {
        users {
          __typename
          id
          name
          role
          birthDate
          favourites {
            __typename
            name
            ... on Book {
              author
            }
            ... on Color {
              hex
            }
          }
        }
        search(term: "GraphQL") {
          __typename
          ... on User {
            name
          }
          ... BookFragment
          ... on Color {
            name
            hex
          }
        }
      }

      "A fragment that fetches book details"
      fragment BookFragment on Book {
        id
        name
        author
      }
    `)
  )
  ["~standard"].toJSONSchema({ io: "input", target: "draft-2020-12" });

writeFileSync(
  "./test-schema.json",
  JSON.stringify(testSchema, null, 2),
  "utf-8"
);

const ajv = new (Ajv as any as typeof import("ajv").Ajv)();
ajv.compile(testSchema);
