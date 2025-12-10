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
  [K in keyof Scalars]: Scalars[K] extends GraphQLScalarType<
    infer Parsed,
    infer Serialized
  >
    ? IsPrimitive<Parsed> extends true
      ? never
      : [Parsed, Serialized]
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

type IsPrimitive<T> = [string] extends [T]
  ? true
  : [number] extends [T]
    ? true
    : [boolean] extends [T]
      ? true
      : // in case `strictNullChecks` is disabled, the next checks would be `true` all the time, force return false
        null extends 1
        ? false
        : [null] extends [T]
          ? true
          : [undefined] extends [T]
            ? true
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
