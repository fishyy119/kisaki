import type {
  GameScraperLookup,
  GameScraperProvider,
  GameScraperSession,
  GameSearchResult,
  IdResolvedTarget,
  ScraperProviderContext
} from '@kisaki3/extension-sdk'
import { parseVndbEntryId } from '../../identity/entry-id'
import { findKnownVndbId } from '../../identity/lookup'
import { toResolvedTarget } from '../../identity/target'
import { m } from '../../i18n'
import { VNDB_SEARCH_RESULT_LIMIT, VNDB_SOURCE_ID } from '../../utils/constants'
import { VndbExtensionError } from '../../utils/errors'
import { omitUndefined } from '../../utils/object'
import { VN_SEARCH_FIELDS } from '../fields'
import { parseVndbReleaseDate } from '../format/dates'
import { resolveVnDisplayName } from '../format/names'
import { createRequestContext, type VndbRuntime } from '../runtime'
import { createVndbGameSession } from './session'

export class VndbGameProvider implements GameScraperProvider {
  public readonly id = VNDB_SOURCE_ID
  public readonly name = 'VNDB'
  public readonly externalIdSource = VNDB_SOURCE_ID
  public readonly capabilities = [
    'search',
    'info',
    'tags',
    'characters',
    'persons',
    'companies',
    'relatedEntries',
    'covers',
    'backdrops'
  ] as const

  constructor(private readonly runtime: VndbRuntime) {}

  async search(query: string, ctx: ScraperProviderContext): Promise<GameSearchResult[]> {
    const request = await createRequestContext(this.runtime, ctx.locale, ctx.signal)
    const rows = await this.runtime.client.searchVns(
      query,
      VN_SEARCH_FIELDS,
      VNDB_SEARCH_RESULT_LIMIT,
      { signal: ctx.signal }
    )

    return rows.map((vn) => {
      const { name, originalName } = resolveVnDisplayName(vn, request, vn.id)
      return omitUndefined({
        id: vn.id,
        name,
        originalName,
        releaseDate: parseVndbReleaseDate(vn.released),
        externalIds: [{ source: VNDB_SOURCE_ID, id: vn.id }]
      })
    })
  }

  async resolve(
    lookup: GameScraperLookup,
    ctx: ScraperProviderContext
  ): Promise<IdResolvedTarget | null> {
    const known = findKnownVndbId(lookup, 'v')
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
  ): Promise<GameScraperSession> {
    const vnId = parseVndbEntryId(target.id, 'v')
    if (!vnId) {
      throw new VndbExtensionError('entry_id_invalid', m().errors.idInvalid({ value: target.id }))
    }

    return createVndbGameSession(
      this.runtime.client,
      vnId,
      await createRequestContext(this.runtime, ctx.locale, ctx.signal)
    )
  }
}
