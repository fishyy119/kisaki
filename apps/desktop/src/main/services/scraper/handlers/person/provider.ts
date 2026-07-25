/**
 * Person scraper provider runtime contract.
 */

import type { PersonScraperSlot } from '@shared/db'
import type { Tag } from '@shared/metadata'
import type { ContentLocale } from '@shared/i18n'
import type {
  PersonSearchResult,
  ScrapedPersonInfo,
  ScraperCapability,
  ScraperLookup
} from '@shared/scraper'
import { type BaseScraperSession, type IdResolvedTarget } from '../../types'

export type PersonResolvedTarget = IdResolvedTarget

export interface PersonSessionResultMap {
  info: ScrapedPersonInfo
  tags: Tag[]
  photos: string[]
}

export type PersonScraperSession = BaseScraperSession<PersonScraperSlot, PersonSessionResultMap>

export interface PersonScraperProvider {
  readonly id: string
  readonly name: string
  readonly externalIdSource: string
  readonly capabilities: readonly ScraperCapability[]

  search(query: string, locale?: ContentLocale): Promise<PersonSearchResult[]>
  resolve(lookup: ScraperLookup, locale: ContentLocale): Promise<PersonResolvedTarget | null>
  openSession(target: PersonResolvedTarget, locale: ContentLocale): Promise<PersonScraperSession>
}
