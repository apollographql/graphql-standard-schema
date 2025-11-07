import Ajv from "ajv";
import { GraphQLScalarType, parse } from "graphql";
import { writeFileSync } from "node:fs";
import { GraphQLStandardSchemaGenerator, toJSONSchema } from "./src/index.ts";

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
      type: new GraphQLScalarType<Date, string>({
        parseValue(value) {
          const date = new Date(value as string);
          if (isNaN(date.getTime())) {
            throw new TypeError(
              `Value is not a valid Date string: ${value as string}`
            );
          }
          return date;
        },
        serialize(value) {
          if (!(value instanceof Date) || isNaN(value.getTime())) {
            throw new TypeError(`Value is not a valid Date object: ${value}`);
          }
          return value.toISOString().split("T")[0];
        },
        name: "Date",
        description: "A date string in YYYY-MM-DD format",
      }),
      jsonSchema: {
        serialized: { type: "string", pattern: "\\d{4}-\\d{1,2}-\\d{1,2}" },
        deserialized: {
          type: "number",
          description: "Unix timestamp in milliseconds",
        },
      },
    },
  },
}).getDataSchema(
  parse(/** GraphQL */ `
      "A query that fetches users and does a search"
      query GetUsers {
        users {
          __typename
          id
          ... on User {
            name
          }
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
);
const jsonSchema = toJSONSchema.input(testSchema, { target: "draft-07" });
writeFileSync(
  "./test-schema.json",
  JSON.stringify(jsonSchema, null, 2),
  "utf-8"
);

const ajv = new (Ajv as any as typeof import("ajv").Ajv)();
ajv.compile(jsonSchema);
