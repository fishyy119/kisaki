/**
 * Company scraper execution result types passed from the runtime pipeline to merge.
 */

import type { CompanyScraperSlot } from '@shared/db'
import type { SlotResult } from '../types'
import type { CompanySessionResultMap } from './provider'

type CompanySlotResult<S extends CompanyScraperSlot> = SlotResult<S, CompanySessionResultMap[S]>

export type CompanyScraperInfoResult = CompanySlotResult<'info'>
export type CompanyScraperTagsResult = CompanySlotResult<'tags'>
export type CompanyScraperLogosResult = CompanySlotResult<'logos'>

export type CompanyScraperResult =
  CompanyScraperInfoResult | CompanyScraperTagsResult | CompanyScraperLogosResult

export type CompanyScraperImageSlot = 'logos'

export type CompanyScraperImageResult = CompanyScraperLogosResult
