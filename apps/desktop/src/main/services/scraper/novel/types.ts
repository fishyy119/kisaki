/**
 * Novel scraper execution result types passed from the runtime pipeline to merge.
 */

import type { NovelScraperSlot } from '@shared/db'
import type { SlotResult } from '../types'
import type { NovelSessionResultMap } from './provider'

type NovelSlotResult<S extends NovelScraperSlot> = SlotResult<S, NovelSessionResultMap[S]>

export type NovelScraperInfoResult = NovelSlotResult<'info'>
export type NovelScraperTagsResult = NovelSlotResult<'tags'>
export type NovelScraperVolumesResult = NovelSlotResult<'volumes'>
export type NovelScraperCharactersResult = NovelSlotResult<'characters'>
export type NovelScraperPersonsResult = NovelSlotResult<'persons'>
export type NovelScraperCompaniesResult = NovelSlotResult<'companies'>
export type NovelScraperRelatedEntriesResult = NovelSlotResult<'relatedEntries'>
export type NovelScraperCoversResult = NovelSlotResult<'covers'>
export type NovelScraperBackdropsResult = NovelSlotResult<'backdrops'>
export type NovelScraperLogosResult = NovelSlotResult<'logos'>

export type NovelScraperResult =
  | NovelScraperInfoResult
  | NovelScraperTagsResult
  | NovelScraperVolumesResult
  | NovelScraperCharactersResult
  | NovelScraperPersonsResult
  | NovelScraperCompaniesResult
  | NovelScraperRelatedEntriesResult
  | NovelScraperCoversResult
  | NovelScraperBackdropsResult
  | NovelScraperLogosResult

export type NovelScraperImageResult =
  NovelScraperCoversResult | NovelScraperBackdropsResult | NovelScraperLogosResult
