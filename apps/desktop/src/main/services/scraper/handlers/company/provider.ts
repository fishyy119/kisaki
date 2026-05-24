/**
 * Company scraper provider runtime contract.
 */

import type { CompanyScraperSlot } from '@shared/db'
import type { Tag } from '@shared/metadata'
import type { Locale } from '@shared/locale'
import type {
  CompanySearchResult,
  ScrapedCompanyInfo,
  ScraperCapability,
  ScraperLookup
} from '@shared/scraper'
import { type BaseScraperSession, type IdResolvedTarget } from '../../types'

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

  search(query: string, locale?: Locale): Promise<CompanySearchResult[]>
  resolve(lookup: ScraperLookup, locale: Locale): Promise<CompanyResolvedTarget | null>
  openSession(target: CompanyResolvedTarget, locale: Locale): Promise<CompanyScraperSession>
}
