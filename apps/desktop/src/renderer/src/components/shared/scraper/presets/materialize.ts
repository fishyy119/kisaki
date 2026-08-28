/**
 * Recipe materialization.
 *
 * Turns curated recipe rankings into concrete profile fields against the live
 * provider lists: the search source is the first available candidate, slot
 * rankings drop providers that are missing or lack the slot capability, and
 * the result carries a name-independent recommendation fingerprint so profile
 * update detection can compare configurations rather than labels.
 */

import type { ContentEntityType } from '@shared/common'
import type { ContentLocale } from '@shared/i18n'
import type { ScraperSlotConfigs, SlotConfig } from '@shared/db'
import {
  createEmptySlotConfig,
  createSlotConfig,
  getScraperSlotsForMediaType,
  type ScraperCapability
} from '@shared/scraper'
import type { ScraperProviderInfo } from '../provider-display'
import {
  resolveRecipeLanguageGroup,
  type RecipeLanguageGroup,
  type ScraperRecipe,
  type ScraperRecipeVariant
} from './recipes'

export interface MaterializedRecipe {
  recipeId: string
  mediaType: ContentEntityType
  searchProviderId: string
  defaultLocale: ContentLocale
  slotConfigs: ScraperSlotConfigs
  /** Name-independent digest of the materialized configuration. */
  fingerprint: string
}

export interface RecipeAvailability {
  /** Whether any search candidate is currently available. */
  available: boolean
  /** Distinct providers the variant ranks, with their availability. */
  providers: RecipeProviderAvailability[]
}

export interface RecipeProviderAvailability {
  providerId: string
  /** Display name when installed, readable fallback otherwise. */
  label: string
  installed: boolean
}

function findProvider(
  providers: readonly ScraperProviderInfo[],
  providerId: string
): ScraperProviderInfo | undefined {
  return providers.find((provider) => provider.id === providerId)
}

function providerSupports(
  providers: readonly ScraperProviderInfo[],
  providerId: string,
  capability: ScraperCapability
): boolean {
  const provider = findProvider(providers, providerId)
  return provider !== undefined && provider.capabilities.includes(capability)
}

export function resolveRecipeVariant(
  recipe: ScraperRecipe,
  group: RecipeLanguageGroup
): ScraperRecipeVariant {
  return recipe.variants[group]
}

/** Variant group for a content locale (the confirm step may override it). */
export function resolveVariantForLocale(
  recipe: ScraperRecipe,
  locale: ContentLocale
): { group: RecipeLanguageGroup; variant: ScraperRecipeVariant } {
  const group = resolveRecipeLanguageGroup(locale)
  return { group, variant: recipe.variants[group] }
}

/**
 * Materializes one recipe variant against the live provider list.
 * Returns null when no search candidate is available, because a profile that
 * cannot resolve entries would be a dead row.
 */
export function materializeRecipe(
  recipe: ScraperRecipe,
  group: RecipeLanguageGroup,
  providers: readonly ScraperProviderInfo[]
): MaterializedRecipe | null {
  const variant = recipe.variants[group]

  const searchProviderId = variant.searchProviderIds.find((candidate) =>
    providerSupports(providers, candidate, 'search')
  )
  if (!searchProviderId) {
    return null
  }

  const slotConfigs = {} as Record<string, SlotConfig>
  for (const slot of getScraperSlotsForMediaType(recipe.mediaType)) {
    const plan = variant.slots[slot]
    const availableProviderIds = (plan?.providerIds ?? []).filter((providerId) =>
      providerSupports(providers, providerId, slot)
    )

    slotConfigs[slot] =
      availableProviderIds.length > 0
        ? createSlotConfig(slot, [...availableProviderIds], { strategy: plan?.strategy })
        : createEmptySlotConfig(slot)
  }

  const materialized: Omit<MaterializedRecipe, 'fingerprint'> = {
    recipeId: recipe.id,
    mediaType: recipe.mediaType,
    searchProviderId,
    defaultLocale: variant.defaultLocale,
    slotConfigs: slotConfigs as ScraperSlotConfigs
  }

  return { ...materialized, fingerprint: computeRecipeFingerprint(materialized) }
}

/**
 * Availability report for the recipe card: whether the scene works right now
 * and which referenced providers are missing.
 */
export function assessRecipeAvailability(
  recipe: ScraperRecipe,
  group: RecipeLanguageGroup,
  providers: readonly ScraperProviderInfo[]
): RecipeAvailability {
  const variant = recipe.variants[group]

  const referenced = new Set<string>(variant.searchProviderIds)
  for (const plan of Object.values(variant.slots)) {
    for (const providerId of plan?.providerIds ?? []) {
      referenced.add(providerId)
    }
  }

  const providerAvailability: RecipeProviderAvailability[] = [...referenced].map((providerId) => {
    const provider = findProvider(providers, providerId)
    return {
      providerId,
      label: provider?.name ?? fallbackLabel(providerId),
      installed: provider !== undefined
    }
  })

  return {
    available: variant.searchProviderIds.some((candidate) =>
      providerSupports(providers, candidate, 'search')
    ),
    providers: providerAvailability
  }
}

function fallbackLabel(providerId: string): string {
  const tail = providerId.split('/').pop() ?? providerId
  try {
    return decodeURIComponent(tail)
  } catch {
    return tail
  }
}

/**
 * Canonical fingerprint of a scrape configuration: search source, default
 * locale, and per-slot strategy plus ordered provider ids. Profile names
 * never enter, so renames cannot fake or hide an update. Stored profiles and
 * materialized recommendations hash in the same space.
 */
export function computeRecipeFingerprint(config: {
  searchProviderId: string
  defaultLocale: ContentLocale | null
  slotConfigs: ScraperSlotConfigs
}): string {
  const slots = Object.entries(config.slotConfigs)
    .map(([slotName, slotConfig]) => ({
      slot: slotName,
      strategy: slotConfig.strategy,
      providers: slotConfig.providers
        .filter((entry) => entry.enabled)
        .sort((left, right) => left.priority - right.priority)
        .map((entry) => entry.providerId)
    }))
    .filter((entry) => entry.providers.length > 0)
    .sort((left, right) => left.slot.localeCompare(right.slot))

  const canonical = JSON.stringify({
    version: 1,
    searchProviderId: config.searchProviderId,
    defaultLocale: config.defaultLocale,
    slots
  })

  return `v1:${fnv1a(canonical)}`
}

/** FNV-1a 32-bit, hex-encoded; stable and dependency-free. */
function fnv1a(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}
