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
  originalName?: string | undefined
  /** Other names this person is credited under, such as pen names. */
  aliases?: string[] | undefined
  birthDate?: PartialDate | undefined
  deathDate?: PartialDate | undefined
  gender?: Gender | undefined
  description?: string | undefined
  externalSites?: ExternalSite[] | undefined
  externalIds: ExternalId[]
}

/**
 * Person metadata.
 *
 * Core person metadata used across identity and normalization layers.
 */
export interface CorePersonMetadata extends PersonInfo {
  tags?: Tag[] | undefined
}
