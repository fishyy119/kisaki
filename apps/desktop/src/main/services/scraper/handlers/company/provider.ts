/**
 * Company scraper provider runtime contract.
 */

import type { CompanyScraperSlot } from '@shared/db'
import type { Tag } from '@shared/metadata'
import type {
  CompanySearchResult,
  ScrapedCompanyInfo,
  ScraperCapability,
  ScraperLookup
} from '@shared/scraper'
import {
  type BaseScraperSession,
  type IdResolvedTarget,
  type ScraperProviderContext
} from '../../types'

export type CompanyResolvedTarget = IdResolvedTarget

export interface CompanySessionResultMap {
  info: ScrapedCompanyInfo
  tags: Tag[]
  logos: string[]
}

export type CompanyScraperSession = BaseScraperSession<CompanyScraperSlot, CompanySessionResultMap>

export interface CompanyScraperProvider {
  readonly id: string
  readonly name: string
  readonly externalIdSource: string
  readonly capabilities: readonly ScraperCapability[]

  /** Present if and only if `capabilities` declares `search`. */
  search?(query: string, ctx: ScraperProviderContext): Promise<CompanySearchResult[]>
  resolve(lookup: ScraperLookup, ctx: ScraperProviderContext): Promise<CompanyResolvedTarget | null>
  openSession(
    target: CompanyResolvedTarget,
    ctx: ScraperProviderContext
  ): Promise<CompanyScraperSession>
}
