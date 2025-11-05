import type { GraphQLScalarType } from "graphql";
import type { OpenAiSupportedJsonSchema } from "../src/utils/openAiSupportedJsonSchema.ts";
import type { GraphQLStandardSchemaGenerator } from "../src/GraphQLStandardSchemaGenerator.ts";
import { expectTypeOf } from "expect-type";

if (false) {
  expectTypeOf<
    GraphQLStandardSchemaGenerator.Serialized<
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
        Date: {
          type: GraphQLScalarType<Date, string>;
          jsonSchema: {
            deserialized: OpenAiSupportedJsonSchema.Anything;
            serialized: OpenAiSupportedJsonSchema.Anything;
          };
        };
        BigInt: {
          type: GraphQLScalarType<BigInt, number>;
          jsonSchema: {
            deserialized: OpenAiSupportedJsonSchema.Anything;
            serialized: OpenAiSupportedJsonSchema.Anything;
          };
        };
      }
    >
  >().toEqualTypeOf<{
    foo: string;
    now: number;
    bar: {
      hoi: string;
      baz: number;
      hai: number;
    };
  }>;
}
