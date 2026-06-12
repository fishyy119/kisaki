import type { BangumiExtensionError } from './errors'

export type BangumiResult<T> = { ok: true; value: T } | { ok: false; error: BangumiExtensionError }
