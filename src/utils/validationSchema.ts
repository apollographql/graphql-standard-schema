import { GraphQLStandardSchemaGenerator } from "../GraphQLStandardSchemaGenerator.ts";
import { standardSchema } from "./standardSchema.ts";
import type { StandardSchemaV1 } from "../standard-schema-spec.ts";

export function validationSchema<Input, Output = Input>(
  validate: (value: unknown) => StandardSchemaV1.Result<Output>,
  inputSchema: GraphQLStandardSchemaGenerator.JSONSchemaCreator,
  outputSchema: GraphQLStandardSchemaGenerator.JSONSchemaCreator
): GraphQLStandardSchemaGenerator.ValidationSchema<Input, Output> {
  const wrapper = {
    [validate.name](arg: unknown) {
      return validate(arg);
    },
  }[validate.name]!;
  return Object.assign(
    wrapper,
    standardSchema<Input, Output>(wrapper, inputSchema, outputSchema)
  );
}
