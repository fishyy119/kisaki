import type {
  CompanyScraperProvider,
  CompanyScraperSession,
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
import { buildCompanyFacts } from '../satellites'
import { createRequestContext, type YmgalRuntime } from '../runtime'
import { createSatelliteSession } from '../satellite-session'

/**
 * Enriches a company the library already identifies on YMGal.
 *
 * The public API searches games only, so this provider declares no `search`
 * capability and answers exclusively for entities carrying a YMGal id — which
 * is how they arrive, since a game scrape writes the developer's id.
 */
export class YmgalCompanyProvider implements CompanyScraperProvider {
  public readonly id = YMGAL_SOURCE_ID
  public readonly name = 'YMGal'
  public readonly externalIdSource = YMGAL_SOURCE_ID
  public readonly capabilities = ['info', 'tags', 'logos'] as const

  constructor(private readonly runtime: YmgalRuntime) {}

  async resolve(lookup: ScraperLookup): Promise<IdResolvedTarget | null> {
    const known = findKnownYmgalId(lookup)
    return known ? toResolvedTarget(known, lookup.name) : null
  }

  async openSession(
    target: IdResolvedTarget,
    ctx: ScraperProviderContext
  ): Promise<CompanyScraperSession> {
    const organizationId = parseYmgalArchiveId(target.id)
    if (!organizationId) {
      throw new YmgalExtensionError(
        'archive_id_invalid',
        m().errors.idInvalid({ value: target.id })
      )
    }

    const request = await createRequestContext(this.runtime, ctx.locale, ctx.signal)
    return createSatelliteSession({
      imageSlot: 'logos',
      loadFacts: async () =>
        buildCompanyFacts(
          organizationId,
          await this.runtime.client.getOrganizationArchive(organizationId, { signal: ctx.signal }),
          request
        )
    })
  }
}
