export { GraphQLStandardSchemaGenerator } from "./GraphQLStandardSchemaGenerator.ts";
export { composeStandardSchemas } from "./utils/composeStandardSchemas.ts";
export { toJSONSchema } from "./utils/toJsonSchema.ts";
export { addTypename } from "./transforms/addTypename.ts";
export type { CombinedSpec } from "./types.ts";

import type { GraphQLStandardSchemaGenerator } from "./GraphQLStandardSchemaGenerator.ts";
declare module "graphql" {
  interface GraphQLScalarTypeExtensions {
    "@apollo/graphql-standard-schema"?: GraphQLStandardSchemaGenerator.ScalarExtension;
  }
}
