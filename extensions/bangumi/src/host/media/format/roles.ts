import type {
  LibraryAnimeCharacterRole,
  LibraryAnimeCompanyRole,
  LibraryAnimePersonRole,
  LibraryBloodType,
  LibraryComicCharacterRole,
  LibraryComicCompanyRole,
  LibraryComicPersonRole,
  LibraryGameCharacterRole,
  LibraryGameCompanyRole,
  LibraryGamePersonRole,
  LibraryNovelCharacterRole,
  LibraryNovelCompanyRole,
  LibraryNovelPersonRole,
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
export type BangumiCharacterRole = LibraryGameCharacterRole &
  LibraryAnimeCharacterRole &
  LibraryComicCharacterRole &
  LibraryNovelCharacterRole

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
 * Bangumi credits staff with a curated position vocabulary, so known positions
 * resolve through an exact table and only wiki variants reach the ordered
 * substring fallback. Two ordering traps drive that design: song credits such
 * as 主题歌演出 belong to music and must resolve before the staff sense of
 * 演出, and every specific X监督 position must resolve before the bare 监督
 * director check. Bangumi lists cast on the characters rather than here, so the
 * voice positions only catch wiki entries that credit a voice as staff.
 */
const BANGUMI_ANIME_POSITION_ROLES: Record<string, LibraryAnimePersonRole> = {
  原作: 'originalCreator',
  原案: 'originalCreator',
  导演: 'director',
  总导演: 'director',
  副导演: 'director',
  系列监督: 'director',
  总监督: 'director',
  监修: 'director',
  系列构成: 'seriesComposition',
  脚本: 'scenario',
  剧本: 'scenario',
  编剧: 'scenario',
  分镜: 'episodeDirector',
  演出: 'episodeDirector',
  主演出: 'episodeDirector',
  演出助理: 'episodeDirector',
  oped分镜: 'episodeDirector',
  oped演出: 'episodeDirector',
  人物设定: 'characterDesign',
  角色设计: 'characterDesign',
  角色原案: 'characterDesign',
  人设: 'characterDesign',
  总作画监督: 'animationDirector',
  作画监督: 'animationDirector',
  动作作画监督: 'animationDirector',
  机械作画监督: 'animationDirector',
  作监协力: 'animationDirector',
  原画: 'animation',
  第二原画: 'animation',
  动画检查: 'animation',
  作画: 'animation',
  构图: 'animation',
  美术监督: 'art',
  美术设计: 'art',
  背景美术: 'art',
  美术: 'art',
  背景: 'art',
  色彩设计: 'art',
  色彩指定: 'art',
  色指定: 'art',
  摄影监督: 'photography',
  摄影: 'photography',
  '3dcg': 'photography',
  cg导演: 'photography',
  cg指导: 'photography',
  数码绘图: 'photography',
  特效: 'photography',
  特技监督: 'photography',
  音响监督: 'sound',
  音响: 'sound',
  音响制作: 'sound',
  音效: 'sound',
  录音: 'sound',
  录音助理: 'sound',
  配音监督: 'sound',
  声优: 'actor',
  配音: 'actor',
  cv: 'actor',
  音乐: 'music',
  音乐制作: 'music',
  音乐制作人: 'music',
  音乐监督: 'music',
  主题歌编曲: 'music',
  主题歌作曲: 'music',
  主题歌作词: 'music',
  主题歌演出: 'music',
  插入歌演出: 'music',
  制作人: 'producer',
  制片人: 'producer',
  总制片人: 'producer',
  联合制片人: 'producer',
  助理制片人: 'producer',
  执行制片人: 'producer',
  企画: 'producer',
  企划: 'producer',
  企划制作人: 'producer',
  executiveproducer: 'producer',
  制作: 'producer',
  製作: 'producer',
  制作总指挥: 'producer'
}

/** Ordered so song/music terms win over 演出 and X监督 terms win over 监督. */
const BANGUMI_ANIME_POSITION_FALLBACKS: readonly (readonly [
  LibraryAnimePersonRole,
  readonly string[]
])[] = [
  [
    'music',
    [
      '主题歌',
      '插入歌',
      '作曲',
      '作词',
      '编曲',
      '演唱',
      '歌',
      '音乐',
      '音樂',
      'vocal',
      'song',
      'composer',
      'music'
    ]
  ],
  ['sound', ['音响', '音響', '音效', '录音', '錄音', '配音', 'sound']],
  ['photography', ['摄影', '攝影', '撮影', '特效', '特技', 'cg', 'photograph']],
  ['art', ['美术', '美術', '背景', '色彩', '色指定', 'background']],
  ['animationDirector', ['作画监督', '作畫監督', '作画監督', '作监', '作監', 'animationdirector']],
  [
    'characterDesign',
    ['人物设定', '人物設定', '角色设计', '角色設計', '人设', 'chardesign', 'characterdesign']
  ],
  ['animation', ['原画', '原畫', '作画', '作畫', 'keyanimation']],
  ['episodeDirector', ['分镜', '分鏡', '絵コンテ', 'storyboard', 'episodedirector', '演出']],
  ['seriesComposition', ['系列构成', '系列構成', 'seriescomposition']],
  ['scenario', ['脚本', '剧本', '劇本', '编剧', '編劇', 'scenario', 'script', 'writer']],
  ['originalCreator', ['原作', '原案', 'originalwork']],
  ['producer', ['制作人', '製作人', '制片', '製片', '企画', '企划', '企劃', 'producer']],
  ['director', ['导演', '導演', '監督', '监督', 'director']]
]

export function mapBangumiAnimePersonRole(
  relation?: string,
  careers: BangumiPersonCareer[] = []
): LibraryAnimePersonRole {
  const normalized = normalizeToken(relation)
  if (!normalized) return mapAnimeCareersFallback(careers)

  const exact = BANGUMI_ANIME_POSITION_ROLES[normalized]
  if (exact) return exact

  for (const [role, tokens] of BANGUMI_ANIME_POSITION_FALLBACKS) {
    if (tokens.some((token) => normalized.includes(token))) return role
  }

  return mapAnimeCareersFallback(careers)
}

function mapAnimeCareersFallback(careers: BangumiPersonCareer[]): LibraryAnimePersonRole {
  const normalizedCareers = new Set(careers.map((career) => normalizeToken(career)))

  if (normalizedCareers.has('seiyu') || normalizedCareers.has('actor')) return 'actor'
  if (normalizedCareers.has('writer')) return 'scenario'
  if (normalizedCareers.has('mangaka')) return 'originalCreator'
  if (normalizedCareers.has('producer')) return 'producer'
  if (normalizedCareers.has('artist')) return 'music'

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

/**
 * Comic staff credits.
 *
 * Bangumi credits book staff with wiki wording: 作者 covers the combined
 * writer-artist credit, while split credits arrive as 原作 (story) plus
 * 作画/插图 (art).
 */
export function mapBangumiComicPersonRole(
  relation?: string,
  careers: BangumiPersonCareer[] = []
): LibraryComicPersonRole {
  const normalized = normalizeToken(relation)

  if (
    normalized.includes('作画') ||
    normalized.includes('作畫') ||
    normalized.includes('插图') ||
    normalized.includes('插圖') ||
    normalized.includes('插画') ||
    normalized.includes('插畫') ||
    normalized.includes('illustrat') ||
    normalized.includes('art')
  ) {
    return 'art'
  }

  if (normalized.includes('原作') || normalized.includes('原案')) {
    return 'originalCreator'
  }

  if (
    normalized.includes('作者') ||
    normalized.includes('著者') ||
    normalized.includes('author') ||
    normalized.includes('脚本') ||
    normalized.includes('剧本') ||
    normalized.includes('劇本')
  ) {
    return 'author'
  }

  const normalizedCareers = new Set(careers.map((career) => normalizeToken(career)))
  if (normalizedCareers.has('mangaka')) return 'author'
  if (normalizedCareers.has('illustrator')) return 'art'
  if (normalizedCareers.has('writer')) return 'author'

  return 'other'
}

/** Novel staff credits: author first, then illustration, then provenance. */
export function mapBangumiNovelPersonRole(
  relation?: string,
  careers: BangumiPersonCareer[] = []
): LibraryNovelPersonRole {
  const normalized = normalizeToken(relation)

  if (
    normalized.includes('插图') ||
    normalized.includes('插圖') ||
    normalized.includes('插画') ||
    normalized.includes('插畫') ||
    normalized.includes('作画') ||
    normalized.includes('作畫') ||
    normalized.includes('illustrat')
  ) {
    return 'illustrator'
  }

  if (normalized.includes('原作') || normalized.includes('原案')) {
    return 'originalCreator'
  }

  if (
    normalized.includes('作者') ||
    normalized.includes('著者') ||
    normalized.includes('author') ||
    normalized.includes('脚本') ||
    normalized.includes('剧本') ||
    normalized.includes('劇本')
  ) {
    return 'author'
  }

  const normalizedCareers = new Set(careers.map((career) => normalizeToken(career)))
  if (normalizedCareers.has('writer')) return 'author'
  if (normalizedCareers.has('illustrator')) return 'illustrator'
  if (normalizedCareers.has('mangaka')) return 'author'

  return 'other'
}

/** Book company credits share one publisher/imprint vocabulary across comics and novels. */
function mapBangumiBookCompanyRole(relation?: string): 'publisher' | 'imprint' | 'other' {
  const normalized = normalizeToken(relation)
  if (!normalized) return 'other'

  if (
    normalized.includes('文库') ||
    normalized.includes('文庫') ||
    normalized.includes('连载杂志') ||
    normalized.includes('連載雜誌') ||
    normalized.includes('杂志') ||
    normalized.includes('雜誌') ||
    normalized.includes('レーベル') ||
    normalized.includes('imprint') ||
    normalized.includes('label')
  ) {
    return 'imprint'
  }

  if (
    normalized.includes('出版') ||
    normalized.includes('发行') ||
    normalized.includes('發行') ||
    normalized.includes('publisher')
  ) {
    return 'publisher'
  }

  return 'other'
}

export function mapBangumiComicCompanyRole(relation?: string): LibraryComicCompanyRole {
  return mapBangumiBookCompanyRole(relation)
}

export function mapBangumiNovelCompanyRole(relation?: string): LibraryNovelCompanyRole {
  return mapBangumiBookCompanyRole(relation)
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
