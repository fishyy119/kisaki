import type {
  ContentLocale,
  ExternalId,
  ExternalSite,
  LibraryComicFormat,
  LibraryMediaRelationType,
  PartialDate,
  ScrapedPersonInfo,
  ScrapedPersonMetadata
} from '@kisaki3/extension-sdk'
import type { MdAuthor, MdManga, MdMangaAttributes, MdRelationship } from '../../api/types'
import {
  ANILIST_SOURCE_ID,
  MAL_SOURCE_ID,
  MANGADEX_SITE_URL,
  MANGADEX_SOURCE_ID
} from '../../utils/constants'
import { selectDescription } from './titles'

export function toMangadexExternalId(id: string): ExternalId {
  return { source: MANGADEX_SOURCE_ID, id }
}

/**
 * Identity of a manga entry: its own id plus the MAL and AniList ids the
 * `links` block states, handed over so those providers resolve by id.
 */
export function buildMangaExternalIds(manga: MdManga): ExternalId[] {
  const ids: ExternalId[] = [toMangadexExternalId(manga.id)]
  const links = manga.attributes?.links ?? {}

  const mal = links.mal?.trim()
  if (mal && /^\d+$/.test(mal)) {
    ids.push({ source: MAL_SOURCE_ID, id: mal })
  }

  const anilist = links.al?.trim()
  if (anilist && /^\d+$/.test(anilist)) {
    ids.push({ source: ANILIST_SOURCE_ID, id: anilist })
  }

  return ids
}

export function mangadexTitleSite(mangaId: string): ExternalSite {
  return { label: 'MangaDex', url: `${MANGADEX_SITE_URL}/title/${mangaId}` }
}

/** Absolute link values from the `links` block; site-relative codes are skipped. */
export function buildExternalSites(manga: MdManga): ExternalSite[] {
  const sites: ExternalSite[] = [mangadexTitleSite(manga.id)]
  const links = manga.attributes?.links ?? {}
  const seen = new Set(sites.map((site) => site.url))

  for (const [code, value] of Object.entries(links)) {
    const url = value?.trim()
    if (!url || !/^https?:\/\//i.test(url) || seen.has(url)) {
      continue
    }
    seen.add(url)
    sites.push({ label: LINK_LABELS[code] ?? url, url })
  }

  return sites
}

const LINK_LABELS: Record<string, string> = {
  raw: 'Official (raw)',
  engtl: 'Official (English)',
  amz: 'Amazon',
  ebj: 'eBookJapan',
  cdj: 'CDJapan'
}

/** Publication year is the only date MangaDex states. */
export function buildReleaseDate(
  attributes: MdMangaAttributes | null | undefined
): PartialDate | undefined {
  const year = attributes?.year
  return typeof year === 'number' && Number.isInteger(year) && year > 0 ? { year } : undefined
}

/**
 * Format from the origin country, refined by MangaDex's own format tags
 * (doujinshi and long-strip webtoons are stated as tags, not fields).
 */
export function buildComicFormat(
  attributes: MdMangaAttributes | null | undefined
): LibraryComicFormat {
  const tagNames = new Set(
    (attributes?.tags ?? [])
      .map((tag) => tag.attributes?.name?.en?.trim().toLowerCase())
      .filter((name) => name !== undefined)
  )

  if (tagNames.has('doujinshi')) {
    return 'doujinshi'
  }
  if (tagNames.has('long strip') || tagNames.has('web comic')) {
    return 'webtoon'
  }

  switch (attributes?.originalLanguage?.trim().toLowerCase()) {
    case 'ko':
      return 'manhwa'
    case 'zh':
    case 'zh-hk':
      return 'manhua'
    case 'ja':
      return 'manga'
    default:
      return 'other'
  }
}

export interface MangadexRelationMapping {
  type: LibraryMediaRelationType
  /** Stable machine-readable qualifier carrying the publication form the kind folds. */
  note?: string
}

/**
 * MangaDex `related` values read from the scraped title towards the related
 * one. Publication forms of one work (coloured and monochrome editions, the
 * pre-serialization web run and its serialization) fold onto
 * `alternativeVersion`; a doujinshi is an unofficial spin-off. `same_franchise`
 * and `shared_universe` are n-ary group facts, so they map to nothing rather
 * than to `other`.
 */
export function mapRelationType(
  value: string | null | undefined
): MangadexRelationMapping | undefined {
  switch (value) {
    case 'sequel':
      return { type: 'sequel' }
    case 'prequel':
      return { type: 'prequel' }
    case 'side_story':
      return { type: 'sideStory' }
    case 'main_story':
      return { type: 'mainStory' }
    case 'spin_off':
      return { type: 'spinOff' }
    case 'doujinshi':
      return { type: 'spinOff', note: 'Doujinshi' }
    case 'based_on':
    case 'adapted_from':
      return { type: 'sourceMaterial' }
    case 'alternate_story':
    case 'alternate_version':
      return { type: 'alternativeVersion' }
    case 'colored':
      return { type: 'alternativeVersion', note: 'Colored' }
    case 'monochrome':
      return { type: 'alternativeVersion', note: 'Monochrome' }
    case 'preserialization':
      return { type: 'alternativeVersion', note: 'Pre-serialization' }
    case 'serialization':
      return { type: 'alternativeVersion', note: 'Serialization' }
    default:
      return undefined
  }
}

/** Author or artist relationship (with included attributes) to a person fact. */
export function toCreditedPerson(
  relationship: MdRelationship,
  locale: ContentLocale
): (ScrapedPersonMetadata & { name: string }) | undefined {
  const attributes = relationship.attributes as MdAuthor['attributes'] | null | undefined
  const name = attributes?.name?.trim()
  if (!name) {
    return undefined
  }

  const photos = attributes?.imageUrl?.trim()
  return {
    name,
    identity: { externalIds: [toMangadexExternalId(relationship.id)] },
    description: selectDescription(attributes?.biography, locale),
    photos: photos ? [photos] : undefined
  }
}

/** Standalone author entity to person info (for the person provider). */
export function toPersonInfo(
  author: MdAuthor,
  locale: ContentLocale
): ScrapedPersonInfo | undefined {
  const name = author.attributes?.name?.trim()
  if (!name) {
    return undefined
  }

  const sites: ExternalSite[] = []
  for (const [label, value] of [
    ['Twitter', author.attributes?.twitter],
    ['Pixiv', author.attributes?.pixiv],
    ['Website', author.attributes?.website]
  ] as const) {
    const url = value?.trim()
    if (url && /^https?:\/\//i.test(url)) {
      sites.push({ label, url })
    }
  }

  return {
    name,
    description: selectDescription(author.attributes?.biography, locale),
    externalSites: sites.length > 0 ? sites : undefined
  }
}
