import type { GraphQLScalarType } from "graphql";
import type { GraphQLStandardSchemaGenerator } from "./GraphQLStandardSchemaGenerator.ts";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { StandardJSONSchemaV1 } from "./standard-schema-spec.ts";

export interface CombinedProps<Input = unknown, Output = Input>
  extends StandardSchemaV1.Props<Input, Output>,
    StandardJSONSchemaV1.Props<Input, Output> {}
/**
 * An interface that combines StandardJSONSchema and StandardSchema.
 * */

export interface CombinedSpec<Input = unknown, Output = Input>
  extends StandardSchemaV1<Input, Output>,
    StandardJSONSchemaV1<Input, Output> {}

export type ScalarMapping<
  Scalars extends GraphQLStandardSchemaGenerator.ScalarDefinitions,
> = {
  [K in keyof Scalars]: Scalars[K] extends {
    type: GraphQLScalarType<infer Parsed, infer Serialized>;
  }
    ? [Parsed, Serialized]
    : never;
}[keyof Scalars];

type SerializedValue<TData, Mapping extends [any, any]> = Mapping extends [
  // infer Foo extends TData,
  TData,
  infer Serialized,
]
  ? Serialized
  : never;

type IsUnknown<T> = unknown extends T
  ? [keyof T] extends [never]
    ? true
    : false
  : false;
export type CalculateSerializedType<TData, Mapping extends [any, any]> =
  IsUnknown<TData> extends true
    ? TData
    : SerializedValue<TData, Mapping> extends infer Serialized
      ? [Serialized] extends [never]
        ? RecurseCalculateInputType<TData, Mapping>
        : Serialized
      : never;

type RecurseCalculateInputType<
  TData,
  Mapping extends [any, any],
> = TData extends number | string | boolean | null | undefined
  ? TData
  : TData extends Array<infer U>
    ? Array<CalculateSerializedType<U, Mapping>>
    : TData extends ReadonlyArray<infer U>
      ? ReadonlyArray<CalculateSerializedType<U, Mapping>>
      : TData extends object
        ? {
            [K in keyof TData]: CalculateSerializedType<TData[K], Mapping>;
          }
        : never;
