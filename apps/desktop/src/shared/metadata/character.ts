/**
 * Character Metadata Types
 *
 * Core metadata type definitions for character entities.
 */

import type { PartialDate, RelatedSite } from '@shared/db'
import type { Gender, BloodType, CupSize } from '@shared/db'
import type { ExternalId, Tag } from './common'

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
  originalName?: string
  birthDate?: PartialDate
  gender?: Gender
  age?: number
  bloodType?: BloodType
  height?: number
  weight?: number
  bust?: number
  waist?: number
  hips?: number
  cup?: CupSize
  description?: string
  relatedSites?: RelatedSite[]
  externalIds: ExternalId[]
}

/**
 * Character metadata.
 *
 * Core character metadata used across identity and normalization layers.
 */
export interface CoreCharacterMetadata extends CharacterInfo {
  tags?: Tag[]
}
