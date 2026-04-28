/**
 * Person scraper provider runtime contract.
 */

import type { PersonScraperSlot } from '@shared/db'
import type { PersonInfo, Tag } from '@shared/metadata'
import type { Locale } from '@shared/locale'
import type { PersonSearchResult, ScraperCapability, ScraperLookup } from '@shared/scraper'
import { type BaseScraperSession, type IdResolvedTarget } from '../../types'

export type PersonResolvedTarget = IdResolvedTarget

export interface PersonSessionResultMap {
  info: PersonInfo
  tags: Tag[]
  photos: string[]
}

export type PersonScraperSession = BaseScraperSession<PersonScraperSlot, PersonSessionResultMap>

export interface PersonScraperProvider {
  readonly id: string
  readonly name: string
  readonly externalIdSource: string
  readonly capabilities: readonly ScraperCapability[]

  search(query: string, locale?: Locale): Promise<PersonSearchResult[]>
  resolve(lookup: ScraperLookup, locale: Locale): Promise<PersonResolvedTarget | null>
  openSession(target: PersonResolvedTarget, locale: Locale): Promise<PersonScraperSession>
}
