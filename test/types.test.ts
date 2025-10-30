import type { GraphQLScalarType } from "graphql";
import type { OpenAiSupportedJsonSchema } from "../src/openAiSupportedJsonSchema.ts";
import type { GraphQLStandardSchemaGenerator } from "../src/index.ts";
import {expectTypeOf} from 'expect-type'

if (false){
expectTypeOf<GraphQLStandardSchemaGenerator.InputType<
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
        input: OpenAiSupportedJsonSchema.Anything;
        output: OpenAiSupportedJsonSchema.Anything;
      };
    };
    BigInt: {
      type: GraphQLScalarType<BigInt, number>;
      jsonSchema: {
        input: OpenAiSupportedJsonSchema.Anything;
        output: OpenAiSupportedJsonSchema.Anything;
      };
    };
  }
>>().toEqualTypeOf<{
    foo: string;
    now: number;
    bar: {
        hoi: string;
        baz: number;
        hai: number;
    };
}>;
}