import { GraphQLScalarType } from "graphql";

export const DateScalarDef = {
  type: new GraphQLScalarType<Date, string>({
    parseValue(value) {
      const date = new Date(value as string);
      if (isNaN(date.getTime())) {
        throw new TypeError(
          `Value is not a valid Date string: ${value as string}`
        );
      }
      return date;
    },
    serialize(value) {
      if (!(value instanceof Date) || isNaN(value.getTime())) {
        throw new TypeError(`Value is not a valid Date object: ${value}`);
      }
      return value.toISOString().split("T")[0];
    },
    name: "Date",
    description: "A date string in YYYY-MM-DD format",
  }),
  jsonSchema: {
    serialized: { type: "string", pattern: "\\d{4}-\\d{1,2}-\\d{1,2}" },
    deserialized: { type: "number" },
  },
} as const;
