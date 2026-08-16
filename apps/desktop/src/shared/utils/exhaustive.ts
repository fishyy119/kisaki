/**
 * Exhaustiveness helpers for discriminated unions.
 */

/**
 * Assert that a union has been fully handled.
 *
 * Call this where every union member is expected to have been consumed: the
 * `never` parameter makes an unhandled member a compile error, and the throw
 * covers the value arriving from outside the type system anyway.
 */
export function assertNever(value: never, subject: string): never {
  throw new Error(`Unhandled ${subject}: ${String(value)}`)
}
