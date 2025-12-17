This package allows you to create [Standard Schema](https://github.com/standard-schema/standard-schema) compliant Schemas for GraphQL operation responses, data, fragments or input variables.

## Creating a Schema Generator

```ts
import { GraphQLStandardSchemaGenerator } from "@apollo/graphql-standard-schema";

const generator = new GraphQLStandardSchemaGenerator({
  schema: gql`
    type Query {
      hello: String
    }
  `,
});
// or
const generator = new GraphQLStandardSchemaGenerator({
  schema: new GraphQLSchema({ ... } ),
});
```

### Specifying custom Scalar types

You can also specify custom Scalar type definitions to control how those types are validated and how they end up in potentially generated JSON schemas:

```ts
const generator = new GraphQLStandardSchemaGenerator({
  schema: gql`
    scalar Date
    type Query {
      now: Date!
    }
  `,
  scalarTypes: {
    Date: new GraphQLScalarType<number, string>({
      name: "Date",
      description: "A date string in YYYY-MM-DD format",
      parseValue(value) {
        const date = new Date(value as string);
        if (isNaN(date.getTime())) {
          throw new TypeError(
            `Value is not a valid Date string: ${value as string}`
          );
        }
        return date.getTime();
      },
      serialize(value) {
        if (typeof value === "number") {
          value = new Date(value);
        }
        if (!(value instanceof Date) || isNaN(value.getTime())) {
          throw new TypeError(`Value is not a valid Date object: ${value}`);
        }
        return value.toISOString().split("T")[0];
      },
      extensions: {
        "@apollo/graphql-standard-schema": {
          serializedJsonSchema: {
            type: "string",
            pattern: "\\d{4}-\\d{1,2}-\\d{1,2}",
          },
          deserializedJsonSchema: {
            type: "number",
            // description will usually be inherited from the GraphQLScalarType description, but in this case we override it to match with the actual deserialized value
            description: "Unix timestamp in milliseconds",
          },
        },
      },
    }),
  },
});
```

> [!TIP]
> The JSON schema definitions are stored in the `extensions` field of the `GraphQLScalarType` under the key `"@apollo/graphql-standard-schema"`. This allows the scalar type to be used as a normal GraphQL scalar while also providing the necessary JSON schema information for validation and schema generation.

### All options:

```ts
namespace GraphQLStandardSchemaGenerator {
  export interface Options {
    schema: GraphQLSchema | DocumentNode;
    scalarTypes?: Scalars;
    defaultJSONSchemaOptions?: JSONSchemaOptions | "OpenAI";
    /**
     * An array of document transforms to apply to each document before generating schemas.
     *
     * This can be used to apply custom transformations to the GraphQL documents,
     * such as adding default fields, removing deprecated fields, etc.
     *
     * Defaults to `[addTypename]` if not provided.
     */
    documentTransfoms?: GraphQLStandardSchemaGenerator.DocumentTransform[];
  }

  export interface JSONSchemaOptions {
    /**
     * If true, nullable properties will be marked as optional in the generated JSON Schema.
     *
     * {@defaultValue true}
     *
     * When `defaultJSONSchemaOptions` is set to "OpenAI", this will be false.
     */
    optionalNullableProperties?: boolean;
    /**
     * If set to either `true` or `false`, this setting will be added to all object types.
     * @defaultValue undefined
     *
     * When `defaultJSONSchemaOptions` is set to "OpenAI", this will be false.
     */
    additionalProperties?: boolean;
  }
}
```

> [!NOTE]
> For more information on `defaultJSONSchemaOptions`, see [Standard JSON Schema and JSON Schema generation](#standard-json-schema-and-json-schema-generation).

## Schemas

Currently, this package supports generating the following types of schemas:

- Response schema - validates the entire GraphQL operation result (either `data` or `errors` field)
- Data schema - validates only the `data` field of a GraphQL operation result
- Fragment schema - validates the value of a GraphQL fragment
- Variables schema - validates the input variables for a GraphQL operation

### Validating GraphQL results

```ts
// create a "response" schema that will validate the result of a GraphQL operation
const responseSchema = generator.getResponseSchema(gql`
  query GetHello {
    hello
  }
`);

// this schema can now be used to validate GraphQL operation results
// results are either { valid: validInput } or { issues: [...] }
const result = responseSchema({
  data: {
    hello: "world",
  },
});
// result: is { value: { data: { hello: 'world' } } }

// this is also a valid GraphQL operation result - an object containing `errors` instead of `data`.
const result = responseSchema({
  errors: [{ message: "Something went wrong" }],
});
// result: is { value: { errors: [ { message: "Something went wrong" } ] } }

// this is an incorrect response
const result = responseSchema({
  data: {
    hello: 1,
  },
});
/*
// result is
{
  issues: [
    {
      message: 'String cannot represent a non string value: 1',
      path: [ 'data', 'hello' ]
    }
  ]
}
*/
```

> [!NOTE]
> `getResponseSchema` returns a multidirectional schema - see [directional schemas](#directional-schemas) for more details.

### Validating GraphQL data

You can also create a "data schema" that will validate the `data` field of a GraphQL operation result:

```ts
const dataSchema = generator.getDataSchema(gql`
  query GetHello {
    hello
  }
`);

const result = dataSchema({
  hello: "world",
});
// result is now { value: { hello: 'world' } }

// invalid data
const result = dataSchema({
  hello: { completely: "wrong" },
});
/*
// result is
{
  issues: [
    {
      message: 'String cannot represent a non string value: { completely: "wrong" }',
      path: [ 'hello' ]
    }
  ]
}
*/
```

> [!NOTE]
> `getDataSchema` returns a multidirectional schema - see [directional schemas](#directional-schemas) for more details.

### Validating GraphQL fragments

You can also create a schema to validate a fragment value:

```ts
const generator = new GraphQLStandardSchemaGenerator({
  schema: gql(`
    type User {
      id: ID!
      name: String!
      email: String!
    }

    type Query {
      me: User
    }
  `),
});

const fragmentSchema = generator.getFragmentSchema(
  gql(`
  fragment UserDetails on User {
    id
    name
    email
  }
`)
);

// valid
const result = fragmentSchema({
  // value now needs to contain `__typename` to match the fragment type condition
  __typename: "User",
  id: 123,
  name: "Alice",
  email: "alice@example.com",
});
/*
// result is
{
  value: {
    __typename: 'User',
    id: '123',
    name: 'Alice',
    email: 'alice@example.com'
  }
}
*/
```

When you have multiple fragments, specify which one to use

```ts
const multiFragmentSchema = generator.getFragmentSchema(
  gql`
    fragment UserBasic on User {
      id
      name
    }

    fragment UserFull on User {
      id
      name
      email
    }
  `,
  { fragmentName: "UserFull" }
);

// valid - validates against the UserFull fragment
const result = multiFragmentSchema({
  __typename: "User",
  id: 123,
  name: "Alice",
  email: "alice@example.com",
});
/*
// result is
{
  value: {
    __typename: 'User',
    id: '123',
    name: 'Alice',
    email: 'alice@example.com'
  }
}
*/
```

> [!NOTE]
> `getFragmentSchema` returns a multidirectional schema - see [directional schemas](#directional-schemas) for more details.

### Validating GraphQL variables

`generator.getVariablesSchema` allows you to create a schema that validates the input variables for a GraphQL operation:

```ts
const generator = new GraphQLStandardSchemaGenerator({
  schema: gql`
    scalar Date
    input EventSearchInput {
      after: Date
      before: Date
      city: String!
    }
    type Query {
      searchEvent(input: EventSearchInput!): [String]
    }
  `,
  scalarTypes: {
    Date: DateScalarDef,
  },
});

const variablesSchema = generator.getVariablesSchema(gql`
  query Search($input: EventSearchInput!) {
    searchEvent(input: $input)
  }
`);

// valid input
const result = variablesSchema({
  input: {
    after: "2025-01-01",
    city: "New York",
  },
});
// result is `{ value: { input: { after: '2025-01-01', city: 'New York' } } }`

// invalid input
const result = variablesSchema({
  input: {
    after: "2025-01-01",
    before: "2025-12-31",
  },
});
/*
// result is
{
  "issues": [
    {
      "message": "Expected value to be non-null.",
      "path": [
        "input",
        "city"
      ]
    }
  ]
}
*/
```

> [!NOTE]
> `getVariablesSchema` returns a multidirectional schema - see [directional schemas](#directional-schemas) for more details.

> [!INFO]
> `getVariablesSchema` will not add `null` for missing nullable fields by default, unless they were part of the input.
> Variable inputs can be very deeply nested with a lot of unspecified fields, so adding them indiscriminately could lead to very large objects.

### Directional Schemas

The moment you add scalars with custom serialization or parsing/deserialization logic, your schemas become "directional" - meaning they can validate data in multiple "directions":

- `schema.normalize` is a function (and full StandardSchema schema) that validates serialized data. It takes serialized data as input, and outputs serialized data. This is the normal behaviour for all multidirectional schemas.
- `schema.deserialize` is a function (and full StandardSchema schema) that validates deserialized data. It takes deserialized data as input, and outputs deserialized data.
- `schema.serialize` is a function (and full StandardSchema schema) that validates serialized data. It takes serialized data as input, and outputs serialized data.

So for example for this schema:

```ts
const generator = new GraphQLStandardSchemaGenerator({
  schema: gql`
    scalar Date
    type Query {
      now: Date!
      holidayName: String
    }
  `,
  scalarTypes: {
    Date: new GraphQLScalarType<number, string>({
      name: "Date",
      // serialization and deserialization logic
      parseValue(value) {
        /* ... */
      },
      serialize(value) {
        /* ... */
      },
      extensions: {
        "@apollo/graphql-standard-schema": {
          serializedJsonSchema: {
            type: "string",
            pattern: "\\d{4}-\\d{1,2}-\\d{1,2}",
          },
          deserializedJsonSchema: {
            type: "number",
            description: "Unix timestamp in milliseconds",
          },
        },
      },
    }),
  },
});

const dataSchema = generator.getDataSchema(gql`
  query GetNow {
    now
    holidayName
  }
`);
```

Let's look at some different behaviors:

#### `normalize` examples

```ts
const result = dataSchema.normalize({
  now: "2025-12-31",
  holidayName: "New Year's Eve",
});
// result is `{ value: { now: '2025-12-31', holidayName: "New Year's Eve" } }`
```

> [!NOTE]
> `normalize` is the default behavior for multidirectional schemas, so calling `dataSchema(data)` is equivalent to calling `dataSchema.normalize(data)`.

`normalize` will also try to fix data that is in the wrong format to bring it into the correct serialized format:

```ts
const result = dataSchema.normalize({
  now: "Dec 13, 2025",
});
// result is `{ value: { now: '2025-12-12', holidayName: null } }`
```

Two observations here:

- The input date string "Dec 13, 2025" was successfully parsed and reformatted to the correct "YYYY-MM-DD" format by passing it through the `parseValue` and `serialize` methods of the `Date` scalar.
- The missing `holidayName` field was automatically set to `null`, as per GraphQL's default behavior for nullable fields.

#### `deserialize` examples

```ts
const result = dataSchema.deserialize({
  now: "2025-12-31",
  holidayName: "New Year's Eve",
});
// result is `{ value: { now: 1767139200000, holidayName: "New Year's Eve" } }`
```

```ts
const result = dataSchema.deserialize({
  now: "Dec 13, 2025",
});
// result is `{ value: { now: 1765580400000, holidayName: null } }`
```

#### `serialize` examples

```ts
const result = dataSchema.serialize({
  now: 1767139200000,
  holidayName: "New Year's Eve",
});
// result is `{ value: { now: '2025-12-31', holidayName: "New Year's Eve" } }`
```

```ts
const result = dataSchema.serialize({
  now: new Date("Dec 13, 2025"),
});
// result is `{ value: { now: '2025-12-13', holidayName: null } }`
```

### Usage with TypeScript

If you pass `TypedDocumentNode` instances to the schema generator methods, the returned schemas will be fully typed according to the GraphQL operation types.

```ts
const generator = new GraphQLStandardSchemaGenerator({
  schema: gql`
    scalar Date
    type Query {
      now: Date!
      where: String!
    }
  `,
  scalarTypes: {
    Date: new GraphQLScalarType<Date, string>({
      /* ... */
    }),
  },
});

const query: TypedDocumentNode<{ now: Date; where: string }, {}> = gql`
  query GetNow {
    now
    where
  }
`;

const schema = generator.getDataSchema(query);
const normalizedResult = schema(unknownValue);
//     ^? StandardSchemaV1.Result<{ now: string; where: string; }>

const serializedResult = schema.serialize(unknownValue);
//     ^? StandardSchemaV1.Result<{ now: string; where: string; }>

const deserializedResult = schema.deserialize(unknownValue);
//     ^? StandardSchemaV1.Result<{ now: Date; where: string; }>
```

You can use the `StandardSchemaV1.InferInput` and `StandardSchemaV1.InferOutput` utility types to infer the input and output types of the generated schemas.

```ts
type Serialized = StandardSchemaV1.InferInput<typeof schema.deserialize>;
//    ^? { now: string; where: string; }
type Deserialized = StandardSchemaV1.InferOutput<typeof schema.deserialize>;
//    ^? { now: Date; where: string; }
```

## Standard Schema Integration

Every schema generated by this package is fully compliant with the [Standard Schema](https://standardschema.dev/) interface and can be used anywhere a Standard Schema is expected.

So you could use a `validateInput` function like this one to validate input data against a schema generated by this package:

```ts
import type { StandardSchemaV1 } from "@standard-schema/spec";

function validateInput(schema: StandardSchemaV1, data: unknown) {
  const result = schema["~standard"].validate(data);
  if (result instanceof Promise) {
    throw new TypeError("Schema validation must be synchronous");
  }
  if (result.issues) {
    throw new Error(JSON.stringify(result.issues, null, 2));
  }

  return result.value;
}
```

## Standard JSON Schema and JSON Schema generation

This package implements `StandardJSONSchemaV1` for all generated schemas, so you can use them in all libraries that support Standard JSON Schema. (E.g. the [ai SDK](https://www.npmjs.com/package/ai), [TanStack AI](https://www.npmjs.com/package/@tanstack/ai), among many others)

### Options for JSON Schema generation

When creating a `GraphQLStandardSchemaGenerator`, you can specify options that will control how JSON Schemas are generated from the GraphQL schema by passing in a configuration in the `defaultJSONSchemaOptions`.

You can also pass in these values into the `toJSONSchema` functions to override the defaults set in the generator:

```ts
toJSONSchema.input(dataSchema, {
  optionalNullableProperties: false,
});
```

The available options are:

```ts
namespace GraphQLStandardSchemaGenerator {
  export interface JSONSchemaOptions {
    /**
     * If true, nullable properties will be marked as optional in the generated JSON Schema.
     *
     * {@defaultValue true}
     *
     * When `defaultJSONSchemaOptions` is set to "OpenAI", this will be false.
     */
    optionalNullableProperties?: boolean;
    /**
     * If set to either `true` or `false`, this setting will be added to all object types.
     * @defaultValue undefined
     *
     * When `defaultJSONSchemaOptions` is set to "OpenAI", this will be false.
     */
    additionalProperties?: boolean;
  }
}
```

### Usage with OpenAI object generation

While OpenAI object generation works with JSON Schema, it doesn't follow a specific version of the standard and has some specific requirements around how schemas should be structured.
To get JSON Schemas that are optimized for OpenAI object generation, you can set the `defaultJSONSchemaOptions` to `"OpenAI"` when creating the `GraphQLStandardSchemaGenerator`.

```ts
const generator = new GraphQLStandardSchemaGenerator({
  schema: gql`
    type Query {
      hello: String
    }
  `,
  defaultJSONSchemaOptions: "OpenAI",
});
```

## Other exports

In addition to the `GraphQLStandardSchemaGenerator`, this package also exports some utility functions:

### toJSONSchema

Converts any schema generated with `GraphQLStandardSchemaGenerator` as well as any other `StandardJSONSchemaV1` to JSON Schema

#### Signature:

```ts
const toJSONSchema: {
  input(
    standardSchema: StandardJSONSchemaV1<unknown, unknown>,
    options?: StandardJSONSchemaV1.Options & {
      libraryOptions?: GraphQLStandardSchemaGenerator.JSONSchemaOptions;
    }
  ): Record<string, unknown>;
  output(
    standardSchema: StandardJSONSchemaV1<unknown, unknown>,
    options?: StandardJSONSchemaV1.Options & {
      libraryOptions: GraphQLStandardSchemaGenerator.JSONSchemaOptions;
    }
  ): Record<string, unknown>;
};
```

If no options are provided, they default to `{ target: "draft-2020-12" }`n

#### Usage:

```ts
const responseSchema = generator.getResponseSchema(gql`
  query GetHello {
    hello
  }
`);
const jsonSchema = toJSONSchema.input(responseSchema.serialized, {
  target: "draft-2020-12",
  libraryOptions: {
    optionalNullableProperties: false,
  },
});
```

### `composeStandardSchemas`

Composes multiple `StandardJSONSchemaV1` schemas into a single schema.

> [!NOTE]
> This library is somewhat limited and might not account for `anyOf` etc. in the root schema.

#### Signature:

```ts
// `CombinedSpec` is a combination of `StandardSchemaV1` and the experimental `StandardJSONSchema`

function composeStandardSchemas<
  Root extends CombinedSpec<any, any>,
  const Path extends string[],
  Extension extends CombinedSpec<any, any>,
  Required extends boolean = true,
>(
  /** The root schema. */
  rootSchema: Root,
  /** The path at which the extension schema should be included in the combined schema. */
  path: Path,
  /** The extension/child schema. */
  extension: Extension,
  /** If the child schema should be considered a required prop in the combined schema */
  required: Required = true as Required,
  /** If the property at `path` should be hidden from runtime checks when validating the root schema part */
  hideAddedFieldFromRootSchema = true
): CombinedSpec<
  InsertAt<
    StandardSchemaV1.InferInput<Root>,
    P,
    StandardSchemaV1.InferInput<Extension>,
    Required
  >,
  InsertAt<
    StandardSchemaV1.InferOutput<Root>,
    P,
    StandardSchemaV1.InferOutput<Extension>,
    Required
  >
>;
```

#### Usage:

```ts
const combinedStandardJSONSchema = composeStandardSchemas(
  z.strictObject({
    props: z.strictObject({
      id: z.string().uuid(),
      name: z.string(),
    }),
  }),
  ["props", "data"],
  schema
);
const jsonSchema = toJSONSchema.input(combinedStandardJSONSchema);
```

### `addTypename`

A document transform that adds `__typename` fields to all selection sets in a GraphQL document. This is the default document transform applied by `GraphQLStandardSchemaGenerator`, you might need to reference this if you want to apply it alongside your own custom document transforms.

#### Usage:

```ts
const generator = new GraphQLStandardSchemaGenerator({
  schema: gql`... `,
  documentTransfoms: [addTypename, myCustomTransform],
});
```
