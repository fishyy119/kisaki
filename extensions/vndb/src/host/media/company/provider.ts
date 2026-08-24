import type {
  CompanyScraperProvider,
  CompanyScraperSession,
  CompanySearchResult,
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
import { omitUndefined } from '../../utils/object'
import { buildProducerFacts } from '../satellites'
import { PRODUCER_FIELDS, PRODUCER_SEARCH_FIELDS } from '../fields'
import { buildEnumLabels } from '../format/enums'
import { resolveEntityDisplayName } from '../format/names'
import { createRequestContext, type VndbRuntime } from '../runtime'
import { createSatelliteSession } from '../satellite-session'

/** VNDB models companies as *producers*: developers, publishers, and circles. */
export class VndbCompanyProvider implements CompanyScraperProvider {
  public readonly id = VNDB_SOURCE_ID
  public readonly name = 'VNDB'
  public readonly externalIdSource = VNDB_SOURCE_ID
  public readonly capabilities = ['search', 'info', 'tags'] as const

  constructor(private readonly runtime: VndbRuntime) {}

  async search(query: string, ctx: ScraperProviderContext): Promise<CompanySearchResult[]> {
    const request = await createRequestContext(this.runtime, ctx.locale, ctx.signal)
    const rows = await this.runtime.client.searchProducers(
      query,
      PRODUCER_SEARCH_FIELDS,
      VNDB_SEARCH_RESULT_LIMIT,
      { signal: ctx.signal }
    )

    return rows.map((producer) => {
      const { name, originalName } = resolveEntityDisplayName(
        producer.name,
        producer.original,
        request,
        producer.id
      )
      return omitUndefined({
        id: producer.id,
        name,
        originalName,
        externalIds: [{ source: VNDB_SOURCE_ID, id: producer.id }]
      })
    })
  }

  async resolve(
    lookup: ScraperLookup,
    ctx: ScraperProviderContext
  ): Promise<IdResolvedTarget | null> {
    const known = findKnownVndbId(lookup, 'p')
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
  ): Promise<CompanyScraperSession> {
    const producerId = parseVndbEntryId(target.id, 'p')
    if (!producerId) {
      throw new VndbExtensionError('entry_id_invalid', m().errors.idInvalid({ value: target.id }))
    }

    const request = await createRequestContext(this.runtime, ctx.locale, ctx.signal)
    const client = this.runtime.client

    return createSatelliteSession({
      imageSlot: 'logos',
      loadFacts: async () => {
        const [producer, schema] = await Promise.all([
          client.getProducerById(producerId, PRODUCER_FIELDS, { signal: ctx.signal }),
          client.getSchema({ signal: ctx.signal })
        ])
        if (!producer) {
          throw new VndbExtensionError('vndb_not_found', m().errors.notFound)
        }

        return buildProducerFacts(
          producerId,
          producer,
          buildEnumLabels(schema.enums?.language),
          request
        )
      }
    })
  }
}
