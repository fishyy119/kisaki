import type { MainToHostRpcMethod } from '@kisaki/extension-api'
import { getRuntimeContributionKey } from '../types'
import type { ScraperDomain, ScraperMediaType, ScraperRpcAction } from './domain'

export function getScraperKey(
  runtimeHandle: string,
  mediaType: ScraperMediaType,
  providerId: string
): string {
  return `${getRuntimeContributionKey(runtimeHandle, providerId)}:${mediaType}`
}

export function getHostScraperProviderId(extensionId: string, providerId: string): string {
  return `ext:${encodeURIComponent(extensionId)}/${encodeURIComponent(providerId)}`
}

export function getScraperRpcMethod(
  domain: ScraperDomain,
  action: ScraperRpcAction
): MainToHostRpcMethod {
  return `contributions.scrapers.${domain.kind}.${action}` as MainToHostRpcMethod
}
