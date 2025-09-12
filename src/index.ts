import {
  buildASTSchema,
  type DocumentNode,
  execute,
  type FormattedExecutionResult,
  type FragmentDefinitionNode,
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLObjectType,
  type GraphQLOutputType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLString,
  type GraphQLType,
  isEnumType,
  isInterfaceType,
  isListType,
  isNonNullType,
  isNullableType,
  isObjectType,
  isScalarType,
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

          return buildSchema(schema, definition) as any;
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
}

function buildSchema(
  schema: GraphQLSchema,
  operation: OperationDefinitionNode
): JSONSchema {
  const documentName = operation.name?.value || operation.operation;
  const types = schema.getTypeMap();

  function handleMaybe(
    parentType: GraphQLOutputType,
    selections?: SelectionSetNode
  ): JSONSchema {
    if (isNonNullType(parentType)) {
      const itemType = parentType.ofType;
      // TODO
      return handle(itemType as any, selections);
    } else {
      return {
        anyOf: [handle(parentType, selections), { type: "null" }],
      };
    }
  }

  function handle(
    parentType: Exclude<GraphQLOutputType, GraphQLNonNull<any>>,
    selections?: SelectionSetNode
  ): JSONSchema {
    if (isListType(parentType)) {
      return {
        type: "array",
        items: handleMaybe(parentType.ofType, selections),
      };
    }
    if (isScalarType(parentType)) {
      return {
        type: parentType.name,
      };
    }
    if (isInterfaceType(parentType)) {
      throw new Error("not supported");
    }
    if (isUnionType(parentType)) {
      throw new Error("not supported");
    }
    if (isEnumType(parentType)) {
      throw new Error("not supported");
    }
    return handleObjectType(parentType, selections!);
  }
  function handleObjectType(
    parentType: GraphQLObjectType,
    selections: SelectionSetNode
  ): Exclude<JSONSchema, boolean> {
    const fields = parentType.getFields();
    const properties: Record<string, JSONSchema> = {};

    for (const selection of selections.selections) {
      if (selection.kind === Kind.FIELD) {
        const name = selection.alias?.value || selection.name.value;
        const type = fields[selection.name.value]!.type;
        properties[name] = handleMaybe(type, selection.selectionSet);
      }
    }
    return {
      type: "object",
      properties,
      required: Object.keys(properties),
    };
  }

  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://example.com/product.schema.json",
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

// console.dir(
//   new GraphQLStandardSchemaGenerator({
//     schema: parse(`
//       type Query {
//         users: [User!]
//       }

//       type User {
//         id: Int
//         name: String!
//       }
//     `),
//   })
//     .getDataSchema(
//       parse(`
//       query GetUsers {
//         users {
//           id
//           name
//         }
//       }
//     `)
//     )
//     ["~standard"].toJSONSchema({ io: "input", target: "draft-2020-12" })
//     .properties,
//   { depth: null }
// );
