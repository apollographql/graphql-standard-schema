// oxlint-disable no-wrapper-object-types
import type { GraphQLScalarType } from "graphql";
import type { GraphQLStandardSchemaGenerator } from "../src/GraphQLStandardSchemaGenerator.ts";
import { expectTypeOf } from "expect-type";
import test from "node:test";

test("GraphQLStandardSchemaGenerator.Serialized", () => {
  type Serialized = GraphQLStandardSchemaGenerator.Serialized<
    {
      foo: Date;
      now: BigInt;
      bar: {
        hoi: string;
        baz: BigInt;
        hai: number;
      };
    },
    {
      Date: GraphQLScalarType<Date, string>;
      BigInt: GraphQLScalarType<BigInt, number>;
      // adding this to ensure it won't change all `number` to `string` excessively, but is just ignored
      NumberString: GraphQLScalarType<number, string>;
    }
  >;
  // oxlint-disable-next-line no-unused-expressions
  expectTypeOf<Serialized>().toEqualTypeOf<{
    foo: string;
    now: number;
    bar: {
      hoi: string;
      baz: number;
      hai: number;
    };
  }>;
});
