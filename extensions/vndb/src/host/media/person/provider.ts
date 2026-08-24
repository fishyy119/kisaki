import type {
  IdResolvedTarget,
  PersonScraperProvider,
  PersonScraperSession,
  PersonSearchResult,
  ScraperLookup,
  ScraperProviderContext
} from '@kisaki3/extension-sdk'
import { parseVndbEntryId } from '../../identity/entry-id'
import { findKnownVndbId } from '../../identity/lookup'
import { toResolvedTarget } from '../../identity/target'
import { m } from '../../i18n'
import { VNDB_SEARCH_RESULT_LIMIT, VNDB_SOURCE_ID } from '../../utils/constants'
import { VndbExtensionError } from '../../utils/errors'
import { omitUndefined } from '../../utils/object'
import { buildStaffFacts } from '../satellites'
import { STAFF_FIELDS, STAFF_SEARCH_FIELDS } from '../fields'
import { resolveEntityDisplayName } from '../format/names'
import { createRequestContext, type VndbRuntime } from '../runtime'
import { createSatelliteSession } from '../satellite-session'

/** VNDB models people as *staff*: writers, artists, composers, and voice actors. */
export class VndbPersonProvider implements PersonScraperProvider {
  public readonly id = VNDB_SOURCE_ID
  public readonly name = 'VNDB'
  public readonly externalIdSource = VNDB_SOURCE_ID
  public readonly capabilities = ['search', 'info'] as const

  constructor(private readonly runtime: VndbRuntime) {}

  async search(query: string, ctx: ScraperProviderContext): Promise<PersonSearchResult[]> {
    const request = await createRequestContext(this.runtime, ctx.locale, ctx.signal)
    const rows = await this.runtime.client.searchStaff(
      query,
      STAFF_SEARCH_FIELDS,
      VNDB_SEARCH_RESULT_LIMIT,
      { signal: ctx.signal }
    )

    return rows.map((staff) => {
      const { name, originalName } = resolveEntityDisplayName(
        staff.name,
        staff.original,
        request,
        staff.id
      )
      return omitUndefined({
        id: staff.id,
        name,
        originalName,
        externalIds: [{ source: VNDB_SOURCE_ID, id: staff.id }]
      })
    })
  }

  async resolve(
    lookup: ScraperLookup,
    ctx: ScraperProviderContext
  ): Promise<IdResolvedTarget | null> {
    const known = findKnownVndbId(lookup, 's')
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
  ): Promise<PersonScraperSession> {
    const staffId = parseVndbEntryId(target.id, 's')
    if (!staffId) {
      throw new VndbExtensionError('entry_id_invalid', m().errors.idInvalid({ value: target.id }))
    }

    const request = await createRequestContext(this.runtime, ctx.locale, ctx.signal)
    const client = this.runtime.client

    return createSatelliteSession({
      imageSlot: 'photos',
      loadFacts: async () => {
        const staff = await client.getStaffById(staffId, STAFF_FIELDS, { signal: ctx.signal })
        if (!staff) {
          throw new VndbExtensionError('vndb_not_found', m().errors.notFound)
        }

        return buildStaffFacts(staffId, staff, request)
      }
    })
  }
}
