/**
 * Person scraper execution result types passed from the runtime pipeline to merge.
 */

import type { PersonScraperSlot } from '@shared/db'
import type { SlotResult } from '../../types'
import type { PersonSessionResultMap } from './provider'

type PersonSlotResult<S extends PersonScraperSlot> = SlotResult<S, PersonSessionResultMap[S]>

export type PersonScraperInfoResult = PersonSlotResult<'info'>
export type PersonScraperTagsResult = PersonSlotResult<'tags'>
export type PersonScraperPhotosResult = PersonSlotResult<'photos'>

export type PersonScraperResult =
  | PersonScraperInfoResult
  | PersonScraperTagsResult
  | PersonScraperPhotosResult

export type PersonScraperImageSlot = 'photos'

export type PersonScraperImageResult = PersonScraperPhotosResult
