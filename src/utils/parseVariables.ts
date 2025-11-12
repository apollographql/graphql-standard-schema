import {
  GraphQLInputObjectType,
  isEnumType,
  isListType,
  isNonNullType,
  isScalarType,
  Kind,
  type GraphQLInputType,
  type GraphQLSchema,
  type OperationDefinitionNode,
  type TypeNode,
  type VariableDefinitionNode,
} from "graphql";
import type { GraphQLStandardSchemaGenerator } from "../GraphQLStandardSchemaGenerator.ts";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { getScalarParser, type SchemaResult } from "./parseData.ts";
import { assert } from "./assert.ts";

export function parseVariables<
  TVariables extends Record<string, unknown>,
  Scalars extends GraphQLStandardSchemaGenerator.ScalarDefinitions,
  Mode extends "normalize" | "deserialize" | "serialize",
>(
  data: unknown,
  operation: OperationDefinitionNode,
  schema: GraphQLSchema,
  scalars: Scalars,
  mode: Mode
): StandardSchemaV1.Result<SchemaResult<TVariables, Scalars, Mode>> {
  if (typeof data !== "object" || data === null) {
    return {
      issues: [
        {
          message: `Expected variables to be an object, got ${typeof data}`,
        },
      ],
    };
  }

  const parser = getScalarParser(mode, scalars);

  const variableDefs: ReadonlyArray<VariableDefinitionNode> =
    operation.variableDefinitions || [];

  const issues: StandardSchemaV1.Issue[] = [];
  const value: Record<string, unknown> = Object.fromEntries(
    variableDefs.map((varDef) => {
      const name = varDef.variable.name.value;
      return [
        name,
        handleTypeNode(
          varDef.type,
          (data as Record<string, unknown>)[name],
          name,
          [name]
        ),
      ];
    })
  );
  if (issues.length > 0) {
    return { issues };
  }
  return { value } as { value: any };

  function handleTypeNode(
    typeNode: TypeNode,
    variableValue: unknown,
    variableName: string,
    path: Array<string | number>
  ): unknown {
    try {
      switch (typeNode.kind) {
        case Kind.NAMED_TYPE:
          if (variableValue == null) {
            return variableValue;
          }
          const type = schema.getType(typeNode.name.value) as GraphQLInputType;
          if (isScalarType(type) || isEnumType(type)) {
            return parser(variableValue, type);
          }
          assert(!isListType(type), `Expected ${type} to not be a list type.`);
          assert(!isNonNullType(type), `Expected ${type} to not be non-null.`);
          return parseInputObject({
            data: variableValue,
            type,
            path,
            parser,
            issues,
          });
        case Kind.LIST_TYPE:
          if (variableValue == null) {
            return variableValue;
          }
          assert(
            Array.isArray(variableValue),
            `Expected value to be an array.`
          );
          return variableValue.map((item, idx) =>
            handleTypeNode(typeNode.type, item, variableName, [...path, idx])
          );
        case Kind.NON_NULL_TYPE:
          assert(variableValue != null, `Expected value to be non-null.`);
          return handleTypeNode(
            typeNode.type,
            variableValue,
            variableName,
            path
          );
      }
    } catch (e) {
      issues.push({
        message: (e as Error).message,
        path,
      });
      return undefined;
    }
  }
}

function parseInputObject({
  data,
  type,
  path,
  parser,
  issues,
}: {
  data: unknown;
  type: GraphQLInputObjectType;
  path: Array<string | number>;
  parser: ReturnType<typeof getScalarParser>;
  issues: StandardSchemaV1.Issue[];
}): unknown {
  return handleData(data, type, path);

  function handleData(
    fieldValue: unknown,
    fieldType: GraphQLInputType,
    path: Array<string | number>
  ): unknown {
    try {
      if (isNonNullType(fieldType)) {
        assert(fieldValue != null, `Expected value to be non-null.`);
        fieldType = fieldType.ofType;
      }
      if (fieldValue == null) {
        return fieldValue;
      }
      if (isListType(fieldType)) {
        const listType = fieldType.ofType;
        assert(Array.isArray(fieldValue), `Expected value to be an array.`);
        return fieldValue.map((item, idx) => {
          return handleData(item, listType, [...path, idx]);
        });
      }
      if (isScalarType(fieldType) || isEnumType(fieldType)) {
        return parser(fieldValue, fieldType);
      }

      if (!(typeof fieldValue === "object" && !Array.isArray(fieldValue))) {
        console.log({ fieldValue, fieldType, path });
      }
      assert(
        typeof fieldValue === "object" && !Array.isArray(fieldValue),
        `Expected input object to be an object.`
      );
      const result: Record<string, unknown> = {};
      const fields = type.getFields();
      for (const [fieldName, field] of Object.entries(fields)) {
        const value = handleData(
          (fieldValue as Record<string, unknown>)[fieldName],
          field.type,
          [...path, fieldName]
        );
        if (value !== undefined) {
          result[fieldName] = value;
        }
        continue;
      }
      return result;
    } catch (e) {
      issues.push({
        message: (e as Error).message,
        path,
      });
    }
  }
}
