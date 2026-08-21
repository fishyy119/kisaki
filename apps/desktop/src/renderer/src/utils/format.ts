/**
 * Formatting utilities for display (non-time related)
 *
 * Time-related formatting functions are in datetime.ts
 */

import type { AnimeStatus, GameStatus, Gender } from '@shared/db'
import type { AllEntityType } from '@shared/common'
import { messages } from '@renderer/core/i18n'

// =============================================================================
// Status Formatting
// =============================================================================

/** Badge variant type for status display */
export type StatusVariant = 'default' | 'secondary' | 'success' | 'warning' | 'destructive'

const GAME_STATUS_VARIANTS: Record<GameStatus, StatusVariant> = {
  notStarted: 'secondary',
  inProgress: 'default',
  partial: 'warning',
  completed: 'success',
  multiple: 'success',
  shelved: 'destructive'
}

const ANIME_STATUS_VARIANTS: Record<AnimeStatus, StatusVariant> = {
  planned: 'secondary',
  watching: 'default',
  completed: 'success',
  onHold: 'warning',
  dropped: 'destructive'
}

/**
 * Format game status to a localized label
 */
export function formatGameStatus(status: GameStatus): string {
  return messages.value.library.gameStatus[status]
}

/**
 * Map game status to badge variant for UI display
 */
export function getGameStatusVariant(status: GameStatus): StatusVariant {
  return GAME_STATUS_VARIANTS[status] ?? 'secondary'
}

/**
 * Format anime watch status to a localized label
 */
export function formatAnimeStatus(status: AnimeStatus): string {
  return messages.value.library.animeStatus[status]
}

/**
 * Map anime watch status to badge variant for UI display
 */
export function getAnimeStatusVariant(status: AnimeStatus): StatusVariant {
  return ANIME_STATUS_VARIANTS[status] ?? 'secondary'
}

/** Format an episode number, keeping one decimal only for half-numbered episodes. */
export function formatEpisodeNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

/** Join alternative names into one display line. */
export function formatAliases(aliases: readonly string[] | null | undefined): string | undefined {
  const names = (aliases ?? []).map((name) => name.trim()).filter(Boolean)
  return names.length > 0 ? names.join(' / ') : undefined
}

/** Parse the comma-separated aliases input of an entity form into names. */
export function parseAliasesInput(value: string): string[] {
  const names: string[] = []
  const seen = new Set<string>()

  for (const part of value.split(',')) {
    const name = part.trim()
    if (!name) continue

    const key = name.toLocaleLowerCase()
    if (seen.has(key)) continue

    seen.add(key)
    names.push(name)
  }

  return names
}

// =============================================================================
// File Size Formatting
// =============================================================================

/** Format a byte count with binary-step units (B, KB, MB, GB, TB). */
export function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = size
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  if (unitIndex === 0) return `${Math.round(value)} B`
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[unitIndex]}`
}

// =============================================================================
// Score Conversion
// =============================================================================

/**
 * Convert database score (0-100 integer) to display score (0-10 with one decimal)
 *
 * @example
 * dbScoreToDisplay(85) // "8.5"
 * dbScoreToDisplay(null) // ""
 */
export function dbScoreToDisplay(dbScore: number | null): string {
  if (dbScore === null || dbScore === undefined) return ''
  return (dbScore / 10).toFixed(1)
}

/**
 * Convert display score (0-10 with one decimal) to database score (0-100 integer)
 *
 * @example
 * displayScoreToDb("8.5") // 85
 * displayScoreToDb("") // null
 */
export function displayScoreToDb(displayScore: string): number | null {
  const trimmed = displayScore.trim()
  if (trimmed === '') return null
  const num = parseFloat(trimmed)
  if (isNaN(num)) return null
  const clamped = Math.max(0, Math.min(10, num))
  return Math.round(clamped * 10)
}

// =============================================================================
// Gender Formatting
// =============================================================================

/** Format gender to a localized label */
export function formatGender(gender: Gender): string {
  return messages.value.library.gender[gender]
}

// =============================================================================
// Spoiler Display
// =============================================================================

export interface SpoilerDisplay {
  hidden: boolean
  name: string
  note: string
}

/**
 * Resolve the display name/note of a spoiler-maskable list entry.
 * Hidden entries show fixed placeholder texts instead of real content.
 */
export function getSpoilerDisplay(
  name: string,
  note: string,
  isSpoiler: boolean,
  revealed: boolean
): SpoilerDisplay {
  const hidden = isSpoiler && !revealed
  const spoiler = messages.value.library.spoiler
  return {
    hidden,
    name: hidden ? spoiler.maskedName : name,
    note: hidden ? spoiler.maskedNote : note
  }
}

// =============================================================================
// Entity Icon Mapping
// =============================================================================

const ENTITY_ICONS: Record<AllEntityType, string> = {
  game: 'icon-[mdi--gamepad-variant-outline]',
  anime: 'icon-[mdi--television-classic]',
  character: 'icon-[mdi--ghost-outline]',
  person: 'icon-[mdi--account-circle-outline]',
  company: 'icon-[mdi--company]',
  collection: 'icon-[mdi--folder-outline]',
  tag: 'icon-[mdi--tag-outline]'
}

export function getEntityIcon(entityType: AllEntityType): string {
  return ENTITY_ICONS[entityType]
}
