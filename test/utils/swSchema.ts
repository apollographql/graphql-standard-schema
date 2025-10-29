import { buildSchema } from "graphql";
import { gql } from "./test-helpers.ts";

export const swSchema = buildSchema(/**GraphQL*/ `
"""
A character from the Star Wars universe
"""
type Character implements Node{
  id: ID!
  "The name of the character."
  name: String!
  friends: [Character]
  appearsIn: [Episode!]!
}

type Human implements Character & Node {
  id: ID!
  fullName: String
  name: String @deprecated(reason: "Use fullName.")
  friends: [Character]
  appearsIn: [Episode]!
  starships: [Starship]
  totalCredits: Int
}
 
type Droid implements Character & Node {
  id: ID!
  name: String!
  friends: [Character]
  appearsIn: [Episode]!
  primaryFunction: String
}

enum LengthUnit {
    METER
    FOOT
}

type Starship implements Node{
  id: ID!
  name: String!
  length(unit: LengthUnit = METER): Float
}

interface Node {
  id: ID!
}

type Episode implements Node {
    id: ID!
    name: String!
    released: Date!
    type: EpisodeType!
}

enum EpisodeType {
    ORIGINAL
    PREQUEL
    SEQUEL
    SPINOFF
}

union SearchResult = Human | Droid | Starship
 
scalar Date

"""
The query type, represents all of the entry points into our object graph
"""
type Query {

  droid(id: ID!): Droid
  """
  Fetches the hero of a specified Star Wars film.
  """
  hero(
    episode: ID!
  ): Character

  search(text: String!): [SearchResult!]
}

type Review implements Node {
  id: ID!
  stars: Int!
  commentary: String
}

input ReviewInput {
  stars: Int!
  commentary: String
}

input EpisodeInput {
    name: String!
    released: Date!
    type: EpisodeType!
}
 
type Mutation {
  createReview(episode: ID, review: ReviewInput!): Review
  addEpisode(episode: EpisodeInput!): Episode!
}

type Subscription {
  reviewCreated: Review
}
`);

export const SearchCharacter = gql<
  { search: Array<{ id: string; name: string } | {}> },
  { text: string }
>(/*GraphQL*/ `
  query SearchCharacter($text: String!) {
    search(text: $text) {
      ... on Character {
        id
        name
        friends {
            id
            name
        }
      }
      ... on Human {
        fullName
        starships {
            id
            name
        }
      }
      ... on Droid {
        primaryFunction
      }
    }
  }
`);
