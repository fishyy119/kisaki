/**
 * Shared identity primitives for cross-layer entity matching.
 *
 * Identity is intentionally split into three concerns:
 * - external ID normalization: persistent entity identity primitive
 * - alias keys: local matching keys used by scraper / ingest graph merges
 * - canonical identity key: single stable key for normalized graph nodes
 */

export interface ExternalId {
  source: string
  id: string
}

export interface EntityIdentityInput {
  name: string
  originalName?: string
  externalIds?: ExternalId[] | null
}

export interface BuildEntityFallbackIdentityKeyOptions {
  includeCompactFallbackKeys?: boolean
}

export interface BuildEntityAliasKeyOptions extends BuildEntityFallbackIdentityKeyOptions {
  type?: string
}

/**
 * Normalize text used in identity keys.
 *
 * Rule: NFKC + trim + collapse spaces + lowercase.
 */
export function normalizeKeyText(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * Normalize an external ID into its canonical comparison form.
 */
export function normalizeExternalId(externalId: ExternalId): ExternalId {
  return {
    source: normalizeKeyText(externalId.source),
    id: normalizeKeyText(externalId.id)
  }
}

/**
 * Normalize and deduplicate external IDs while preserving first-appearance order.
 */
export function normalizeExternalIds(
  externalIds: readonly ExternalId[] | null | undefined
): ExternalId[] {
  const byKey = new Map<string, ExternalId>()

  for (const externalId of externalIds ?? []) {
    const normalized = normalizeExternalId(externalId)
    if (!normalized.source || !normalized.id) continue

    const key = `${normalized.source}:${normalized.id}`
    if (!byKey.has(key)) {
      byKey.set(key, normalized)
    }
  }

  return [...byKey.values()]
}

/**
 * Build normalized key for an external ID.
 */
export function toExternalIdKey(externalId: ExternalId): string {
  const normalized = normalizeExternalId(externalId)
  return `${normalized.source}:${normalized.id}`
}

function compactNormalizedKeyText(value: string): string {
  return value.replace(/\s+/g, '')
}

/**
 * Build all normalized external-ID identity keys for an entity.
 */
export function buildEntityExternalIdKeys(entity: EntityIdentityInput): string[] {
  return normalizeExternalIds(entity.externalIds)
    .map((externalId) => `ext:${externalId.source}:${externalId.id}`)
    .sort()
}

/**
 * Build fallback identity keys for name-based matching.
 */
export function buildEntityFallbackIdentityKeys(
  entity: EntityIdentityInput,
  options: BuildEntityFallbackIdentityKeyOptions = {}
): string[] {
  const keys: string[] = []

  const originalName = entity.originalName ? normalizeKeyText(entity.originalName) : ''
  if (originalName) {
    keys.push(`on:${originalName}`)
    if (options.includeCompactFallbackKeys) {
      keys.push(`onc:${compactNormalizedKeyText(originalName)}`)
    }
  }

  const name = normalizeKeyText(entity.name)
  if (name) {
    keys.push(`nm:${name}`)
    if (options.includeCompactFallbackKeys) {
      keys.push(`nmc:${compactNormalizedKeyText(name)}`)
    }
  }

  return [...new Set(keys)]
}

/**
 * Build all alias keys used for local matching.
 *
 * Alias keys are intentionally broader than canonical identity:
 * scraper merges may opt into compact name variants and type scoping.
 */
export function buildEntityAliasKeys(
  entity: EntityIdentityInput,
  options: BuildEntityAliasKeyOptions = {}
): string[] {
  const keys = [
    ...buildEntityExternalIdKeys(entity),
    ...buildEntityFallbackIdentityKeys(entity, options)
  ]
  const uniqueKeys = [...new Set(keys)]

  const normalizedType = options.type ? normalizeKeyText(options.type) : ''
  if (!normalizedType) {
    return uniqueKeys
  }

  return uniqueKeys.map((key) => `${key}|tp:${normalizedType}`)
}

/**
 * Build canonical identity key with priority: externalIds > originalName > name.
 *
 * When external IDs exist, each external ID is an independent match key.
 * The canonical identity key uses the first sorted external-ID key.
 */
export function buildEntityCanonicalIdentityKey(entity: EntityIdentityInput): string {
  const externalIdKeys = buildEntityExternalIdKeys(entity)
  if (externalIdKeys.length > 0) {
    return externalIdKeys[0]!
  }

  const fallbackKeys = buildEntityFallbackIdentityKeys(entity)
  if (fallbackKeys.length > 0) {
    return fallbackKeys[0]!
  }

  return `nm:${normalizeKeyText(entity.name)}`
}
