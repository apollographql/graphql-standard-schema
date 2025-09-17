import {
  buildASTSchema,
  type DocumentNode,
  execute,
  type FormattedExecutionResult,
  type FragmentDefinitionNode,
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLFloat,
  GraphQLInt,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  type GraphQLOutputType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLString,
  type GraphQLType,
  GraphQLUnionType,
  type InlineFragmentNode,
  isAbstractType,
  isEnumType,
  isInterfaceType,
  isListType,
  isNonNullType,
  isNullableType,
  isObjectType,
  isScalarType,
  isSpecifiedScalarType,
  isUnionType,
  Kind,
  type OperationDefinitionNode,
  OperationTypeNode,
  parse,
  type SelectionSetNode,
} from "graphql";
import type { StandardSchemaV1 } from "./standard-schema-spec.ts";
import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import type { JSONSchema } from "json-schema-typed/draft-2020-12";

export namespace GraphQLStandardSchemaGenerator {
  export interface Options {
    schema: GraphQLSchema | DocumentNode;
    scalarTypes?: Record<string, JSONSchema.Interface>;
  }
}
export class GraphQLStandardSchemaGenerator {
  private schema!: GraphQLSchema;
  constructor({ schema }: GraphQLStandardSchemaGenerator.Options) {
    this.replaceSchema(schema);
  }

  replaceSchema(schema: GraphQLSchema | DocumentNode) {
    if ("getTypeMap" in schema) {
      this.schema = schema;
    } else if ("kind" in schema) {
      this.schema = buildASTSchema(schema);
    } else {
      throw new Error(
        "Schema needs to be of type GraphQLSchema or DocumentNode"
      );
    }
  }

  getDataSchema<TData>(
    document: TypedDocumentNode<TData>
  ): StandardSchemaV1.WithJSONSchemaSource<TData, TData> {
    const schema = this.schema;
    const definitions = document.definitions.filter(
      (def): def is OperationDefinitionNode =>
        def.kind === "OperationDefinition" && !!def.name
    );
    if (definitions.length !== 1) {
      throw new Error("Document must contain exactly one named operation");
    }
    const definition = definitions[0]!;

    return {
      ["~standard"]: {
        types: {
          input: {} as TData,
          output: {} as TData,
        },
        toJSONSchema: ({ target }) => {
          if (target !== "draft-2020-12") {
            throw new Error("Only draft-2020-12 is supported");
          }

          return buildOutputSchema(schema, document, definition) as any;
        },
        validate(value): StandardSchemaV1.Result<TData> {
          const result = execute({
            schema,
            document,
            // TODO: do we need to fake variables here?
            // variableValues: operation.variables,
            fieldResolver: (source, args, context, info) => {
              const value = source[info.fieldName];

              // We use field resolvers to be more strict with the value types that
              // were returned by the AI.
              let returnType = info.returnType;
              let isNonNull = false;

              // Check if it's a non-null type
              if (returnType instanceof GraphQLNonNull) {
                isNonNull = true;
                returnType = returnType.ofType;
              }

              // Handle null values
              if (value === null) {
                if (isNonNull) {
                  throw new TypeError(
                    `Non-nullable field ${info.fieldName} cannot be null`
                  );
                }
                return null; // Null is valid for nullable fields
              }

              // Validate scalar types
              if (returnType instanceof GraphQLScalarType) {
                switch (returnType.name) {
                  case GraphQLString.name:
                    if (typeof value !== "string") {
                      throw new TypeError(
                        `Value for scalar type ${returnType.name} is not string: ${value}`
                      );
                    }
                    break;
                  case GraphQLFloat.name:
                    if (typeof value !== "number") {
                      throw new TypeError(
                        `Value for scalar type ${returnType.name} is not number: ${value}`
                      );
                    }
                    break;
                  case GraphQLInt.name:
                    if (typeof value !== "number") {
                      throw new TypeError(
                        `Value for scalar type ${returnType.name} is not number: ${value}`
                      );
                    }
                    break;
                  case GraphQLBoolean.name:
                    if (typeof value !== "boolean") {
                      throw new TypeError(
                        `Value for scalar type ${returnType.name} is not boolean: ${value}`
                      );
                    }
                    break;
                }
              }

              return value;
            },
            rootValue: value,
          }) as FormattedExecutionResult;

          if (result.errors?.length) {
            return {
              issues: result.errors,
            };
          }
          return { value: result.data as TData };
        },
        vendor: "@apollo/graphql-standard-schema",
        version: 1,
      },
    };
  }

  getResponseSchema<TData>(
    document: TypedDocumentNode<TData>
  ): StandardSchemaV1.WithJSONSchemaSource<
    FormattedExecutionResult<TData>,
    FormattedExecutionResult<TData>
  > {
    return {
      ["~standard"]: {
        types: {
          input: {} as FormattedExecutionResult<TData>,
          output: {} as FormattedExecutionResult<TData>,
        },
        toJSONSchema: () => {
          throw new Error("Not implemented");
        },
        validate(value) {
          throw new Error("Not implemented");
        },
        vendor: "@apollo/graphql-standard-schema",
        version: 1,
      },
    };
  }

  getFragmentSchema<TData>(
    document: TypedDocumentNode<TData>,
    {
      fragmentName,
    }: {
      fragmentName?: string;
    } = {}
  ): StandardSchemaV1.WithJSONSchemaSource<TData, TData> {
    if (
      !document.definitions.every((def) => def.kind === "FragmentDefinition")
    ) {
      throw new Error("Document must only contain fragment definitions");
    }
    const fragments = document.definitions as FragmentDefinitionNode[];

    if (fragments.length === 0) {
      throw new Error("No fragments found in document");
    }
    if (fragments.length > 1 && !fragmentName) {
      throw new Error(
        "Multiple fragments found, please specify a fragmentName"
      );
    }
    const fragment = fragments.find((def) =>
      fragmentName ? def.name.value === fragmentName : true
    );
    if (!fragment) {
      throw new Error(
        `Fragment with name ${fragmentName} not found in document`
      );
    }
    const queryDocument: TypedDocumentNode<TData> = {
      ...document,
      definitions: [
        ...fragments,
        {
          kind: Kind.OPERATION_DEFINITION,
          operation: OperationTypeNode.QUERY,
          name: { kind: Kind.NAME, value: "FragmentQuery" },
          selectionSet: {
            kind: Kind.SELECTION_SET,
            selections: [
              {
                kind: Kind.FRAGMENT_SPREAD,
                name: { kind: Kind.NAME, value: fragment.name.value },
              },
            ],
          },
        },
      ],
    };
    return this.getDataSchema<TData>(queryDocument);
  }

  getVariablesSchema<TVariables>(
    document: TypedDocumentNode<any, TVariables>
  ): StandardSchemaV1.WithJSONSchemaSource<TVariables, TVariables> {
    return {
      ["~standard"]: {
        types: {
          input: {} as TVariables,
          output: {} as TVariables,
        },
        toJSONSchema: () => {
          throw new Error("Not implemented");
        },
        validate(value) {
          throw new Error("Not implemented");
        },
        vendor: "@apollo/graphql-standard-schema",
        version: 1,
      },
    };
  }
}

function buildOutputSchema(
  schema: GraphQLSchema,
  document: DocumentNode,
  operation: OperationDefinitionNode,
  scalarTypes?: Record<string, JSONSchema.Interface> | undefined
): JSONSchema {
  const documentName = operation.name?.value || operation.operation;

  function handleMaybe(
    parentType: GraphQLOutputType,
    selections?: SelectionSetNode
  ): JSONSchema {
    if (isNonNullType(parentType)) {
      const itemType = parentType.ofType;
      if (isNonNullType(itemType)) {
        // nested non-null should be impossible, but this makes TypeScript happy and is safer on top
        return handleMaybe(itemType, selections);
      }
      return handle(itemType, false, selections);
    } else {
      return handle(parentType, true, selections);
    }
  }

  function handle(
    parentType: Exclude<GraphQLOutputType, GraphQLNonNull<any>>,
    nullable: boolean,
    selections?: SelectionSetNode
  ): JSONSchema.Interface {
    function maybe(schema: JSONSchema.Interface): JSONSchema.Interface {
      if (nullable) {
        return {
          anyOf: [{ type: "null" }, schema],
        };
      }
      return schema;
    }

    if (isListType(parentType)) {
      return maybe({
        type: "array",
        items: handleMaybe(parentType.ofType, selections),
      });
    }
    if (isSpecifiedScalarType(parentType)) {
      switch (parentType.name) {
        case GraphQLString.name:
          return maybe({ type: "string" });
        case GraphQLInt.name:
          return maybe({ type: "integer" });
        case GraphQLFloat.name:
          return maybe({ type: "number" });
        case GraphQLBoolean.name:
          return maybe({ type: "boolean" });
        case "ID":
          return maybe({ type: "string" });
      }
    }
    if (isScalarType(parentType)) {
      if (!scalarTypes) {
        return maybe({});
      }
      const scalarType = scalarTypes[parentType.name];
      if (!scalarType) {
        throw new Error(
          `Scalar type ${parentType.name} not found in \`scalarTypes\`, but \`scalarTypes\` option was provided.`
        );
      }
      return maybe(scalarType);
    }
    if (isInterfaceType(parentType) || isUnionType(parentType)) {
      if (!selections) {
        throw new Error(
          `Selections are required for interface and union types (${parentType.name})`
        );
      }
      const possibleTypes = schema.getPossibleTypes(parentType);
      const base: Array<JSONSchema.Interface> = nullable
        ? [{ type: "null" }]
        : [];
      return {
        anyOf: base.concat(
          ...possibleTypes.map((implementationType) =>
            maybe(handleObjectType(implementationType, selections))
          )
        ),
      };
    }
    if (isEnumType(parentType)) {
      const base: Array<JSONSchema.Interface> = nullable
        ? [{ type: "null" }]
        : [];
      return {
        anyOf: base.concat(
          ...parentType.getValues().map((v) => ({ const: v.name }))
        ),
      };
    }
    return maybe(handleObjectType(parentType, selections!));
  }

  function handleObjectType(
    parentType: GraphQLObjectType,
    selections: SelectionSetNode
  ): JSONSchema.Interface {
    const fields = parentType.getFields();
    const properties: Record<string, JSONSchema> = {};
    const fragmentsMatches: JSONSchema.Interface[] = [];

    for (const selection of selections.selections) {
      switch (selection.kind) {
        case Kind.FIELD:
          const name = selection.alias?.value || selection.name.value;
          const type = fields[selection.name.value]!.type;
          properties[name] = handleMaybe(type, selection.selectionSet);
          break;

        case Kind.INLINE_FRAGMENT:
        case Kind.FRAGMENT_SPREAD:
          let fragmentImplementation:
            | InlineFragmentNode
            | FragmentDefinitionNode
            | undefined;
          if (selection.kind === Kind.INLINE_FRAGMENT) {
            fragmentImplementation = selection;
          } else {
            fragmentImplementation = document.definitions.find(
              (def): def is FragmentDefinitionNode =>
                def.kind === Kind.FRAGMENT_DEFINITION &&
                def.name.value === selection.name.value
            );
            if (!fragmentImplementation) {
              throw new Error(
                `Fragment ${selection.name.value} not found in document`
              );
            }
          }
          const typeCondition =
            fragmentImplementation.typeCondition?.name.value;
          if (typeCondition) {
            const conditionType = schema.getType(typeCondition);

            const fragmentApplies =
              conditionType?.name === parentType.name ||
              (isAbstractType(conditionType) &&
                schema.isSubType(conditionType, parentType));

            if (fragmentApplies) {
              fragmentsMatches.push(
                handleObjectType(
                  parentType,
                  fragmentImplementation.selectionSet
                )
              );
            }
            break;
          }
      }
    }
    return Object.assign(
      {
        type: "object",
        properties,
        required: Object.keys(properties),
      },
      fragmentsMatches.length > 0 ? { allOf: fragmentsMatches } : {}
    );
  }

  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: documentName,
    ...handleObjectType(
      operation.operation === OperationTypeNode.QUERY
        ? schema.getQueryType()!
        : operation.operation === OperationTypeNode.SUBSCRIPTION
        ? schema.getSubscriptionType()!
        : schema.getMutationType()!,

      operation.selectionSet
    ),
  };
}

function buildVariablesSchema(
  schema: GraphQLSchema,
  operation: OperationDefinitionNode,
  scalarTypes?: Record<string, JSONSchema.Interface> | undefined
): JSONSchema {
  throw new Error("Not implemented");
}

console.dir(
  new GraphQLStandardSchemaGenerator({
    schema: parse(/** GraphQL */ `
      enum Role {
        ADMIN 
        USER 
        GUEST 
      }

      interface Favourite {
        name: String!
      }

      interface Color implements Favourite {
        name: String!
        hex: String!
      }

      type Book implements Favourite {
        id: ID!
        name: String!
        author: String!
      }

      union SearchResult = User | Book | Color

      type Query {
        users: [User]
        search(term: String!): [SearchResult!]!
      }

      type User {
        id: Int!
        name: String!
        role: Role
        favourites: [Favourite!]!
      }
    `),
    scalarTypes: {
      Date: {
        type: "string",
        format: "date",
      },
    },
  })
    .getDataSchema(
      parse(/** GraphQL */ `
      query GetUsers {
        users {
          id
          name
          role
          favourites {
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
          # TODO __typename
          ... on User {
            name
          }
          ... on Book {
            name
            author
          }
          ... on Color {
            name
            hex
          }
        }
      }
    `)
    )
    ["~standard"].toJSONSchema({ io: "input", target: "draft-2020-12" })
    .properties,
  { depth: null }
);
