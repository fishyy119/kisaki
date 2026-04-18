export type SerializablePrimitive = string | number | boolean | null

export type SerializableValue =
  | SerializablePrimitive
  | readonly SerializableValue[]
  | { readonly [key: string]: SerializableValue }

export interface SerializableRecord {
  readonly [key: string]: SerializableValue
}
