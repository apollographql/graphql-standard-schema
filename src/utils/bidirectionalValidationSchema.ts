import type { GraphQLStandardSchemaGenerator } from "../GraphQLStandardSchemaGenerator.ts";
import type { StandardSchemaV1 } from "../standard-schema-spec.ts";
import { validationSchema } from "./validationSchema.ts";

export function bidirectionalValidationSchema<
  Deserialized,
  Scalars extends GraphQLStandardSchemaGenerator.ScalarDefinitions = Record<
    string,
    never
  >,
>({
  normalize,
  deserialize,
  serialize,
  buildSchema,
}: {
  normalize: (
    value: unknown
  ) => StandardSchemaV1.Result<
    GraphQLStandardSchemaGenerator.Serialized<Deserialized, Scalars>
  >;
  deserialize: (value: unknown) => StandardSchemaV1.Result<Deserialized>;
  serialize: (
    value: unknown
  ) => StandardSchemaV1.Result<
    GraphQLStandardSchemaGenerator.Serialized<Deserialized, Scalars>
  >;
  buildSchema: (
    direction: "serialized" | "deserialized"
  ) => GraphQLStandardSchemaGenerator.JSONSchemaCreator;
}): GraphQLStandardSchemaGenerator.BidirectionalValidationSchema<
  Deserialized,
  Scalars
> {
  type Serialized = GraphQLStandardSchemaGenerator.Serialized<
    Deserialized,
    Scalars
  >;
  const base = validationSchema<Serialized, Serialized>(
    normalize,
    buildSchema("serialized"),
    buildSchema("serialized")
  );

  return Object.assign(base, {
    normalize: base,
    deserialize: validationSchema<Serialized, Deserialized>(
      deserialize,
      buildSchema("serialized"),
      buildSchema("deserialized")
    ),
    serialize: validationSchema<Deserialized, Serialized>(
      serialize,
      buildSchema("deserialized"),
      buildSchema("serialized")
    ),
  });
}
