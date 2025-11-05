import {
  GraphQLSchema,
  type DocumentNode,
  type FragmentDefinitionNode,
  isObjectType,
  isAbstractType,
} from "graphql";
import { buildOutputSchema } from "./buildOutputSchema.ts";
import type { GraphQLStandardSchemaGenerator } from "../GraphQLStandardSchemaGenerator.ts";
import type { OpenAiSupportedJsonSchema } from "../utils/openAiSupportedJsonSchema.ts";

export function buildFragmentSchema(
  schema: GraphQLSchema,
  document: DocumentNode,
  fragment: FragmentDefinitionNode,
  scalarTypes: GraphQLStandardSchemaGenerator.Internal.ScalarMapping,
  options: GraphQLStandardSchemaGenerator.JSONSchemaOptions
): OpenAiSupportedJsonSchema {
  const parentType = schema.getType(fragment.typeCondition.name.value);
  let dataSchema: OpenAiSupportedJsonSchema;
  if (isObjectType(parentType)) {
    dataSchema = buildOutputSchema(
      schema,
      document,
      scalarTypes,
      parentType,
      fragment.selectionSet,
      options
    );
  } else if (isAbstractType(parentType)) {
    // this is not directly allowed with OpenAI Structured Output, but other tools might benefit from it - and for OpenAI, `composeStandardSchemas` can be used to nest this schema under a property, which would then be supported
    // https://platform.openai.com/docs/guides/structured-outputs?type-restrictions=number-restrictions#root-objects-must-not-be-anyof-and-must-be-an-object
    const possibleTypes = schema.getPossibleTypes(parentType);
    const schemas = possibleTypes.map((type) =>
      buildOutputSchema(
        schema,
        document,
        scalarTypes,
        type,
        fragment.selectionSet,
        options
      )
    );
    dataSchema = {
      anyOf: schemas.map(({ $defs, ...schema }) => schema),
      $defs: schemas.reduce<NonNullable<OpenAiSupportedJsonSchema["$defs"]>>(
        (acc, schema) =>
          schema.$defs ? Object.assign(acc, schema.$defs) : acc,
        {}
      ),
    };
  } else {
    throw new Error(
      `Fragment type condition must be an object, union or interface, got: ${parentType?.name}`
    );
  }

  return {
    ...dataSchema,
    title: `fragment ${fragment.name?.value || "Anonymous"} on ${fragment.typeCondition.name.value}`,
    ...(fragment.description
      ? { description: fragment.description?.value }
      : {}),
  };
}
