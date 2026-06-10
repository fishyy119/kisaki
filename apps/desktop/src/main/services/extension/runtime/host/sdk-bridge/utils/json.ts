import { toJsonObject, toJsonValue } from '@kisaki3/extension-api'

/**
 * Normalizes an optional typed record through JSON canonicalization.
 * @returns `undefined` when the input is `undefined`, otherwise the normalized record.
 */
export function toOptionalJsonRecord<TRecord extends object>(
  value: TRecord | undefined,
  label: string
): TRecord | undefined {
  return value === undefined ? undefined : toJsonRecord(value, label)
}

/**
 * Normalizes a typed record through JSON canonicalization while preserving its
 * compile-time type.
 * @remarks The cast is sound only because normalization keeps the JSON shape:
 * `undefined` properties are dropped and non-JSON values throw.
 */
export function toJsonRecord<TRecord extends object>(value: TRecord, label: string): TRecord {
  return toJsonObject(value, label) as unknown as TRecord
}

/**
 * Normalizes an optional field value through JSON canonicalization while
 * preserving its compile-time type.
 */
export function toOptionalJsonField<TValue>(value: unknown, label: string): TValue | undefined {
  return value === undefined ? undefined : (toJsonValue(value, label) as TValue)
}
