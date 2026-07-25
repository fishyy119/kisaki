/**
 * Static slot planning and runtime slot-config helpers.
 */

import type { ScraperProfile, ScraperProviderEntry, ScraperSlot, SlotStrategy } from '@shared/db'
import {
  getScraperSlotsForMediaType,
  normalizeSlotConfigs,
  type ScraperMediaType,
  type SlotConfigsForMediaType
} from '@shared/scraper'
import type { ContentLocale } from '@shared/i18n'
import type { RegisteredScraperProvider } from './registry'

export interface PlannedSlotEntry<TSlot extends string> {
  slot: TSlot
  providerId: string
  rank: number
  locale: ContentLocale
  strategy: SlotStrategy
}

export interface PlannedProviderTask<TSlot extends string> {
  providerId: string
  locale: ContentLocale
  slots: readonly TSlot[]
  entries: readonly PlannedSlotEntry<TSlot>[]
}

export interface PlannedWaveStep<TSlot extends string> {
  rank: number
  tasks: readonly PlannedProviderTask<TSlot>[]
}

export interface ScraperExecutionPlan<TSlot extends string> {
  firstWave: readonly PlannedWaveStep<TSlot>[]
  enrichWave: readonly PlannedWaveStep<TSlot>[]
}

/**
 * Build a minimal one-provider plan for single-slot execution paths such as image pickers.
 */
export function buildSingleProviderExecutionPlan<TSlot extends string>(options: {
  providerId: string
  slot: TSlot
  locale: ContentLocale
  strategy?: SlotStrategy
  rank?: number
}): ScraperExecutionPlan<TSlot> {
  const strategy = options.strategy ?? 'enrich'
  const rank = options.rank ?? 0
  const step: PlannedWaveStep<TSlot> = {
    rank,
    tasks: [
      {
        providerId: options.providerId,
        locale: options.locale,
        slots: [options.slot],
        entries: [
          {
            slot: options.slot,
            providerId: options.providerId,
            rank,
            locale: options.locale,
            strategy
          }
        ]
      }
    ]
  }

  return strategy === 'first'
    ? {
        firstWave: [step],
        enrichWave: []
      }
    : {
        firstWave: [],
        enrichWave: [step]
      }
}

function isUsableSlotProvider(
  provider: RegisteredScraperProvider | undefined,
  slot: ScraperSlot
): boolean {
  return Boolean(
    provider && provider.capabilities.includes('search') && provider.capabilities.includes(slot)
  )
}

function compareProviderEntries(
  a: { priority: number; index: number },
  b: { priority: number; index: number }
): number {
  return a.priority - b.priority || a.index - b.index
}

function sortProviderEntries(entries: readonly ScraperProviderEntry[]): ScraperProviderEntry[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) =>
      compareProviderEntries(
        { priority: a.entry.priority, index: a.index },
        { priority: b.entry.priority, index: b.index }
      )
    )
    .map(({ entry }) => ({ ...entry }))
}

function sanitizeProviderEntries(
  slot: ScraperSlot,
  entries: readonly ScraperProviderEntry[],
  providers: ReadonlyMap<string, RegisteredScraperProvider>
): ScraperProviderEntry[] {
  return sortProviderEntries(entries)
    .filter((entry) => isUsableSlotProvider(providers.get(entry.providerId), slot))
    .map((entry, priority) => ({
      ...entry,
      priority
    }))
}

function groupWaveEntriesByProvider<TSlot extends string>(
  entries: readonly PlannedSlotEntry<TSlot>[]
): readonly PlannedWaveStep<TSlot>[] {
  const rankGroups = new Map<number, Map<string, PlannedSlotEntry<TSlot>[]>>()

  for (const entry of entries) {
    if (!rankGroups.has(entry.rank)) {
      rankGroups.set(entry.rank, new Map<string, PlannedSlotEntry<TSlot>[]>())
    }

    const providerGroups = rankGroups.get(entry.rank)!
    const taskKey = `${entry.providerId}::${entry.locale}`
    if (!providerGroups.has(taskKey)) {
      providerGroups.set(taskKey, [])
    }

    providerGroups.get(taskKey)!.push(entry)
  }

  return Array.from(rankGroups.entries())
    .sort(([a], [b]) => a - b)
    .map(([rank, providerGroups]) => ({
      rank,
      tasks: Array.from(providerGroups.entries())
        .map(([, providerEntries]) => ({
          providerId: providerEntries[0]!.providerId,
          locale: providerEntries[0]!.locale,
          slots: providerEntries.map((entry) => entry.slot),
          entries: providerEntries
        }))
        .sort((a, b) => {
          const providerOrder = a.providerId.localeCompare(b.providerId)
          return providerOrder !== 0 ? providerOrder : a.locale.localeCompare(b.locale)
        })
    }))
}

function buildTaskKey<TSlot extends string>(entry: PlannedSlotEntry<TSlot>): string {
  return `${entry.providerId}::${entry.rank}::${entry.locale}`
}

/**
 * Return enabled provider entries in runtime order and assign contiguous execution ranks.
 */
export function getEnabledRuntimeProviderEntries(
  entries: readonly ScraperProviderEntry[]
): Array<ScraperProviderEntry & { rank: number }> {
  return sortProviderEntries(entries)
    .filter((entry) => entry.enabled)
    .map((entry, rank) => ({
      ...entry,
      rank
    }))
}

/**
 * Build runtime slot configs for a scrape invocation.
 *
 * Providers that are unavailable or cannot serve a slot are skipped only for the
 * current invocation. User profile data must remain independent from runtime
 * provider availability.
 */
export function prepareRuntimeSlotConfigs<T extends ScraperMediaType>(
  mediaType: T,
  slotConfigs: ScraperProfile['slotConfigs'],
  providers: ReadonlyMap<string, RegisteredScraperProvider>
): SlotConfigsForMediaType<T> {
  const cleaned = normalizeSlotConfigs(mediaType, slotConfigs)
  const slots = getScraperSlotsForMediaType(
    mediaType
  ) as readonly (keyof SlotConfigsForMediaType<T> & ScraperSlot)[]

  for (const slot of slots) {
    const config = cleaned[slot] as { providers: ScraperProviderEntry[] }
    config.providers = sanitizeProviderEntries(slot, config.providers, providers)
  }

  return cleaned
}

/**
 * Fold slot-provider entries into provider tasks grouped by rank and strategy.
 */
export function buildExecutionPlan<TSlot extends string>(options: {
  slotConfigs: Record<
    TSlot,
    {
      providers: readonly ScraperProviderEntry[]
      strategy: SlotStrategy
    }
  >
  resolveLocale: (entry: ScraperProviderEntry) => ContentLocale
}): ScraperExecutionPlan<TSlot> {
  const plannedEntries: PlannedSlotEntry<TSlot>[] = []

  for (const [slot, config] of Object.entries(options.slotConfigs) as unknown as Array<
    readonly [
      TSlot,
      {
        providers: readonly ScraperProviderEntry[]
        strategy: SlotStrategy
      }
    ]
  >) {
    for (const entry of getEnabledRuntimeProviderEntries(config.providers)) {
      plannedEntries.push({
        slot,
        providerId: entry.providerId,
        rank: entry.rank,
        locale: options.resolveLocale(entry),
        strategy: config.strategy
      })
    }
  }

  const firstEntries = plannedEntries.filter((entry) => entry.strategy === 'first')
  const enrichEntries = plannedEntries.filter((entry) => entry.strategy === 'enrich')
  const eagerTaskKeys = new Set(firstEntries.map((entry) => buildTaskKey(entry)))
  const eagerEnrichEntries: PlannedSlotEntry<TSlot>[] = []
  const deferredEnrichEntries: PlannedSlotEntry<TSlot>[] = []

  for (const entry of enrichEntries) {
    if (eagerTaskKeys.has(buildTaskKey(entry))) {
      eagerEnrichEntries.push(entry)
      continue
    }

    deferredEnrichEntries.push(entry)
  }

  return {
    firstWave: groupWaveEntriesByProvider([...firstEntries, ...eagerEnrichEntries]),
    enrichWave: groupWaveEntriesByProvider(deferredEnrichEntries)
  }
}
