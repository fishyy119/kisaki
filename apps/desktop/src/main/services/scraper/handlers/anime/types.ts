/**
 * Anime scraper execution result types passed from the runtime pipeline to merge.
 */

import type { AnimeScraperSlot } from '@shared/db'
import type { SlotResult } from '../../types'
import type { AnimeSessionResultMap } from './provider'

type AnimeSlotResult<S extends AnimeScraperSlot> = SlotResult<S, AnimeSessionResultMap[S]>

export type AnimeScraperInfoResult = AnimeSlotResult<'info'>
export type AnimeScraperTagsResult = AnimeSlotResult<'tags'>
export type AnimeScraperEpisodesResult = AnimeSlotResult<'episodes'>
export type AnimeScraperCharactersResult = AnimeSlotResult<'characters'>
export type AnimeScraperPersonsResult = AnimeSlotResult<'persons'>
export type AnimeScraperCompaniesResult = AnimeSlotResult<'companies'>
export type AnimeScraperRelatedEntriesResult = AnimeSlotResult<'relatedEntries'>
export type AnimeScraperCoversResult = AnimeSlotResult<'covers'>
export type AnimeScraperBackdropsResult = AnimeSlotResult<'backdrops'>
export type AnimeScraperLogosResult = AnimeSlotResult<'logos'>

export type AnimeScraperResult =
  | AnimeScraperInfoResult
  | AnimeScraperTagsResult
  | AnimeScraperEpisodesResult
  | AnimeScraperCharactersResult
  | AnimeScraperPersonsResult
  | AnimeScraperCompaniesResult
  | AnimeScraperRelatedEntriesResult
  | AnimeScraperCoversResult
  | AnimeScraperBackdropsResult
  | AnimeScraperLogosResult

export type AnimeScraperImageResult =
  AnimeScraperCoversResult | AnimeScraperBackdropsResult | AnimeScraperLogosResult
