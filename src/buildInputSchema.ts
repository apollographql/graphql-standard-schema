import {
  GraphQLNonNull,
  isNonNullType,
  type DocumentNode,
  type GraphQLInputType,
  type GraphQLSchema,
  isDefinitionNode,
  Kind,
  isListType,
  isSpecifiedScalarType,
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  isScalarType,
  getNamedType,
  isEnumType,
  GraphQLInputObjectType,
} from "graphql";
import type { OpenAiSupportedJsonSchema } from "./openAiSupportedJsonSchema.ts";
import { assert } from "./assert.ts";

export function buildInputSchema(
  schema: GraphQLSchema,
  document: DocumentNode,
  scalarTypes: Record<string, OpenAiSupportedJsonSchema.Anything> | undefined
): OpenAiSupportedJsonSchema {
  const variableDefs =
    document.definitions.find(
      (def) => def.kind === Kind.OPERATION_DEFINITION && isDefinitionNode(def)
    )?.variableDefinitions || [];

  const defs: {
    enum?: OpenAiSupportedJsonSchema.Definitions;
    input?: Record<string, OpenAiSupportedJsonSchema.ObjectDef>;
    scalar?: OpenAiSupportedJsonSchema.Definitions;
  } = {};
  const properties = Object.fromEntries(
    variableDefs.map((varDef) => {
      const name = varDef.variable.name.value;
      return [name, handleTypeNode(varDef.type, true)];
      function handleTypeNode(
        typeNode: typeof varDef.type,
        nullable: boolean
      ): OpenAiSupportedJsonSchema.Anything {
        switch (typeNode.kind) {
          case Kind.NAMED_TYPE:
            const type = schema.getType(
              typeNode.name.value
            ) as GraphQLInputType;
            return handleMaybe(nullable ? type : new GraphQLNonNull(type));
          case Kind.LIST_TYPE:
            return {
              type: nullable ? ["null", "array"] : "array",
              items: handleTypeNode(typeNode.type, true),
            };
          case Kind.NON_NULL_TYPE:
            return handleTypeNode(typeNode.type, false);
        }
      }
    })
  );

  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
    $defs: defs,
  };

  function handleMaybe(
    parentType: GraphQLInputType
  ): OpenAiSupportedJsonSchema.Anything {
    if (isNonNullType(parentType)) {
      const itemType = parentType.ofType;
      if (isNonNullType(itemType)) {
        // nested non-null should be impossible, but this makes TypeScript happy and is safer on top
        return handleMaybe(itemType);
      }
      return handle(itemType, false);
    } else {
      return handle(parentType, true);
    }
  }
  function handle(
    parentType: Exclude<GraphQLInputType, GraphQLNonNull<any>>,
    nullable: boolean
  ): OpenAiSupportedJsonSchema.Anything {
    function maybe(
      schema: OpenAiSupportedJsonSchema.Anything
    ): OpenAiSupportedJsonSchema.Anything {
      if (!nullable) return schema;
      if ("type" in schema) {
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
      } else if ("$ref" in schema) {
        return {
          anyOf: [schema, { type: "null" }],
        };
      } else {
        throw new Error("unhandled maybe case in " + JSON.stringify(schema));
      }
    }

    if (isListType(parentType)) {
      return maybe({
        type: "array",
        items: handleMaybe(parentType.ofType),
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
      defs.scalar ??= {};
      defs.scalar[parentType.name] = scalarType;
      return maybe({ $ref: `#/$defs/scalar/${parentType.name}` });
    }
    if (isEnumType(parentType)) {
      const refName = `${parentType.name}`;
      const base: Array<string | null> = nullable ? [null] : [];
      const enumDefs = (defs.enum ??=
        {}) as OpenAiSupportedJsonSchema.Definitions;
      enumDefs[refName] ??= {
        title: `${parentType.name}`,
        ...(parentType.description
          ? { description: parentType.description }
          : {}),
        enum: base.concat(parentType.getValues().map((v) => v.name)),
      };

      return maybe({ $ref: `#/$defs/enum/${refName}` });
    }
    return maybe(handleInputType(parentType));
  }

  function handleInputType(parentType: GraphQLInputObjectType) {
    const fields = parentType.getFields();
    defs.input ??= {};
    const name = parentType.name;
    console.log(name);
    if (!defs.input[name]) {
      const properties: NonNullable<
        OpenAiSupportedJsonSchema.ObjectDef["properties"]
      > = {};
      defs.input[name] = {
        type: "object" as const,
        title: parentType.name,
        ...(parentType.description
          ? { description: parentType.description }
          : {}),
        properties: {},
        required: [],
        additionalProperties: false as const,
      };
      for (const fieldName of Object.keys(fields)) {
        const field = fields[fieldName]!;
        defs.input[name].properties[fieldName] = handleMaybe(field.type);
        defs.input[name].required.push(fieldName);
      }
    }
    return { $ref: `#/$defs/input/${name}` };
  }
}
