/**
 * Shared primitives and value objects used across the public extension contracts.
 */

export const LOCALES = [
  'en',
  'zh-Hans',
  'zh-Hant',
  'ja',
  'ko',
  'de',
  'fr',
  'es',
  'pt',
  'it',
  'ru',
  'vi',
  'th',
  'id',
  'pl',
  'tr',
  'ar',
  'uk'
] as const

export type Locale = (typeof LOCALES)[number]

export const APP_LOCALES = ['zh-Hans', 'en', 'ja'] as const

export type AppLocale = (typeof APP_LOCALES)[number]

export type SerializablePrimitive = string | number | boolean | null

export type SerializableValue =
  | SerializablePrimitive
  | readonly SerializableValue[]
  | { readonly [key: string]: SerializableValue }

export interface SerializableRecord {
  readonly [key: string]: SerializableValue
}

export type MaybePromise<T> = T | Promise<T>

export interface Disposable {
  dispose(): MaybePromise<void>
}

export interface DisposableStore extends Disposable {
  readonly size: number
  add<T extends Disposable>(disposable: T): T
  delete(disposable: Disposable): boolean
  clear(): MaybePromise<void>
}

export interface ValidationIssue {
  path: string
  message: string
}

export interface ExternalId {
  source: string
  id: string
}

export interface RelatedSite {
  label: string
  url: string
}

export interface PartialDate {
  year?: number
  month?: number
  day?: number
}
