import {
  type DocumentNode,
  type FragmentDefinitionNode,
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLObjectType,
  type GraphQLOutputType,
  GraphQLSchema,
  GraphQLString,
  type InlineFragmentNode,
  isAbstractType,
  isEnumType,
  isInterfaceType,
  isListType,
  isNonNullType,
  isScalarType,
  isSpecifiedScalarType,
  isUnionType,
  Kind,
  type SelectionSetNode,
} from "graphql";
import type { JSONSchema } from "json-schema-typed/draft-2020-12";

export function buildOutputSchema(
  schema: GraphQLSchema,
  document: DocumentNode,
  scalarTypes: Record<string, JSONSchema.Interface> | undefined,
  parentType: GraphQLObjectType,
  selections: SelectionSetNode
): JSONSchema.Interface {
  return handleObjectType(parentType, selections);

  function handleMaybe(
    parentType: GraphQLOutputType,
    selections?: SelectionSetNode
  ): JSONSchema.Interface {
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
}
