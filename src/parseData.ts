import {
  getDirectiveValues,
  GraphQLIncludeDirective,
  GraphQLNonNull,
  GraphQLScalarType,
  GraphQLSkipDirective,
  isAbstractType,
  isListType,
  isNullableType,
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
  const parseScalar = (value: unknown, scalar: GraphQLScalarType) => {
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
      { schemaType: GraphQLOutputType; selections: SelectionNode[] }
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
            isAbstractType(abstractType),
            `Abstract Type "${fragment.typeCondition.name.value}" not found in schema`
          );
          if (schema.isSubType(abstractType, parentType)) {
            continue;
          }
        }
        fragment.selectionSet.selections.forEach((fragmentSelection) =>
          unhandled.add(fragmentSelection)
        );
      }
      if (selection.kind === "Field") {
        let childType = fields[selection.name.value]?.type;
        const key = selection.alias?.value || selection.name.value;
        const fieldData = data[key];
        assert(
          childType,
          `Field "${selection.name.value}" not found on type "${parentType.name}"`
        );
        if (isNullableType(childType)) {
          if (fieldData == null) {
            accumulatedData[key] = null;
            continue;
          }
          childType = (childType as GraphQLNonNull<GraphQLOutputType>).ofType;
        }
        if (isScalarType(childType)) {
          accumulatedData[key] = parseScalar(fieldData, childType);
          continue;
        }
        accumulatedSelections[key] ??= {
          schemaType: childType,
          selections: [],
        };
        accumulatedSelections[key].selections.push(selection);
      }
    }
    for (const [key, config] of Object.entries(accumulatedSelections)) {
      const fieldData = data[key];
      let childType = config.schemaType;
      if (isListType(childType)) {
        childType = childType.ofType;
        let nullable = false;
        if (isNullableType(childType)) {
          nullable = true;
          childType = (childType as GraphQLNonNull<GraphQLOutputType>).ofType;
        }
        assert(Array.isArray(fieldData), `Expected list for field "${key}"`);
        accumulatedData[key] = fieldData.map((item, idx) => {
          if (item == null) {
            assert(
              nullable,
              `Expected non-nullable type "${(childType as GraphQLObjectType).name}" not to be null.`
            );
            return null;
          }
          if (isScalarType(childType)) {
            return parseScalar(item, childType);
          }
          assert(isObjectType(childType));
          assert(typeof item === "object");
          return handleSelections(
            item,
            config.selections,
            childType,
            path.concat(key, idx)
          );
        });
        continue;
      }
      assert(isObjectType(childType));
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
