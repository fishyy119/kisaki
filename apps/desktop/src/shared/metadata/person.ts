/**
 * Person Metadata Types
 *
 * Core metadata type definitions for person entities.
 */

import type { PartialDate, ExternalSite } from '@shared/db'
import type { Gender } from '@shared/db'
import type { ExternalId, Tag } from './common'

// =============================================================================
// Core Info
// =============================================================================

/**
 * Core person info.
 *
 * Minimal person information with required name and optional fields.
 */
export interface PersonInfo {
  name: string
  originalName?: string
  /** Other names this person is credited under, such as pen names. */
  aliases?: string[]
  birthDate?: PartialDate
  deathDate?: PartialDate
  gender?: Gender
  description?: string
  externalSites?: ExternalSite[]
  externalIds: ExternalId[]
}

/**
 * Person metadata.
 *
 * Core person metadata used across identity and normalization layers.
 */
export interface CorePersonMetadata extends PersonInfo {
  tags?: Tag[]
}
