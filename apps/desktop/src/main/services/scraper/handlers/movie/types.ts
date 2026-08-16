/**
 * Movie scraper execution result types passed from the runtime pipeline to merge.
 */

import type { MovieScraperSlot } from '@shared/db'
import type { SlotResult } from '../../types'
import type { MovieSessionResultMap } from './provider'

type MovieSlotResult<S extends MovieScraperSlot> = SlotResult<S, MovieSessionResultMap[S]>

export type MovieScraperInfoResult = MovieSlotResult<'info'>
export type MovieScraperTagsResult = MovieSlotResult<'tags'>
export type MovieScraperCharactersResult = MovieSlotResult<'characters'>
export type MovieScraperPersonsResult = MovieSlotResult<'persons'>
export type MovieScraperCompaniesResult = MovieSlotResult<'companies'>
export type MovieScraperRelatedEntriesResult = MovieSlotResult<'relatedEntries'>
export type MovieScraperCoversResult = MovieSlotResult<'covers'>
export type MovieScraperBackdropsResult = MovieSlotResult<'backdrops'>
export type MovieScraperLogosResult = MovieSlotResult<'logos'>

export type MovieScraperResult =
  | MovieScraperInfoResult
  | MovieScraperTagsResult
  | MovieScraperCharactersResult
  | MovieScraperPersonsResult
  | MovieScraperCompaniesResult
  | MovieScraperRelatedEntriesResult
  | MovieScraperCoversResult
  | MovieScraperBackdropsResult
  | MovieScraperLogosResult

export type MovieScraperImageResult =
  MovieScraperCoversResult | MovieScraperBackdropsResult | MovieScraperLogosResult
