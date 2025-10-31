import type { CombinedSpec } from "./types.ts";
import type {
  StandardJSONSchemaV1,
  StandardSchemaV1,
} from "./standard-schema-spec.ts";
import { assert } from "./assert.ts";

type InsertAt<Root, P extends string[], V> = P extends [
  infer Head extends string,
  ...infer Tail extends string[],
]
  ? {
      [K in keyof Root | Head]: K extends Head
        ? InsertAt<K extends keyof Root ? Root[K] : {}, Tail, V>
        : Root[K & keyof Root];
    }
  : V;

type JsonSchemaFn = (
  params?: StandardJSONSchemaV1.Options
) => Record<string, unknown>;

export function composeStandardSchemas<
  Root extends CombinedSpec<any, any>,
  P extends string[],
  Extension extends CombinedSpec<any, any>,
>(
  rootSchema: Root,
  path: P,
  extension: Extension
): CombinedSpec<
  InsertAt<
    StandardSchemaV1.InferInput<Root>,
    P,
    StandardSchemaV1.InferInput<Extension>
  >,
  InsertAt<
    StandardSchemaV1.InferOutput<Root>,
    P,
    StandardSchemaV1.InferOutput<Extension>
  >
> {
  type CombinedResult = InsertAt<
    StandardSchemaV1.InferOutput<Root>,
    P,
    StandardSchemaV1.InferOutput<Extension>
  >;
  const jsonSchema: JsonSchemaFn = (params) => {
    const rootJson: Record<string, unknown> & { $defs?: {} } =
      rootSchema["~standard"].jsonSchema.input(params);
    const {
      $defs,
      ...extensionJson
    }: Record<string, unknown> & { $defs?: {} } =
      extension["~standard"].jsonSchema.input(params);
    let step: {
      type?: string;
      properties?: Record<string, Record<string, unknown>>;
      required?: string[];
      $defs?: Record<string, unknown>;
    } = rootJson;
    for (let i = 0; i < path.length; i++) {
      const key = path[i]!;
      assert(step.type === "object");
      if (!step.properties) {
        step.properties = {};
      }
      if (!step.properties[key]) {
        step.properties[key] = {
          type: "object",
          properties: {},
          required: [],
          additionalProperties: false,
        };
        step.required = [...(step.required || []), key];
      }
      if (i === path.length - 1) {
        step.properties[key] = extensionJson;
      }
    }
    if ($defs) {
      // note that this might override existing definitions in rootJson.$defs
      // this is okay while using this internally, but once exposed to users, we might
      // need to handle conflicts more gracefully
      rootJson.$defs = { ...rootJson.$defs, ...$defs };
    }
    return rootJson;
  };
  return {
    "~standard": {
      vendor: `${rootSchema["~standard"].vendor}`,
      version: rootSchema["~standard"].version,
      validate(value) {
        if (typeof value !== "object" || value === null) {
          return rootSchema["~standard"].validate(
            value
          ) as StandardSchemaV1.Result<CombinedResult>;
        }
        function handler(path: string[]): ProxyHandler<any> {
          return {
            ownKeys(target) {
              if (path.length === 1) {
                return Reflect.ownKeys(target).filter((key) => key !== path[0]);
              }
              return Reflect.ownKeys(target);
            },
            has(target, p) {
              return path[0] === p && path.length === 1
                ? false
                : Reflect.has(target, p);
            },
            get(target, prop, receiver) {
              if (prop !== path[0]) {
                return Reflect.get(target, prop, receiver);
              }
              if (path.length === 1) {
                return undefined;
              }
              return new Proxy(
                Reflect.get(target, prop, receiver),
                handler(path.slice(1))
              );
            },
          };
        }
        const rootResult = rootSchema["~standard"].validate(
          new Proxy(value, handler(path))
        );
        const extensionValue = path.reduce(
          (obj: Record<string, any>, key) => obj[key],
          value
        );
        const extensionResult = extension["~standard"].validate(extensionValue);
        function combineResults(
          result1: StandardSchemaV1.Result<Root>,
          result2: StandardSchemaV1.Result<Extension>
        ): StandardSchemaV1.Result<CombinedResult> {
          if (result1.issues || result2.issues) {
            return {
              issues: [...(result1.issues || []), ...(result2.issues || [])],
            };
          }
          return { value: value as CombinedResult };
        }
        if ("then" in rootResult || "then" in extensionResult) {
          return Promise.all([rootResult, extensionResult]).then(([r1, r2]) =>
            combineResults(r1, r2)
          );
        }
        return combineResults(rootResult, extensionResult);
      },
      jsonSchema: {
        input: jsonSchema,
        output: jsonSchema,
      },
    },
  };
}

export function nullable<Input, Output>(
  schema: CombinedSpec<Input, Output>
): CombinedSpec<Input | null, Output | null> {
  return {
    "~standard": {
      vendor: schema["~standard"].vendor,
      version: schema["~standard"].version,
      validate(value) {
        if (value === null) {
          return { value: null };
        }
        return schema["~standard"].validate(
          value
        ) as StandardSchemaV1.Result<Output | null>;
      },
      jsonSchema: {
        input(params) {
          const { $defs, ...orig } =
            schema["~standard"].jsonSchema.input(params);
          return {
            anyOf: [{ type: "null" }, orig],
            $defs,
          };
        },
        output(params) {
          const { $defs, ...orig } =
            schema["~standard"].jsonSchema.input(params);
          return {
            anyOf: [{ type: "null" }, orig],
            $defs,
          };
        },
      },
    },
  };
}
