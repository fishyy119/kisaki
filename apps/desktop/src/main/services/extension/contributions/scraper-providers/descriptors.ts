import type { MainToHostRpcMethod } from '@kisaki3/extension-api'
import type { ContentEntityType } from '@shared/entity-types'
import { getRuntimeContributionKey } from '../types'
import type { ScraperDomain, ScraperRpcAction } from './domain'

export function getScraperKey(
  runtimeHandle: string,
  entityType: ContentEntityType,
  providerId: string
): string {
  return `${getRuntimeContributionKey(runtimeHandle, providerId)}:${entityType}`
}

export function getScraperRpcMethod(
  _domain: ScraperDomain,
  action: ScraperRpcAction
): MainToHostRpcMethod {
  return `contributions.scraperProviders.${action}` as MainToHostRpcMethod
}
