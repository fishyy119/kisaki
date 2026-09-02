/**
 * Company Metadata Types
 *
 * Core metadata type definitions for company entities.
 */

import type { PartialDate, ExternalSite } from '@shared/db'
import type { ExternalId, Tag } from './base'

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
  originalName?: string | undefined
  foundedDate?: PartialDate | undefined
  description?: string | undefined
  externalSites?: ExternalSite[] | undefined
  externalIds: ExternalId[]
}

/**
 * Company metadata.
 *
 * Core company metadata used across identity and normalization layers.
 */
export interface CoreCompanyMetadata extends CompanyInfo {
  tags?: Tag[] | undefined
}
