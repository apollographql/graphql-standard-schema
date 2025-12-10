import type { GraphQLScalarType } from "graphql";
import type { GraphQLStandardSchemaGenerator } from "../GraphQLStandardSchemaGenerator.ts";
import { assert } from "../utils/assert.ts";
import type { OpenAiSupportedJsonSchema } from "../utils/openAiSupportedJsonSchema.ts";

export function getScalarJsonSchema(
  parentType: GraphQLScalarType,
  scalarTypes: GraphQLStandardSchemaGenerator.ScalarDefinitions,
  direction: "serialized" | "deserialized"
) {
  const scalarType:
    | (GraphQLScalarType<any, any> & {
        extensions: GraphQLScalarType<any, any>["extensions"] & {
          /** Might be defined by `graphql-scalars` so we allow that as a fallback from `extensions["@apollo/graphql-standard-schema"]` */
          jsonSchema?: OpenAiSupportedJsonSchema.Anything;
        };
      })
    | undefined = scalarTypes?.[parentType.name];
  assert(
    scalarType,
    `Scalar type ${parentType.name} not found in \`scalarTypes\`, but \`scalarTypes\` option was provided.`
  );

  const possibleDescription = scalarType.description || parentType.description;

  const extensionSchema =
    scalarType.extensions?.["@apollo/graphql-standard-schema"]?.[
      direction === "serialized"
        ? "serializedJsonSchema"
        : "deserializedJsonSchema"
    ] ??
    (direction === "serialized"
      ? scalarType.extensions?.jsonSchema
      : undefined);

  assert(
    extensionSchema,
    `Scalar type ${parentType.name} is missing the ${direction === "serialized" ? "serializedJsonSchema" : "deserializedJsonSchema"} in its @apollo/graphql-standard-schema extension.`
  );

  return {
    title: parentType.name,
    ...(possibleDescription ? { description: possibleDescription } : {}),
    ...extensionSchema,
  };
}
