import type {
  LibraryAnimeCharacterRole,
  LibraryAnimeCompanyRole,
  LibraryAnimePersonRole,
  LibraryBloodType,
  LibraryGameCharacterRole,
  LibraryGameCompanyRole,
  LibraryGamePersonRole,
  ScrapedTag
} from '@kisaki3/extension-sdk'
import type { BangumiBloodType, BangumiPersonCareer } from '../../api/types'
import { dedupeTags } from './dedupe'
import { normalizeToken } from './text'

export function mapBangumiGender(gender?: string | null): 'male' | 'female' | 'other' | undefined {
  const raw = (gender || '').trim().toLowerCase()
  const normalized = normalizeToken(gender)
  if (!normalized) return undefined

  if (
    normalized.includes('female') ||
    normalized.includes('woman') ||
    normalized.includes('girl') ||
    raw.includes('女')
  ) {
    return 'female'
  }

  if (
    normalized.includes('male') ||
    normalized.includes('man') ||
    normalized.includes('boy') ||
    raw.includes('男')
  ) {
    return 'male'
  }

  if (normalized.includes('unknown') || raw.includes('未知')) {
    return undefined
  }

  return 'other'
}

export function mapBangumiBloodType(
  bloodType?: BangumiBloodType | null
): LibraryBloodType | undefined {
  switch (bloodType) {
    case 1:
      return 'a'
    case 2:
      return 'b'
    case 3:
      return 'ab'
    case 4:
      return 'o'
    default:
      return undefined
  }
}

/**
 * Character roles are identical across media in the library contract; the
 * intersection breaks loudly here if that ever stops being true.
 */
export type BangumiCharacterRole = LibraryGameCharacterRole & LibraryAnimeCharacterRole

export function mapBangumiCharacterRole(relation?: string): BangumiCharacterRole {
  const normalized = normalizeToken(relation)
  if (!normalized) return 'other'

  if (
    normalized.includes('主角') ||
    normalized.includes('main') ||
    normalized.includes('protagonist')
  ) {
    return 'main'
  }

  if (
    normalized.includes('配角') ||
    normalized.includes('support') ||
    normalized.includes('side')
  ) {
    return 'supporting'
  }

  if (
    normalized.includes('客串') ||
    normalized.includes('闲角') ||
    normalized.includes('旁白') ||
    normalized.includes('cameo')
  ) {
    return 'cameo'
  }

  return 'other'
}

export function mapBangumiGamePersonRole(
  relation?: string,
  careers: BangumiPersonCareer[] = []
): LibraryGamePersonRole {
  const normalized = normalizeToken(relation)

  if (
    normalized.includes('音乐') ||
    normalized.includes('主题歌') ||
    normalized.includes('插入歌') ||
    normalized.includes('作曲') ||
    normalized.includes('作词') ||
    normalized.includes('音响') ||
    normalized.includes('vocal') ||
    normalized.includes('song') ||
    normalized.includes('composer')
  ) {
    return 'music'
  }

  if (
    normalized.includes('剧本') ||
    normalized.includes('脚本') ||
    normalized.includes('scenario') ||
    normalized.includes('writer') ||
    normalized.includes('原作') ||
    normalized.includes('系列构成')
  ) {
    return 'scenario'
  }

  if (
    normalized.includes('原画') ||
    normalized.includes('人物设定') ||
    normalized.includes('角色设定') ||
    normalized.includes('机械设定') ||
    normalized.includes('作画') ||
    normalized.includes('美术') ||
    normalized.includes('美工') ||
    normalized.includes('背景') ||
    normalized.includes('cg') ||
    normalized.includes('illustrat') ||
    normalized.includes('artist') ||
    normalized.includes('chardesign')
  ) {
    return 'illustration'
  }

  if (
    normalized.includes('程序') ||
    normalized.includes('程式') ||
    normalized.includes('program') ||
    normalized.includes('engine')
  ) {
    return 'programmer'
  }

  if (
    normalized.includes('导演') ||
    normalized.includes('監督') ||
    normalized.includes('监督') ||
    normalized.includes('总指挥') ||
    normalized.includes('總指揮') ||
    normalized.includes('director') ||
    normalized.includes('制作人') ||
    normalized.includes('制作总指挥') ||
    normalized.includes('监修')
  ) {
    return 'director'
  }

  if (
    normalized.includes('声优') ||
    normalized.includes('配音') ||
    normalized.includes('actor') ||
    careers.some((career) => {
      const normalizedCareer = normalizeToken(career)
      return normalizedCareer === 'seiyu' || normalizedCareer === 'actor'
    })
  ) {
    return 'actor'
  }

  if (
    careers.some((career) => {
      const normalizedCareer = normalizeToken(career)
      return normalizedCareer === 'writer'
    })
  ) {
    return 'scenario'
  }

  if (
    careers.some((career) => {
      const normalizedCareer = normalizeToken(career)
      return normalizedCareer === 'illustrator' || normalizedCareer === 'mangaka'
    })
  ) {
    return 'illustration'
  }

  if (
    careers.some((career) => {
      const normalizedCareer = normalizeToken(career)
      return normalizedCareer === 'artist'
    })
  ) {
    return 'music'
  }

  if (
    careers.some((career) => {
      const normalizedCareer = normalizeToken(career)
      return normalizedCareer === 'producer'
    })
  ) {
    return 'director'
  }

  return 'other'
}

export function mapBangumiGameCompanyRole(relation?: string): LibraryGameCompanyRole {
  const normalized = normalizeToken(relation)
  if (!normalized) return 'other'

  if (
    normalized.includes('开发') ||
    normalized.includes('開発') ||
    normalized.includes('developer') ||
    normalized.includes('制作会社') ||
    normalized.includes('动画制作')
  ) {
    return 'developer'
  }

  if (
    normalized.includes('发行') ||
    normalized.includes('發行') ||
    normalized.includes('publisher') ||
    normalized.includes('販売')
  ) {
    return 'publisher'
  }

  if (
    normalized.includes('协力') ||
    normalized.includes('協力') ||
    normalized.includes('distribution') ||
    normalized.includes('distribut') ||
    normalized.includes('代理')
  ) {
    return 'distributor'
  }

  return 'other'
}

/**
 * Anime staff credits.
 *
 * Voice actors are not anime staff: they reach the entry through the character
 * they play, so `actor`-looking relations fall through to `other` here.
 */
export function mapBangumiAnimePersonRole(
  relation?: string,
  careers: BangumiPersonCareer[] = []
): LibraryAnimePersonRole {
  const normalized = normalizeToken(relation)

  if (
    normalized.includes('系列构成') ||
    normalized.includes('系列構成') ||
    normalized.includes('seriescomposition')
  ) {
    return 'series'
  }

  if (
    normalized.includes('作画监督') ||
    normalized.includes('作画監督') ||
    normalized.includes('演出') ||
    normalized.includes('分镜') ||
    normalized.includes('分鏡') ||
    normalized.includes('storyboard') ||
    normalized.includes('animationdirector')
  ) {
    return 'animationDirector'
  }

  if (
    normalized.includes('人物设定') ||
    normalized.includes('人物設定') ||
    normalized.includes('角色设定') ||
    normalized.includes('总作画监督') ||
    normalized.includes('原案') ||
    normalized.includes('chardesign') ||
    normalized.includes('characterdesign')
  ) {
    return 'characterDesign'
  }

  if (
    normalized.includes('音乐') ||
    normalized.includes('音樂') ||
    normalized.includes('主题歌') ||
    normalized.includes('插入歌') ||
    normalized.includes('作曲') ||
    normalized.includes('作词') ||
    normalized.includes('音响') ||
    normalized.includes('vocal') ||
    normalized.includes('song') ||
    normalized.includes('composer')
  ) {
    return 'music'
  }

  if (
    normalized.includes('脚本') ||
    normalized.includes('剧本') ||
    normalized.includes('原作') ||
    normalized.includes('scenario') ||
    normalized.includes('script') ||
    normalized.includes('writer')
  ) {
    return 'scenario'
  }

  if (
    normalized.includes('导演') ||
    normalized.includes('監督') ||
    normalized.includes('监督') ||
    normalized.includes('director')
  ) {
    return 'director'
  }

  if (
    careers.some((career) => {
      const normalizedCareer = normalizeToken(career)
      return normalizedCareer === 'writer' || normalizedCareer === 'mangaka'
    })
  ) {
    return 'scenario'
  }

  return 'other'
}

export function mapBangumiAnimeCompanyRole(relation?: string): LibraryAnimeCompanyRole {
  const normalized = normalizeToken(relation)
  if (!normalized) return 'other'

  if (
    normalized.includes('动画制作') ||
    normalized.includes('動畫制作') ||
    normalized.includes('制作会社') ||
    normalized.includes('animationproduction') ||
    normalized.includes('studio')
  ) {
    return 'studio'
  }

  if (
    normalized.includes('制作') ||
    normalized.includes('製作') ||
    normalized.includes('企划') ||
    normalized.includes('企畫') ||
    normalized.includes('producer') ||
    normalized.includes('production')
  ) {
    return 'producer'
  }

  if (
    normalized.includes('发行') ||
    normalized.includes('發行') ||
    normalized.includes('放送') ||
    normalized.includes('代理') ||
    normalized.includes('distribut') ||
    normalized.includes('publisher')
  ) {
    return 'distributor'
  }

  return 'other'
}

export function mapBangumiCareersToTags(careers: BangumiPersonCareer[] = []): ScrapedTag[] {
  const labels: Record<string, string> = {
    producer: 'Producer',
    mangaka: 'Mangaka',
    artist: 'Artist',
    seiyu: 'Voice Actor',
    writer: 'Writer',
    illustrator: 'Illustrator',
    actor: 'Actor'
  }

  return dedupeTags(
    careers
      .map((career) => normalizeToken(career))
      .filter(Boolean)
      .map((career) => ({
        name: labels[career] ?? career,
        note: 'Career'
      }))
  )
}

export function composeBangumiRoleNote(relation?: string, eps?: string): string | undefined {
  const relationText = relation?.trim()
  const epsText = eps?.trim()

  if (!relationText && !epsText) {
    return undefined
  }

  if (relationText && epsText) {
    return `${relationText} | ${epsText}`
  }

  return relationText || epsText
}
