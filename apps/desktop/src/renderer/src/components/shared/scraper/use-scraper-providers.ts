import { CONTENT_ENTITY_TYPES, type ContentEntityType } from '@shared/entity-types'
import {
  useAsyncData,
  type UseAsyncDataOptions,
  type UseAsyncDataReturn
} from '@renderer/composables'
import { ipcManager } from '@renderer/core/ipc'
import type { ScraperProviderInfo, ScraperProvidersByType } from './provider-display'

/**
 * Lists the registered scraper providers for one entity type. A failed IPC
 * answer degrades to an empty list: every consumer treats "no providers" and
 * "providers unavailable" the same way (options simply absent).
 */
export async function fetchScraperProviders(
  entityType: ContentEntityType
): Promise<ScraperProviderInfo[]> {
  switch (entityType) {
    case 'game': {
      const result = await ipcManager.invoke('scraper:list-game-providers')
      return result.success ? result.data : []
    }
    case 'anime': {
      const result = await ipcManager.invoke('scraper:list-anime-providers')
      return result.success ? result.data : []
    }
    case 'comic': {
      const result = await ipcManager.invoke('scraper:list-comic-providers')
      return result.success ? result.data : []
    }
    case 'novel': {
      const result = await ipcManager.invoke('scraper:list-novel-providers')
      return result.success ? result.data : []
    }
    case 'person': {
      const result = await ipcManager.invoke('scraper:list-person-providers')
      return result.success ? result.data : []
    }
    case 'company': {
      const result = await ipcManager.invoke('scraper:list-company-providers')
      return result.success ? result.data : []
    }
    case 'character': {
      const result = await ipcManager.invoke('scraper:list-character-providers')
      return result.success ? result.data : []
    }
  }
}

/** Lists providers for all seven entity types concurrently. */
export async function fetchScraperProvidersByType(): Promise<ScraperProvidersByType> {
  const entries = await Promise.all(
    CONTENT_ENTITY_TYPES.map(
      async (entityType) => [entityType, await fetchScraperProviders(entityType)] as const
    )
  )
  return Object.fromEntries(entries) as ScraperProvidersByType
}

/** Reactive wrapper over {@link fetchScraperProvidersByType}. */
export function useScraperProviders(
  options: UseAsyncDataOptions = {}
): UseAsyncDataReturn<ScraperProvidersByType> {
  return useAsyncData(fetchScraperProvidersByType, options)
}
