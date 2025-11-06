export function assert(condition: any, message?: string): asserts condition;
export function assert<T>(value: unknown, message?: string): asserts value is T;
export function assert(condition: any, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}
