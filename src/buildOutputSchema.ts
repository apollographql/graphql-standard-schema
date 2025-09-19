import {
  type DocumentNode,
  type FragmentDefinitionNode,
  getNamedType,
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
  const defs: NonNullable<JSONSchema.Interface["$defs"]> = {};

  function documentType<T extends JSONSchema.Interface>(
    type: GraphQLOutputType,
    obj: T
  ): T {
    const named = getNamedType(type);

    if (named.description) {
      defs[named.name] = {
        description: named.description,
      };
      return { $ref: `#/$defs/${named.name}`, ...obj };
    }
    return obj;
  }

  return { ...handleObjectType(parentType, selections), $defs: defs };

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
        return maybe(documentType(parentType, {}));
      }
      const scalarType = scalarTypes[parentType.name];
      if (!scalarType) {
        throw new Error(
          `Scalar type ${parentType.name} not found in \`scalarTypes\`, but \`scalarTypes\` option was provided.`
        );
      }
      return maybe(documentType(parentType, scalarType));
    }
    if (isInterfaceType(parentType) || isUnionType(parentType)) {
      if (!selections) {
        throw new Error(
          `Selections are required for interface and union types (${parentType.name})`
        );
      }
      const possibleTypes = schema.getPossibleTypes(parentType);
      const typeSchemas = possibleTypes.map((implementationType) =>
        handleObjectType(implementationType, selections)
      );

      if (nullable) {
        return documentType(parentType, {
          anyOf: [{ type: "null" }, ...typeSchemas],
        });
      }

      return documentType(parentType, {
        anyOf: typeSchemas,
      });
    }
    if (isEnumType(parentType)) {
      const refName = `enum_${parentType.name}`;
      defs[refName] ??= {
        title: `${parentType.name}`,
        ...(parentType.description
          ? { description: parentType.description }
          : {}),
        enum: parentType.getValues().map((v) => v.name),
      };

      return maybe({ $ref: `#/$defs/${refName}` });
    }
    return maybe(handleObjectType(parentType, selections!));
  }

  function handleObjectType(
    parentType: GraphQLObjectType,
    selections: SelectionSetNode
  ): JSONSchema.Interface {
    const fields = parentType.getFields();
    const properties: NonNullable<JSONSchema.Interface["properties"]> = {};
    const fragmentsMatches: JSONSchema.Interface[] = [];

    for (const selection of selections.selections) {
      switch (selection.kind) {
        case Kind.FIELD:
          const name = selection.alias?.value || selection.name.value;
          if (selection.name.value === "__typename") {
            properties[name] = {
              const: parentType.name,
            };
          } else {
            const type = fields[selection.name.value]!.type;
            properties[name] = {
              title: `${parentType.name}.${
                selection.name.value
              }: ${type.toString()}`,
              ...handleMaybe(type, selection.selectionSet),
            };
          }
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
              fragmentsMatches.push({
                ...handleObjectType(
                  parentType,
                  fragmentImplementation.selectionSet
                ),
                title: `${
                  fragmentImplementation.kind === Kind.FRAGMENT_DEFINITION
                    ? `Fragment ${fragmentImplementation.name.value}`
                    : "Fragment"
                } on ${typeCondition}`,
                ...("description" in fragmentImplementation &&
                fragmentImplementation.description
                  ? {
                      description: fragmentImplementation.description.value,
                    }
                  : {}),
              });
            }
            break;
          }
      }
    }
    return documentType(
      parentType,
      Object.assign(
        {
          type: "object",
          title: parentType.name,
          properties,
          required: Object.keys(properties),
        },
        fragmentsMatches.length > 0 ? { allOf: fragmentsMatches } : {}
      )
    );
  }
}
