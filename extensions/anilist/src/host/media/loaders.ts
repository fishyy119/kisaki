/**
 * Invocation-scoped loaders for one media entry.
 *
 * The entry itself is one request; character and staff connections page
 * separately and are only read when their slots are requested. Every read is
 * memoized so overlapping slots share the fan-out.
 */

import type { AnilistClient } from '../api/client'
import type { AnilistCharacterEdge, AnilistMedia, AnilistStaffEdge } from '../api/types'
import { ANILIST_CONNECTION_MAX_PAGES, ANILIST_CONNECTION_PAGE_SIZE } from '../utils/constants'

export interface AnilistMediaLoaders {
  getMedia(): Promise<AnilistMedia>
  getCharacterEdges(): Promise<AnilistCharacterEdge[]>
  getStaffEdges(): Promise<AnilistStaffEdge[]>
}

export function createMediaLoaders(
  client: AnilistClient,
  mediaId: number,
  signal: AbortSignal
): AnilistMediaLoaders {
  const request = { signal }

  const getMedia = memoize(() => client.getMedia(mediaId, request))

  const getCharacterEdges = memoize(async () => {
    const edges: AnilistCharacterEdge[] = []
    for (let page = 1; page <= ANILIST_CONNECTION_MAX_PAGES; page += 1) {
      const connection = await client.getMediaCharacters(
        mediaId,
        page,
        ANILIST_CONNECTION_PAGE_SIZE,
        request
      )
      edges.push(...(connection.edges ?? []))
      if (!connection.pageInfo?.hasNextPage) {
        break
      }
    }
    return edges
  })

  const getStaffEdges = memoize(async () => {
    const edges: AnilistStaffEdge[] = []
    for (let page = 1; page <= ANILIST_CONNECTION_MAX_PAGES; page += 1) {
      const connection = await client.getMediaStaff(
        mediaId,
        page,
        ANILIST_CONNECTION_PAGE_SIZE,
        request
      )
      edges.push(...(connection.edges ?? []))
      if (!connection.pageInfo?.hasNextPage) {
        break
      }
    }
    return edges
  })

  return { getMedia, getCharacterEdges, getStaffEdges }
}

function memoize<T>(load: () => Promise<T>): () => Promise<T> {
  let value: T | undefined
  let loaded = false

  return async () => {
    if (!loaded) {
      value = await load()
      loaded = true
    }
    return value as T
  }
}
