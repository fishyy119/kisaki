const DEFAULT_SUBJECT_PLACEHOLDER_URL = 'https://lain.bgm.tv/img/no_icon_subject.png'
const URL_REGEX = /https?:\/\/[^\s<>"'()]+/gi

export type ExternalSite = { label: string; url: string }

export function buildBangumiSubjectUrl(subjectId: number): string {
  return `https://bgm.tv/subject/${subjectId}`
}

export function buildBangumiPersonUrl(personId: number): string {
  return `https://bgm.tv/person/${personId}`
}

export function buildBangumiCharacterUrl(characterId: number): string {
  return `https://bgm.tv/character/${characterId}`
}

export function dedupeUrls(urls: Array<string | undefined | null>): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const raw of urls) {
    const normalized = normalizeUrl(raw)
    if (!normalized || isPlaceholderImage(normalized)) continue
    if (seen.has(normalized)) continue
    seen.add(normalized)
    result.push(normalized)
  }

  return result
}

export function dedupeExternalSites(sites: ExternalSite[]): ExternalSite[] {
  const map = new Map<string, ExternalSite>()

  for (const site of sites) {
    const url = normalizeUrl(site.url)
    if (!url) continue
    if (!map.has(url)) {
      map.set(url, {
        label: site.label?.trim() || 'Website',
        url
      })
    }
  }

  return Array.from(map.values())
}

export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX)
  if (!matches) return []
  return matches.map((url) => normalizeUrl(url)).filter((url): url is string => !!url)
}

export function normalizeExternalSiteLabel(raw: string | undefined | null): string | undefined {
  const label = raw?.trim()
  if (!label) return undefined

  if (label.toLowerCase() === 'website') {
    return 'Official Website'
  }

  if (label.toLowerCase() === 'blog') {
    return 'Blog'
  }

  return label
}

function isPlaceholderImage(url: string): boolean {
  return url.includes(DEFAULT_SUBJECT_PLACEHOLDER_URL)
}

function normalizeUrl(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined
  let value = raw.trim()
  if (!value) return undefined

  value = value.replace(/[),.;]+$/g, '')

  if (!/^https?:\/\//i.test(value)) {
    return undefined
  }

  try {
    return new URL(value).toString()
  } catch {
    return undefined
  }
}
