/**
 * Comic scraper execution result types passed from the runtime pipeline to merge.
 */

import type { ComicScraperSlot } from '@shared/db'
import type { SlotResult } from '../../types'
import type { ComicSessionResultMap } from './provider'

type ComicSlotResult<S extends ComicScraperSlot> = SlotResult<S, ComicSessionResultMap[S]>

export type ComicScraperInfoResult = ComicSlotResult<'info'>
export type ComicScraperTagsResult = ComicSlotResult<'tags'>
export type ComicScraperChaptersResult = ComicSlotResult<'chapters'>
export type ComicScraperCharactersResult = ComicSlotResult<'characters'>
export type ComicScraperPersonsResult = ComicSlotResult<'persons'>
export type ComicScraperCompaniesResult = ComicSlotResult<'companies'>
export type ComicScraperRelatedEntriesResult = ComicSlotResult<'relatedEntries'>
export type ComicScraperCoversResult = ComicSlotResult<'covers'>
export type ComicScraperBackdropsResult = ComicSlotResult<'backdrops'>
export type ComicScraperLogosResult = ComicSlotResult<'logos'>

export type ComicScraperResult =
  | ComicScraperInfoResult
  | ComicScraperTagsResult
  | ComicScraperChaptersResult
  | ComicScraperCharactersResult
  | ComicScraperPersonsResult
  | ComicScraperCompaniesResult
  | ComicScraperRelatedEntriesResult
  | ComicScraperCoversResult
  | ComicScraperBackdropsResult
  | ComicScraperLogosResult

export type ComicScraperImageResult =
  ComicScraperCoversResult | ComicScraperBackdropsResult | ComicScraperLogosResult
