import {
  isNonNullType,
  isListType,
  type GraphQLSchema,
  type VariableDefinitionNode,
  isSpecifiedScalarType,
  Kind,
  isScalarType,
  isInputObjectType,
  type GraphQLInputType,
  GraphQLNonNull,
  isEnumType,
} from "graphql";
import { assert } from "./assert.ts";
import type { GraphQLStandardSchemaGenerator } from "../GraphQLStandardSchemaGenerator.ts";

export function fakeVariables(
  definitions: ReadonlyArray<VariableDefinitionNode>,
  schema: GraphQLSchema,
  scalars: GraphQLStandardSchemaGenerator.ScalarDefinitions
) {
  return Object.fromEntries(
    definitions.map((def) => {
      const name = def.variable.name.value;
      if (def.defaultValue) {
        return [name, def.defaultValue];
      }
      let type = def.type;
      if (type.kind !== Kind.NON_NULL_TYPE) {
        return [name, null];
      }
      type = type.type;
      if (type.kind === Kind.LIST_TYPE) {
        return [name, []];
      }
      const schemaType = schema.getType(type.name.value);
      assert(schemaType, `Type ${type.name.value} not found in schema`);
      return [
        name,
        fakeInputValue(new GraphQLNonNull(schemaType) as GraphQLInputType),
      ];
    })
  );

  function fakeInputValue(schemaType: GraphQLInputType): unknown {
    if (!isNonNullType(schemaType)) {
      return null;
    }
    schemaType = schemaType.ofType;
    if (isListType(schemaType)) {
      return [];
    }
    if (isEnumType(schemaType)) {
      return schemaType.getValues()[0]!.value;
    }
    if (isSpecifiedScalarType(schemaType)) {
      switch (schemaType.name) {
        case "String":
          return "";
        case "Int":
          return 0;
        case "Float":
          return 0.0;
        case "Boolean":
          return false;
        case "ID":
          return "0";
      }
    }
    if (isScalarType(schemaType)) {
      const scalarDefinition = scalars[schemaType.name];
      assert(
        scalarDefinition?.defaultValue,
        `Scalar type ${schemaType.name} is used as input type and referenced as non-nullable variable, but no defaultValue is provided in scalar definitions`
      );
      return scalarDefinition.defaultValue;
    }
    if (isInputObjectType(schemaType)) {
      const fields = schemaType.getFields();
      return Object.fromEntries(
        Object.values(fields).map((field) => [
          field.name,
          fakeInputValue(field.type),
        ])
      );
    }
    assert(
      false,
      `Cannot fake variable value for type ${(schemaType as any).toString()}`
    );
  }
}
