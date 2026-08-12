/**
 * Company Metadata Types
 *
 * Core metadata type definitions for company entities.
 */

import type { PartialDate, ExternalSite } from '@shared/db'
import type { ExternalId, Tag } from './common'

// =============================================================================
// Core Info
// =============================================================================

/**
 * Core company info.
 *
 * Minimal company information with required name and optional fields.
 */
export interface CompanyInfo {
  name: string
  originalName?: string
  foundedDate?: PartialDate
  description?: string
  externalSites?: ExternalSite[]
  externalIds: ExternalId[]
}

/**
 * Company metadata.
 *
 * Core company metadata used across identity and normalization layers.
 */
export interface CoreCompanyMetadata extends CompanyInfo {
  tags?: Tag[]
}
