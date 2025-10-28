import type { OpenAiSupportedJsonSchema } from "./openAiSupportedJsonSchema.ts";
import type {
  StandardSchemaV1,
  StandardJSONSchemaV1,
} from "./standard-schema-spec.ts";

export interface CombinedProps<Input = unknown, Output = Input>
  extends StandardSchemaV1.Props<Input, Output>,
    StandardJSONSchemaV1.Props<Input, Output> {}
/**
 * An interface that combines StandardJSONSchema and StandardSchema.
 * */

export interface CombinedSpec<Input = unknown, Output = Input> {
  "~standard": CombinedProps<Input, Output>;
}
