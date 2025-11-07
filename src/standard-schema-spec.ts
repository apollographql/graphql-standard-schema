import { type StandardSchemaV1 as StandardTypedV1 } from "@standard-schema/spec";

export const standardJSONSchemaRootKey = "~experimental_standard" as const;

/** The Standard JSON Schema interface. */
export interface StandardJSONSchemaV1<Input = unknown, Output = Input> {
  readonly [standardJSONSchemaRootKey]: StandardJSONSchemaV1.Props<
    Input,
    Output
  >;
}

export declare namespace StandardJSONSchemaV1 {
  /** The Standard JSON Schema properties interface. */
  export interface Props<Input = unknown, Output = Input>
    extends Pick<StandardTypedV1.Props<Input, Output>, "types"> {
    /** Methods for generating the input/output JSON Schema. */
    readonly jsonSchema: Converter;
  }

  /** The Standard JSON Schema converter interface. */
  export interface Converter {
    /** Converts the input type to JSON Schema. May throw if conversion is not supported. */
    readonly input: (
      params: StandardJSONSchemaV1.Options
    ) => Record<string, unknown>;
    /** Converts the output type to JSON Schema. May throw if conversion is not supported. */
    readonly output: (
      params: StandardJSONSchemaV1.Options
    ) => Record<string, unknown>;
  }

  /** The target version of the generated JSON Schema.
   *
   * It is *strongly recommended* that implementers support `"draft-2020-12"` and `"draft-07"`, as they are both in wide use.
   *
   * All other targets can be implemented on a best-effort basis. Libraries should throw if they don't support a specified target.
   */
  export type Target =
    | "draft-2020-12"
    | "draft-07"
    | "openapi-3.0"
    // Accepts any string for future targets while preserving autocomplete
    | ({} & string);

  /** The options for the input/output methods. */
  export interface Options {
    /** Specifies the target version of the generated JSON Schema. Support for all versions is on a best-effort basis. If a given version is not supported, the library should throw. */
    readonly target: Target;

    /** Implicit support for additional vendor-specific parameters, if needed. */
    readonly libraryOptions?: Record<string, unknown> | undefined;
  }

  /** The Standard types interface. */
  export interface Types<Input = unknown, Output = Input>
    extends StandardTypedV1.Types<Input, Output> {}

  /** Infers the input type of a Standard. */
  export type InferInput<Schema extends StandardTypedV1> =
    StandardTypedV1.InferInput<Schema>;

  /** Infers the output type of a Standard. */
  export type InferOutput<Schema extends StandardTypedV1> =
    StandardTypedV1.InferOutput<Schema>;
}
