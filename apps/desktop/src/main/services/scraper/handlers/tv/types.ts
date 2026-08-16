/**
 * TV scraper execution result types passed from the runtime pipeline to merge.
 */

import type { TvScraperSlot } from '@shared/db'
import type { SlotResult } from '../../types'
import type { TvSessionResultMap } from './provider'

type TvSlotResult<S extends TvScraperSlot> = SlotResult<S, TvSessionResultMap[S]>

export type TvScraperInfoResult = TvSlotResult<'info'>
export type TvScraperTagsResult = TvSlotResult<'tags'>
export type TvScraperSeasonsResult = TvSlotResult<'seasons'>
export type TvScraperEpisodesResult = TvSlotResult<'episodes'>
export type TvScraperCharactersResult = TvSlotResult<'characters'>
export type TvScraperPersonsResult = TvSlotResult<'persons'>
export type TvScraperCompaniesResult = TvSlotResult<'companies'>
export type TvScraperRelatedEntriesResult = TvSlotResult<'relatedEntries'>
export type TvScraperCoversResult = TvSlotResult<'covers'>
export type TvScraperBackdropsResult = TvSlotResult<'backdrops'>
export type TvScraperLogosResult = TvSlotResult<'logos'>

export type TvScraperResult =
  | TvScraperInfoResult
  | TvScraperTagsResult
  | TvScraperSeasonsResult
  | TvScraperEpisodesResult
  | TvScraperCharactersResult
  | TvScraperPersonsResult
  | TvScraperCompaniesResult
  | TvScraperRelatedEntriesResult
  | TvScraperCoversResult
  | TvScraperBackdropsResult
  | TvScraperLogosResult

export type TvScraperImageResult =
  TvScraperCoversResult | TvScraperBackdropsResult | TvScraperLogosResult
