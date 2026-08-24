import type {
  CharacterScraperProvider,
  CharacterScraperSession,
  IdResolvedTarget,
  ScraperLookup,
  ScraperProviderContext
} from '@kisaki3/extension-sdk'
import { parseYmgalArchiveId } from '../../identity/archive-id'
import { findKnownYmgalId } from '../../identity/lookup'
import { toResolvedTarget } from '../../identity/target'
import { m } from '../../i18n'
import { YMGAL_SOURCE_ID } from '../../utils/constants'
import { YmgalExtensionError } from '../../utils/errors'
import { buildCharacterFacts } from '../satellites'
import { createRequestContext, type YmgalRuntime } from '../runtime'
import { createSatelliteSession } from '../satellite-session'

/**
 * Enriches a character the library already identifies on YMGal.
 *
 * The public API searches games only, so this provider declares no `search`
 * capability and answers exclusively for entities carrying a YMGal id — which
 * is how they arrive, since a game scrape writes the id of every character it
 * lists. The `persons` slot stays unanswered: a character archive states no
 * cast of its own, and the voice credit is the game archive's fact.
 */
export class YmgalCharacterProvider implements CharacterScraperProvider {
  public readonly id = YMGAL_SOURCE_ID
  public readonly name = 'YMGal'
  public readonly externalIdSource = YMGAL_SOURCE_ID
  public readonly capabilities = ['info', 'photos'] as const

  constructor(private readonly runtime: YmgalRuntime) {}

  async resolve(lookup: ScraperLookup): Promise<IdResolvedTarget | null> {
    const known = findKnownYmgalId(lookup)
    return known ? toResolvedTarget(known, lookup.name) : null
  }

  async openSession(
    target: IdResolvedTarget,
    ctx: ScraperProviderContext
  ): Promise<CharacterScraperSession> {
    const characterId = parseYmgalArchiveId(target.id)
    if (!characterId) {
      throw new YmgalExtensionError(
        'archive_id_invalid',
        m().errors.idInvalid({ value: target.id })
      )
    }

    const request = await createRequestContext(this.runtime, ctx.locale, ctx.signal)
    return createSatelliteSession({
      imageSlot: 'photos',
      loadFacts: async () =>
        buildCharacterFacts(
          characterId,
          await this.runtime.client.getCharacterArchive(characterId, { signal: ctx.signal }),
          undefined,
          request
        )
    })
  }
}
