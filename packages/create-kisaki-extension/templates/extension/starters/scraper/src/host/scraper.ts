import {
  type ExtensionContext,
  type GameScraperProvider,
  type GameScraperSession,
  type GameScraperSlot,
  type GameSearchResult,
  type GameSessionResultMap,
  type IdResolvedTarget,
  type ScrapedEntityIdentity,
  type ScraperLookup
} from '@kisaki3/extension-sdk'

const extensionName = `{{EXTENSION_NAME}}`
const sourceId = `{{EXTENSION_ID}}`

const sampleGames: readonly GameSearchResult[] = [
  {
    id: 'sample-game',
    name: 'Sample Game',
    originalName: 'Sample Game',
    externalIds: [{ source: sourceId, id: 'sample-game' }]
  }
]

const gameProvider: GameScraperProvider = {
  id: 'sample',
  name: extensionName,
  externalIdSource: sourceId,
  capabilities: ['search', 'info', 'tags'],

  async search(query) {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) {
      return []
    }

    return sampleGames.filter((game) => game.name.toLowerCase().includes(normalizedQuery))
  },

  async resolve(lookup) {
    const knownTarget = resolveKnownTarget(lookup)
    if (knownTarget) {
      return knownTarget
    }

    const firstResult = (await this.search(lookup.name))[0]
    return firstResult ? createResolvedTarget(firstResult.id, firstResult.name) : null
  },

  async openSession(target) {
    return createGameSession(target)
  }
}

/** Registers a sample game scraper provider. */
export function activateStarter(context: ExtensionContext): void {
  context.contributions.scraperProviders.game.register(gameProvider)
}

function resolveKnownTarget(lookup: ScraperLookup): IdResolvedTarget | null {
  const knownId = lookup.knownIds?.find((externalId) => externalId.source === sourceId)
  return knownId ? createResolvedTarget(knownId.id, lookup.name) : null
}

function createResolvedTarget(id: string, resolveName: string): IdResolvedTarget {
  return {
    id,
    cacheKey: `${sourceId}:${id}`,
    resolveName,
    identity: createIdentity(id)
  }
}

function createIdentity(id: string): ScrapedEntityIdentity {
  return {
    externalIds: [{ source: sourceId, id }]
  }
}

function createGameSession(target: IdResolvedTarget): GameScraperSession {
  return {
    async get(slots) {
      return {
        identity: target.identity ?? createIdentity(target.id),
        slots: createSlotResults(slots, target)
      }
    }
  }
}

function createSlotResults(
  slots: readonly GameScraperSlot[],
  target: IdResolvedTarget
): Partial<GameSessionResultMap> {
  const results: Partial<GameSessionResultMap> = {}

  if (slots.includes('info')) {
    results.info = {
      name: target.resolveName ?? target.id,
      ...(target.resolveName === undefined ? {} : { originalName: target.resolveName })
    }
  }

  if (slots.includes('tags')) {
    results.tags = [{ name: 'sample' }]
  }

  return results
}
