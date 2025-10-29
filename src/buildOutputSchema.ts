import {
  type DocumentNode,
  type FieldNode,
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
import type { OpenAiSupportedJsonSchema } from "./openAiSupportedJsonSchema.ts";
import { equal } from "@wry/equality";
import { assert } from "./assert.ts";
import type { GraphQLStandardSchemaGenerator } from "./index.ts";

export function buildOutputSchema(
  schema: GraphQLSchema,
  document: DocumentNode,
  scalarTypes: Record<string, OpenAiSupportedJsonSchema.Anything> | undefined,
  parentType: GraphQLObjectType,
  selections: SelectionSetNode,
  options: GraphQLStandardSchemaGenerator.JSONSchemaOptions
): OpenAiSupportedJsonSchema {
  const defs: NonNullable<OpenAiSupportedJsonSchema["$defs"]> = {};

  const objectTypeSpread: { additionalProperties?: boolean } =
    options.additionalProperties !== undefined
      ? { additionalProperties: options.additionalProperties }
      : {};

  function documentType<T extends OpenAiSupportedJsonSchema.Anything>(
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
  ): OpenAiSupportedJsonSchema.Anything {
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
  ): OpenAiSupportedJsonSchema.Anything {
    function maybe(
      schema: OpenAiSupportedJsonSchema.Anything
    ): OpenAiSupportedJsonSchema.Anything {
      if (!nullable) return schema;
      if ("const" in schema) {
        return { anyOf: [schema, { type: "null" }] };
      } else if ("type" in schema) {
        if (Array.isArray(schema.type)) {
          if (!schema.type.includes("null")) {
            return {
              ...schema,
              type: [...schema.type, "null"],
            };
          }
        } else if (schema.type !== "null") {
          return {
            ...schema,
            type: [schema.type, "null"],
          };
        }
        return schema;
      } else if ("anyOf" in schema) {
        if (
          !schema.anyOf.some(
            (s) =>
              "type" in s && (s.type === "null" || s.type?.includes("null"))
          )
        ) {
          return {
            ...schema,
            anyOf: [{ type: "null" }, ...schema.anyOf],
          };
        }
        return schema;
      } else if ("$ref" in schema) {
        throw new Error(
          "unhandled maybe $ref case in " + JSON.stringify(schema)
        );
      } else if ("enum" in schema) {
        if (!schema.enum.includes(null)) {
          return {
            ...schema,
            enum: [...schema.enum, null],
          };
        }
        return schema;
      } else {
        throw new Error("unhandled maybe case in " + JSON.stringify(schema));
      }
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
      const scalarType = scalarTypes?.[parentType.name];
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

      return documentType(
        parentType,
        maybe({
          anyOf: typeSchemas,
        })
      );
    }
    if (isEnumType(parentType)) {
      const refName = `enum_${nullable ? "maybe_" : ""}${parentType.name}`;
      const base: Array<string | null> = nullable ? [null] : [];
      defs[refName] ??= {
        title: `${parentType.name}`,
        ...(parentType.description
          ? { description: parentType.description }
          : {}),
        enum: base.concat(parentType.getValues().map((v) => v.name)),
      };

      return { $ref: `#/$defs/${refName}` };
    }
    return maybe(handleObjectType(parentType, selections!));
  }

  function handleObjectType(
    parentType: GraphQLObjectType,
    selections: SelectionSetNode
  ): OpenAiSupportedJsonSchema.ObjectDef {
    const fields = parentType.getFields();
    const properties: NonNullable<
      OpenAiSupportedJsonSchema.ObjectDef["properties"]
    > = {};
    const required = new Set();
    if (options.addTypename) {
      properties.__typename = { const: parentType.name };
      required.add("__typename");
    }

    const normalized = normalizeSelections(parentType, selections);

    for (let i = 0; i < normalized.length; i++) {
      const selection = normalized[i]!;
      const alias = selection.alias?.value || selection.name.value;

      if (selection.name.value === "__typename") {
        properties[alias] = { const: parentType.name };
        required.add(alias);
        continue;
      } else {
        const type = fields[selection.name.value]!.type;
        properties[alias] = {
          title: `${parentType.name}.${
            selection.name.value
          }: ${type.toString()}`,
          ...handleMaybe(type, selection.selectionSet),
        };
        if (!options.optionalNullableProperties || isNonNullType(type)) {
          required.add(alias);
        }
      }
    }
    return documentType(parentType, {
      type: "object" as const,
      ...objectTypeSpread,
      title: parentType.name,
      properties,
      required: [...required.values()],
    } satisfies OpenAiSupportedJsonSchema.ObjectDef);
  }

  /**
   * Turns a selection set that might contain fragments into a selection set that contains
   */
  function normalizeSelections(
    parentType: GraphQLObjectType,
    selections: SelectionSetNode
  ): FieldNode[] {
    const accumulatedSelections: FieldNode[] = [];
    for (const selection of selections.selections) {
      if (selection.kind === Kind.FIELD) {
        accumulatedSelections.push(selection);
      } else {
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
        const typeCondition = fragmentImplementation.typeCondition?.name.value;
        let fragmentApplies = !typeCondition;
        if (typeCondition) {
          const conditionType = schema.getType(typeCondition);
          fragmentApplies =
            conditionType?.name === parentType.name ||
            (isAbstractType(conditionType) &&
              schema.isSubType(conditionType, parentType));
        }
        if (fragmentApplies) {
          accumulatedSelections.push(
            ...normalizeSelections(
              parentType,
              fragmentImplementation.selectionSet
            )
          );
        }
      }
    }
    const mergedSelections: Record<string, FieldNode> = {};
    for (const selection of accumulatedSelections) {
      const alias = selection.alias?.value || selection.name.value;
      if (!mergedSelections[alias]) {
        mergedSelections[alias] = selection;
        continue;
      }
      assert(selection.name.value === mergedSelections[alias].name.value);
      assert(equal(selection.arguments, mergedSelections[alias].arguments));
      assert(equal(selection.directives, mergedSelections[alias].directives));
      if (!selection.selectionSet && !mergedSelections[alias].selectionSet) {
        continue;
      }
      if (selection.selectionSet && mergedSelections[alias].selectionSet) {
        mergedSelections[alias].selectionSet.selections = [
          ...mergedSelections[alias].selectionSet.selections,
          ...selection.selectionSet.selections,
        ];
        continue;
      }
      throw new Error(
        `Incorrect selection for field ${selection.name.value} cannot be a mix of field and sub-selections`
      );
    }

    return Object.values(mergedSelections);
  }
}
