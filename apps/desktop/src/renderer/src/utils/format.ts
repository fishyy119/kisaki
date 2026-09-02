/**
 * Formatting utilities for display (non-time related)
 *
 * Time-related formatting functions are in datetime.ts
 */

import { MEDIA_STATUS_VALUES, type Gender, type MediaStatus } from '@shared/db'
import type { AllEntityType, MediaType } from '@shared/entity-types'
import { messages } from '@renderer/core/i18n'

// =============================================================================
// Status Formatting
// =============================================================================

/** Badge variant type for status display */
export type StatusVariant = 'default' | 'secondary' | 'success' | 'warning' | 'destructive'

/** One shared status-to-variant mapping; status colors are media-independent. */
const MEDIA_STATUS_VARIANTS: Record<MediaStatus, StatusVariant> = {
  planned: 'secondary',
  active: 'default',
  completed: 'success',
  onHold: 'warning',
  dropped: 'destructive'
}

/** Format a media status to the media type's localized verb label. */
export function formatMediaStatus(mediaType: MediaType, status: MediaStatus): string {
  return messages.value.library.status.values[mediaType][status]
}

/** Map a media status to its badge variant for UI display. */
export function getMediaStatusVariant(status: MediaStatus): StatusVariant {
  return MEDIA_STATUS_VARIANTS[status] ?? 'secondary'
}

/** Localized status options in canonical order, verbs per media type. */
export function getMediaStatusOptions(
  mediaType: MediaType
): { value: MediaStatus; label: string }[] {
  return MEDIA_STATUS_VALUES.map((value) => ({
    value,
    label: formatMediaStatus(mediaType, value)
  }))
}

/**
 * Format a consumption unit number: an episode, volume, or chapter.
 *
 * Unit numbers are real numbers because sources place extras between
 * installments (24.5). Every decimal a source stated is kept: rounding to one
 * place would render 42.25 and 42.5 identically.
 */
export function formatUnitNumber(value: number): string {
  return String(value)
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
  anime: 'icon-[mdi--tv]',
  comic: 'icon-[mdi--thought-bubble-outline]',
  novel: 'icon-[mdi--book-open-blank-variant-outline]',
  character: 'icon-[mdi--ghost-outline]',
  person: 'icon-[mdi--account-circle-outline]',
  company: 'icon-[mdi--office-building-outline]',
  collection: 'icon-[mdi--folder-outline]',
  tag: 'icon-[mdi--tag-outline]'
}

export function getEntityIcon(entityType: AllEntityType): string {
  return ENTITY_ICONS[entityType]
}
