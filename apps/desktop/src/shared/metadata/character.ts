/**
 * Character Metadata Types
 *
 * Core metadata type definitions for character entities.
 */

import type { PartialDate, ExternalSite } from '@shared/db'
import type { Gender, BloodType, CupSize } from '@shared/db'
import type { ExternalId, Tag } from './base'

// =============================================================================
// Core Info
// =============================================================================

/**
 * Core character info.
 *
 * Minimal character information with required name and optional fields.
 */
export interface CharacterInfo {
  name: string
  originalName?: string | undefined
  /** Nicknames and romanizations this character is also known by. */
  aliases?: string[] | undefined
  birthDate?: PartialDate | undefined
  gender?: Gender | undefined
  age?: number | undefined
  bloodType?: BloodType | undefined
  height?: number | undefined
  weight?: number | undefined
  bust?: number | undefined
  waist?: number | undefined
  hips?: number | undefined
  cup?: CupSize | undefined
  description?: string | undefined
  externalSites?: ExternalSite[] | undefined
  externalIds: ExternalId[]
}

/**
 * Character metadata.
 *
 * Core character metadata used across identity and normalization layers.
 */
export interface CoreCharacterMetadata extends CharacterInfo {
  tags?: Tag[] | undefined
}
