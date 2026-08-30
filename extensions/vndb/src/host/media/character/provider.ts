import type {
  CharacterScraperProvider,
  CharacterScraperSession,
  CharacterSearchResult,
  IdResolvedTarget,
  ScraperLookup,
  ScraperProviderContext
} from '@kisaki3/extension-sdk'
import { parseVndbEntryId } from '../../identity/entry-id'
import { findKnownVndbId } from '../../identity/lookup'
import { toResolvedTarget } from '../../identity/target'
import { m } from '../../i18n'
import { VNDB_SEARCH_RESULT_LIMIT, VNDB_SOURCE_ID } from '../../utils/constants'
import { VndbExtensionError } from '../../utils/errors'
import { buildCharacterFacts } from '../satellites'
import { CHARACTER_FIELDS, CHARACTER_SEARCH_FIELDS, TRAIT_FIELDS } from '../fields'
import { parseVndbBirthday } from '../format/dates'
import { resolveEntityDisplayName } from '../format/names'
import { createRequestContext, type VndbRuntime } from '../runtime'
import { createSatelliteSession } from '../satellite-session'

export class VndbCharacterProvider implements CharacterScraperProvider {
  public readonly id = VNDB_SOURCE_ID
  public readonly name = 'VNDB'
  public readonly externalIdSource = VNDB_SOURCE_ID
  public readonly capabilities = ['search', 'info', 'tags', 'photos'] as const

  constructor(private readonly runtime: VndbRuntime) {}

  async search(query: string, ctx: ScraperProviderContext): Promise<CharacterSearchResult[]> {
    const request = await createRequestContext(this.runtime, ctx.locale, ctx.signal)
    const rows = await this.runtime.client.searchCharacters(
      query,
      CHARACTER_SEARCH_FIELDS,
      VNDB_SEARCH_RESULT_LIMIT,
      { signal: ctx.signal }
    )

    return rows.map((character) => {
      const { name, originalName } = resolveEntityDisplayName(
        character.name,
        character.original,
        request,
        character.id
      )
      return {
        id: character.id,
        name,
        originalName,
        birthDate: parseVndbBirthday(character.birthday),
        externalIds: [{ source: VNDB_SOURCE_ID, id: character.id }]
      }
    })
  }

  async resolve(
    lookup: ScraperLookup,
    ctx: ScraperProviderContext
  ): Promise<IdResolvedTarget | null> {
    const known = findKnownVndbId(lookup, 'c')
    if (known) {
      return toResolvedTarget(known, lookup.name)
    }

    const first = (await this.search(lookup.name, ctx))[0]
    return first
      ? toResolvedTarget(first.id, first.originalName ?? first.name, first.externalIds)
      : null
  }

  async openSession(
    target: IdResolvedTarget,
    ctx: ScraperProviderContext
  ): Promise<CharacterScraperSession> {
    const characterId = parseVndbEntryId(target.id, 'c')
    if (!characterId) {
      throw new VndbExtensionError('entry_id_invalid', m().errors.idInvalid({ value: target.id }))
    }

    const request = await createRequestContext(this.runtime, ctx.locale, ctx.signal)
    const client = this.runtime.client

    return createSatelliteSession({
      imageSlot: 'photos',
      loadFacts: async () => {
        const character = await client.getCharacterById(characterId, CHARACTER_FIELDS, {
          signal: ctx.signal
        })
        if (!character) {
          throw new VndbExtensionError('vndb_not_found', m().errors.notFound)
        }

        const traitIds = (character.traits ?? []).map((trait) => trait.id)
        const traits = await client.getTraitsByIds(traitIds, TRAIT_FIELDS, { signal: ctx.signal })
        return buildCharacterFacts(
          character,
          new Map(traits.map((trait) => [trait.id, trait])),
          request
        )
      }
    })
  }
}
