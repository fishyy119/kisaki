import type { MainToHostRpcMethod } from '@kisaki3/extension-api'
import { getRuntimeContributionKey } from '../types'
import type { ScraperDomain, ScraperMediaType, ScraperRpcAction } from './domain'

export function getScraperKey(
  runtimeHandle: string,
  mediaType: ScraperMediaType,
  providerId: string
): string {
  return `${getRuntimeContributionKey(runtimeHandle, providerId)}:${mediaType}`
}

export function getHostScraperProviderId(
  extensionId: string,
  mediaType: ScraperMediaType,
  providerId: string
): string {
  return `ext:${encodeURIComponent(extensionId)}/${encodeURIComponent(mediaType)}/${encodeURIComponent(providerId)}`
}

export function getScraperRpcMethod(
  _domain: ScraperDomain,
  action: ScraperRpcAction
): MainToHostRpcMethod {
  return `contributions.scraperProviders.${action}` as MainToHostRpcMethod
}
