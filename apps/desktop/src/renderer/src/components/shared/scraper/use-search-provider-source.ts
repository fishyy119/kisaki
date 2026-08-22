import { ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'
import { eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import type { ContentEntityType } from '@shared/common'
import { scraperProfiles } from '@shared/db'

const PROVIDER_CHANNELS = {
  game: 'scraper:get-game-provider',
  anime: 'scraper:get-anime-provider',
  person: 'scraper:get-person-provider',
  company: 'scraper:get-company-provider',
  character: 'scraper:get-character-provider'
} as const satisfies Record<ContentEntityType, string>

/**
 * External id source of a profile's search provider, or `null` while it is
 * unknown.
 *
 * A provider is addressed by one id and writes external ids under another: an
 * extension provider is selected as `ext:<extension>/<provider>` but owns a
 * plain source such as `tmdb`, and its `resolve` only recognizes the latter.
 * An id typed by hand must therefore be tagged with the provider's source, or
 * the lookup silently degrades into a search by name.
 */
export function useSearchProviderSource(
  profileId: Ref<string>,
  entityType: MaybeRefOrGetter<ContentEntityType>
): Ref<string | null> {
  const source = ref<string | null>(null)
  let latestRequest = 0

  watch(
    [profileId, () => toValue(entityType)],
    async ([id, type]) => {
      const request = (latestRequest += 1)
      source.value = null
      if (!id) {
        return
      }

      const profile = await db.query.scraperProfiles.findFirst({
        where: eq(scraperProfiles.id, id)
      })
      if (!profile?.searchProviderId || request !== latestRequest) {
        return
      }

      const result = await ipcManager.invoke(PROVIDER_CHANNELS[type], profile.searchProviderId)
      if (request !== latestRequest) {
        return
      }

      source.value = result.success ? result.data.externalIdSource : null
    },
    { immediate: true }
  )

  return source
}
