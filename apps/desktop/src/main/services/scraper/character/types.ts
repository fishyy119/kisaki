/**
 * Character scraper execution result types passed from the runtime pipeline to merge.
 */

import type { CharacterScraperSlot } from '@shared/db'
import type { SlotResult } from '../types'
import type { CharacterSessionResultMap } from './provider'

type CharacterSlotResult<S extends CharacterScraperSlot> = SlotResult<
  S,
  CharacterSessionResultMap[S]
>

export type CharacterScraperInfoResult = CharacterSlotResult<'info'>
export type CharacterScraperTagsResult = CharacterSlotResult<'tags'>
export type CharacterScraperPersonsResult = CharacterSlotResult<'persons'>
export type CharacterScraperPhotosResult = CharacterSlotResult<'photos'>

export type CharacterScraperResult =
  | CharacterScraperInfoResult
  | CharacterScraperTagsResult
  | CharacterScraperPersonsResult
  | CharacterScraperPhotosResult

export type CharacterScraperImageSlot = 'photos'

export type CharacterScraperImageResult = CharacterScraperPhotosResult
