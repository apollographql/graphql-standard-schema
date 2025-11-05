import {
  getDirectiveValues,
  GraphQLEnumType,
  GraphQLIncludeDirective,
  GraphQLNonNull,
  GraphQLScalarType,
  GraphQLSkipDirective,
  GraphQLString,
  isAbstractType,
  isEnumType,
  isListType,
  isNonNullType,
  isObjectType,
  isScalarType,
  type FieldNode,
  type FragmentDefinitionNode,
  type FragmentSpreadNode,
  type GraphQLObjectType,
  type GraphQLOutputType,
  type GraphQLSchema,
  type InlineFragmentNode,
  type OperationDefinitionNode,
  type SelectionNode,
} from "graphql";
import type { GraphQLStandardSchemaGenerator } from "./index.ts";
import { assert } from "./assert.ts";
import type { StandardSchemaV1 } from "./standard-schema-spec.ts";
import type { TypedDocumentNode } from "@graphql-typed-document-node/core";

type SchemaResult<
  TData,
  Scalars extends GraphQLStandardSchemaGenerator.ScalarDefinitions,
  Mode = "parse" | "deserialize",
> = Mode extends "deserialize"
  ? GraphQLStandardSchemaGenerator.Deserialized<TData, Scalars>
  : GraphQLStandardSchemaGenerator.Serialized<TData, Scalars>;

export function parseData<
  TData,
  TVariables extends Record<string, unknown>,
  Scalars extends GraphQLStandardSchemaGenerator.ScalarDefinitions,
  Mode extends "parse" | "deserialize",
>(
  data: unknown,
  operation: OperationDefinitionNode,
  schema: GraphQLSchema,
  document: TypedDocumentNode<TData, TVariables>,
  variableValues: TVariables,
  mode: Mode,
  initialPath: Array<string | number> = []
): StandardSchemaV1.Result<SchemaResult<TData, Scalars, Mode>> {
  const initialTypename =
    operation.operation === "query"
      ? schema.getQueryType()
      : operation.operation === "mutation"
        ? schema.getMutationType()
        : operation.operation === "subscription"
          ? schema.getSubscriptionType()
          : undefined;
  assert(
    initialTypename,
    `Schema does not have root type for ${operation.operation} operations`
  );

  return parseSelectionSet<TData, TVariables, Scalars, Mode>({
    data,
    selections: operation.selectionSet.selections,
    rootType: initialTypename,
    rootPath: initialPath,
    schema,
    document,
    variableValues,
    mode,
  });
}

export function parseSelectionSet<
  TData,
  TVariables extends Record<string, unknown>,
  Scalars extends GraphQLStandardSchemaGenerator.ScalarDefinitions,
  Mode extends "parse" | "deserialize",
>({
  data,
  selections,
  rootType,
  rootPath,
  schema,
  document,
  variableValues,
  mode,
}: {
  data: unknown;
  selections: readonly SelectionNode[];
  rootType: GraphQLObjectType;
  rootPath: Array<string | number>;
  schema: GraphQLSchema;
  document: TypedDocumentNode<TData, TVariables>;
  variableValues: TVariables;
  /**
   * Indicated whether scalars should be
   * * deserialized into their runtime values (e.g. `number` -> `Date`)
   * * parsed/validated: they might be coerced by scalar parsing if the scalar allows it,
   *   but they will be returned as serialized values -
   *   e.g. `number` -> `number` for a `Date` scalar
   *   or `string|number` -> `number` for a `Date` scalar that parses both `string` and `number`, but serializes into `number`
   */
  mode: Mode;
}): StandardSchemaV1.Result<SchemaResult<TData, Scalars, Mode>> {
  const parseScalar = (
    value: unknown,
    scalar: GraphQLScalarType | GraphQLEnumType
  ) => {
    const deserialized = scalar.parseValue(value);
    if (mode === "deserialize") {
      return deserialized;
    }
    return scalar.serialize(deserialized);
  };

  const fragments = Object.fromEntries(
    document.definitions
      .filter(
        (def): def is FragmentDefinitionNode =>
          def.kind === "FragmentDefinition"
      )
      .map((frag) => [frag.name.value, frag])
  );

  const issues: StandardSchemaV1.Issue[] = [];
  const parsed = handleSelections(
    data as Record<string, unknown>,
    selections,
    rootType,
    rootPath
  );

  if (issues.length > 0) {
    return { issues };
  }
  return { value: parsed as any };

  function handleSelections(
    data: Record<string, unknown>,
    selections: readonly SelectionNode[],
    parentType: GraphQLObjectType,
    path: Array<string | number>
  ): Record<string, unknown> {
    const accumulatedSelections: Record<
      string,
      {
        schemaType: GraphQLOutputType | undefined;
        fieldName: string;
        selections: SelectionNode[];
      }
    > = {};
    const accumulatedData: Record<string, unknown> = {};
    const fields = parentType.getFields();
    const visitedFragments = new Set<string>();

    const unhandled = new Set(selections);
    for (const selection of unhandled) {
      if (!shouldIncludeNode(variableValues, selection)) {
        continue;
      }
      if (
        selection.kind === "FragmentSpread" ||
        selection.kind === "InlineFragment"
      ) {
        let fragment: FragmentDefinitionNode | InlineFragmentNode | undefined;
        if (selection.kind === "FragmentSpread") {
          const fragmentName = selection.name.value;
          if (visitedFragments.has(fragmentName)) {
            continue;
          }
          visitedFragments.add(fragmentName);
          fragment = fragments[fragmentName];

          assert(fragment, `Fragment "${fragmentName}" not found`);
        } else {
          fragment = selection;
        }

        if (fragment.typeCondition) {
          const abstractType = schema.getType(
            fragment.typeCondition.name.value
          );
          assert(
            abstractType,
            `Type "${fragment.typeCondition.name.value}" not found in schema`
          );
          if (isObjectType(abstractType)) {
            if (abstractType.name !== parentType.name) {
              continue;
            }
          } else if (isAbstractType(abstractType)) {
            if (!schema.isSubType(abstractType, parentType)) {
              continue;
            }
          } else {
            assert(
              false,
              `Type "${abstractType.name}" is not an object or abstract type`
            );
          }
        }
        fragment.selectionSet.selections.forEach((fragmentSelection) =>
          unhandled.add(fragmentSelection)
        );
      }
      if (selection.kind === "Field") {
        let childType =
          selection.name.value === "__typename"
            ? typenameType
            : fields[selection.name.value]?.type;
        const key = selection.alias?.value || selection.name.value;

        accumulatedSelections[key] ??= {
          schemaType: childType,
          fieldName: selection.name.value,
          selections: [],
        };
        if (selection.selectionSet) {
          accumulatedSelections[key].selections.push(
            ...selection.selectionSet?.selections
          );
        }
      }
    }
    for (const [key, config] of Object.entries(accumulatedSelections)) {
      try {
        const fieldName = config.fieldName;
        let childType = config.schemaType;
        let fieldData = data[key];
        if (fieldName === "__typename" && isObjectType(parentType)) {
          fieldData = parentType.name;
        }
        assert(
          childType,
          `Field "${fieldName}" not found on type "${parentType.name}"`
        );
        if (isNonNullType(childType)) {
          childType = (childType as GraphQLNonNull<GraphQLOutputType>).ofType;
        } else {
          if (fieldData == null) {
            accumulatedData[key] = null;
            continue;
          }
        }
        if (isScalarType(childType) || isEnumType(childType)) {
          accumulatedData[key] = parseScalar(fieldData, childType);
          continue;
        }
        if (isListType(childType)) {
          childType = childType.ofType;
          let nullable = true;
          if (isNonNullType(childType)) {
            nullable = false;
            childType = (childType as GraphQLNonNull<GraphQLOutputType>).ofType;
          }
          assert(Array.isArray(fieldData), `Expected list for field "${key}"`);
          accumulatedData[key] = fieldData.map((item, idx) => {
            try {
              if (item == null) {
                assert(
                  nullable,
                  `Expected non-nullable type "${(childType as GraphQLObjectType).name}" not to be null.`
                );
                return null;
              }
              if (isScalarType(childType) || isEnumType(childType)) {
                return parseScalar(item, childType);
              }
              assert(
                isObjectType(childType),
                `Expected ${childType} to be an object type.`
              );
              assert(
                typeof item === "object",
                `Expected list item to be ${childType}, but got ${typeof item} instead.`
              );
              return handleSelections(
                item,
                config.selections,
                childType,
                path.concat(key, idx)
              );
            } catch (e) {
              issues.push({
                message: (e as Error).message,
                path: path.concat(key, idx),
              });
            }
          });
          continue;
        }
        if (isAbstractType(childType)) {
          const typename =
            typeof fieldData === "object" &&
            fieldData &&
            "__typename" in fieldData &&
            fieldData["__typename"];
          assert(
            typename,
            `Expected object with __typename for abstract type "${childType.name}"`
          );
          assert(
            typeof typename === "string",
            `Expected __typename to be a string, but got ${typeof typename}`
          );
          const specificType = schema.getType(typename);
          assert(
            specificType && isObjectType(specificType),
            `Could not resolve concrete type for abstract type "${childType.name}" - "${typename}" is not an object type.`
          );
          childType = specificType;
        }
        assert(
          isObjectType(childType),
          `expected object type, but got ${childType.name}`
        );
        assert(
          typeof fieldData === "object",
          `Expected type "${childType.name}" to be an object.`
        );
        assert(
          fieldData != null,
          `Expected non-nullable type "${childType.name}" not to be null.`
        );
        accumulatedData[key] = handleSelections(
          fieldData as Record<string, unknown>,
          config.selections,
          childType,
          path.concat(key)
        );
      } catch (e) {
        issues.push({
          message: (e as Error).message,
          path: path.concat(key),
        });
      }
    }

    return accumulatedData;
  }
}

/**
 * Determines if a field should be included based on the `@include` and `@skip`
 * directives, where `@skip` has higher precedence than `@include`.
 */
function shouldIncludeNode(
  variableValues: { [variable: string]: unknown },
  node: FragmentSpreadNode | FieldNode | InlineFragmentNode
): boolean {
  const skip = getDirectiveValues(GraphQLSkipDirective, node, variableValues);
  if (skip?.if === true) {
    return false;
  }

  const include = getDirectiveValues(
    GraphQLIncludeDirective,
    node,
    variableValues
  );
  if (include?.if === false) {
    return false;
  }
  return true;
}

const typenameType = new GraphQLNonNull(GraphQLString);
