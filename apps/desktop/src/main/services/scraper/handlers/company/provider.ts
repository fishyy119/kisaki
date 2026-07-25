/**
 * Company scraper provider runtime contract.
 */

import type { CompanyScraperSlot } from '@shared/db'
import type { Tag } from '@shared/metadata'
import type { ContentLocale } from '@shared/i18n'
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

  search(query: string, locale?: ContentLocale): Promise<CompanySearchResult[]>
  resolve(lookup: ScraperLookup, locale: ContentLocale): Promise<CompanyResolvedTarget | null>
  openSession(target: CompanyResolvedTarget, locale: ContentLocale): Promise<CompanyScraperSession>
}
