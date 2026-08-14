import type {
  CompanyScraperSession,
  CompanyScraperSlot,
  CompanySessionResultMap,
  ScrapedCompanyInfo
} from '@kisaki3/extension-sdk'
import type { TmdbClient } from '../../api/client'
import { TMDB_SOURCE_ID } from '../../utils/constants'
import { omitUndefined } from '../../utils/object'
import { buildCountryTags } from '../format/companies'
import { buildImageUrl, dedupeUrls, selectLogoUrls } from '../format/images'
import { buildExternalSites, homepageSite, tmdbCompanyUrl, tmdbSite } from '../format/sites'
import { trimToUndefined } from '../format/text'
import { createCompanyLoaders, type TmdbCompanyLoaders, type TmdbRequestContext } from '../loaders'
import { toImageContext } from '../runtime'

export function createTmdbCompanySession(
  client: TmdbClient,
  companyId: number,
  ctx: TmdbRequestContext
): CompanyScraperSession {
  const loaders = createCompanyLoaders(client, companyId, ctx)
  const tasks = new Map<CompanyScraperSlot, Promise<unknown>>()

  return {
    get: async (slots) => {
      const output: Partial<CompanySessionResultMap> = {}

      await Promise.all(
        slots.map(async (slot) => {
          if (!tasks.has(slot)) {
            tasks.set(slot, loadSlot(slot, loaders, ctx))
          }

          const payload = await tasks.get(slot)!
          if (payload !== undefined) {
            ;(output as Record<CompanyScraperSlot, unknown>)[slot] = payload
          }
        })
      )

      return {
        identity: { externalIds: [{ source: TMDB_SOURCE_ID, id: String(companyId) }] },
        slots: output
      }
    }
  }
}

function loadSlot(
  slot: CompanyScraperSlot,
  loaders: TmdbCompanyLoaders,
  ctx: TmdbRequestContext
): Promise<unknown> {
  switch (slot) {
    case 'info':
      return buildCompanyInfo(loaders)
    case 'tags':
      return loaders.getCompany().then((company) => buildCountryTags(company.origin_country))
    case 'logos':
      return buildCompanyLogos(loaders, ctx)
  }
}

async function buildCompanyInfo(loaders: TmdbCompanyLoaders): Promise<ScrapedCompanyInfo> {
  const company = await loaders.getCompany()

  return omitUndefined({
    // Not user-facing copy: guards a malformed row from entering the library
    // without a name.
    name: trimToUndefined(company.name) ?? `TMDB ${company.id}`,
    description: trimToUndefined(company.description),
    externalSites: buildExternalSites([
      tmdbSite(tmdbCompanyUrl(company.id)),
      homepageSite(company.homepage)
    ])
  })
}

async function buildCompanyLogos(
  loaders: TmdbCompanyLoaders,
  ctx: TmdbRequestContext
): Promise<string[]> {
  const [company, images] = await Promise.all([loaders.getCompany(), loaders.getImages()])

  return dedupeUrls([
    buildImageUrl(ctx.imageBaseUrl, company.logo_path),
    ...selectLogoUrls(images, toImageContext(ctx))
  ])
}
