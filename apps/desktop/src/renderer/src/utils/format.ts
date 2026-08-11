/**
 * Formatting utilities for display (non-time related)
 *
 * Time-related formatting functions are in datetime.ts
 */

import type { Status, Gender } from '@shared/db'
import type { AllEntityType } from '@shared/common'
import { messages } from '@renderer/core/i18n'

// =============================================================================
// Status Formatting
// =============================================================================

/** Badge variant type for status display */
export type StatusVariant = 'default' | 'secondary' | 'success' | 'warning' | 'destructive'

const STATUS_VARIANTS: Record<Status, StatusVariant> = {
  notStarted: 'secondary',
  inProgress: 'default',
  partial: 'warning',
  completed: 'success',
  multiple: 'success',
  shelved: 'destructive'
}

/**
 * Format game status to a localized label
 */
export function formatStatus(status: Status): string {
  return messages.value.library.status[status]
}

/**
 * Map status to badge variant for UI display
 */
export function getStatusVariant(status: Status): StatusVariant {
  return STATUS_VARIANTS[status] ?? 'secondary'
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
