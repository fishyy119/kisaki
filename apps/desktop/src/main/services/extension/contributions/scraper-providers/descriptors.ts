import type { MainToHostRpcMethod } from '@kisaki3/extension-api'
import type { ScraperMediaType } from '@shared/scraper'
import { getRuntimeContributionKey } from '../types'
import type { ScraperDomain, ScraperRpcAction } from './domain'

export function getScraperKey(
  runtimeHandle: string,
  mediaType: ScraperMediaType,
  providerId: string
): string {
  return `${getRuntimeContributionKey(runtimeHandle, providerId)}:${mediaType}`
}

export function getScraperRpcMethod(
  _domain: ScraperDomain,
  action: ScraperRpcAction
): MainToHostRpcMethod {
  return `contributions.scraperProviders.${action}` as MainToHostRpcMethod
}
