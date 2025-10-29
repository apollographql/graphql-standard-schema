export type OpenAiSupportedJsonSchema = (
  | OpenAiSupportedJsonSchema.ObjectDef
  // top level `anyOf` is not directly supported by OpenAI, but we allow it here - the resulting schema can still be nested into a property using `composeStandardSchema`
  | OpenAiSupportedJsonSchema.AnyOf
) & {
  $defs?: OpenAiSupportedJsonSchema.Definitions;
  [k: string]: unknown;
};

// see https://platform.openai.com/docs/guides/structured-outputs?type-restrictions=number-restrictions#supported-schemas
export namespace OpenAiSupportedJsonSchema {
  export type Definitions = {
    [k: string]: Partial<OpenAiSupportedJsonSchema.Anything> | Definitions;
  };

  export type Anything = IndividualTypes | Mixed;
  export type IndividualTypes =
    | StringDef
    | NumberDef
    | BooleanDef
    | IntegerDef
    | ObjectDef
    | ArrayDef
    | EnumDef
    | AnyOf
    | Null
    | Const
    | Ref;

  export type Type =
    | "string"
    | "number"
    | "boolean"
    | "object"
    | "array"
    | "integer"
    | "null";

  interface Shared {
    title?: string;
    description?: string;
    $ref?: string;
  }

  export type Mixed = { type: Type[] } & UnionToIntersection<
    IndividualTypes extends infer I
      ? { [K in keyof I as K extends "type" ? never : K]?: I[K] } & {}
      : never
  >;

  export interface StringDef extends Shared {
    type: "string";
    pattern?: string;
    format?:
      | "date-time"
      | "time"
      | "date"
      | "duration"
      | "email"
      | "hostname"
      | "ipv4"
      | "ipv6"
      | "uuid";
  }

  export interface NumberDef extends Shared {
    type: "number";
    multipleOf?: number;
    maximum?: number;
    exclusiveMaximum?: number;
    minimum?: number;
    exclusiveMinimum?: number;
  }

  export interface BooleanDef extends Shared {
    type: "boolean";
  }

  export interface IntegerDef extends Shared {
    type: "integer";
    multipleOf?: number;
    maximum?: number;
    exclusiveMaximum?: number;
    minimum?: number;
    exclusiveMinimum?: number;
  }

  export interface ObjectDef extends Shared {
    type: "object";
    properties: Record<string, Anything>;
    required: string[];
    // required to be `false` for OpenAI structured outputs
    additionalProperties?: boolean;
  }

  export interface ArrayDef extends Shared {
    type: "array";
    items: Anything;
    minItems?: number;
    maxItems?: number;
  }

  export interface EnumDef extends Shared {
    type?: ("string" | "number" | "integer" | "boolean" | "null")[];
    enum: (string | number | boolean | null)[];
  }

  export interface AnyOf extends Shared {
    anyOf: Anything[];
  }

  export interface Const extends Shared {
    const: string | number | boolean | null;
  }

  export interface Null extends Shared {
    type: "null";
  }

  export interface Ref extends Shared {
    $ref: string;
  }
}
type UnionToIntersection<T> = (T extends any ? (x: T) => any : never) extends (
  x: infer R
) => any
  ? R
  : never;
