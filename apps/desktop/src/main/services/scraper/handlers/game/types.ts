/**
 * Game scraper execution result types passed from the runtime pipeline to merge.
 */

import type { GameScraperSlot } from '@shared/db'
import type { SlotResult } from '../../types'
import type { GameSessionResultMap } from './provider'

type GameSlotResult<S extends GameScraperSlot> = SlotResult<S, GameSessionResultMap[S]>

export type GameScraperInfoResult = GameSlotResult<'info'>
export type GameScraperTagsResult = GameSlotResult<'tags'>
export type GameScraperCharactersResult = GameSlotResult<'characters'>
export type GameScraperPersonsResult = GameSlotResult<'persons'>
export type GameScraperCompaniesResult = GameSlotResult<'companies'>
export type GameScraperCoversResult = GameSlotResult<'covers'>
export type GameScraperBackdropsResult = GameSlotResult<'backdrops'>
export type GameScraperLogosResult = GameSlotResult<'logos'>
export type GameScraperIconsResult = GameSlotResult<'icons'>

export type GameScraperResult =
  | GameScraperInfoResult
  | GameScraperTagsResult
  | GameScraperCharactersResult
  | GameScraperPersonsResult
  | GameScraperCompaniesResult
  | GameScraperCoversResult
  | GameScraperBackdropsResult
  | GameScraperLogosResult
  | GameScraperIconsResult

export type GameScraperImageSlot = 'covers' | 'backdrops' | 'logos' | 'icons'

export type GameScraperImageResult =
  | GameScraperCoversResult
  | GameScraperBackdropsResult
  | GameScraperLogosResult
  | GameScraperIconsResult
