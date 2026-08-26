export const LIBRARY_GENDERS = ['male', 'female', 'other'] as const

export type LibraryGender = (typeof LIBRARY_GENDERS)[number]

export const LIBRARY_BLOOD_TYPES = ['a', 'b', 'ab', 'o'] as const

export type LibraryBloodType = (typeof LIBRARY_BLOOD_TYPES)[number]

export const LIBRARY_CUP_SIZES = [
  'aaa',
  'aa',
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j',
  'k'
] as const

export type LibraryCupSize = (typeof LIBRARY_CUP_SIZES)[number]

export const LIBRARY_GAME_PERSON_ROLES = [
  'director',
  'scenario',
  'illustration',
  'music',
  'programmer',
  'actor',
  'other'
] as const

export type LibraryGamePersonRole = (typeof LIBRARY_GAME_PERSON_ROLES)[number]

export const LIBRARY_GAME_CHARACTER_ROLES = ['main', 'supporting', 'cameo', 'other'] as const

export type LibraryGameCharacterRole = (typeof LIBRARY_GAME_CHARACTER_ROLES)[number]

export const LIBRARY_GAME_COMPANY_ROLES = [
  'developer',
  'publisher',
  'distributor',
  'other'
] as const

export type LibraryGameCompanyRole = (typeof LIBRARY_GAME_COMPANY_ROLES)[number]

export const LIBRARY_ANIME_FORMATS = ['tv', 'movie', 'ova', 'ona', 'special', 'other'] as const

export type LibraryAnimeFormat = (typeof LIBRARY_ANIME_FORMATS)[number]

export const LIBRARY_ANIME_EPISODE_TYPES = ['regular', 'special'] as const

export type LibraryAnimeEpisodeType = (typeof LIBRARY_ANIME_EPISODE_TYPES)[number]

export const LIBRARY_ANIME_PERSON_ROLES = [
  'originalCreator',
  'director',
  'seriesComposition',
  'scenario',
  'episodeDirector',
  'characterDesign',
  'animationDirector',
  'animation',
  'art',
  'photography',
  'sound',
  'music',
  'producer',
  'actor',
  'other'
] as const

export type LibraryAnimePersonRole = (typeof LIBRARY_ANIME_PERSON_ROLES)[number]

export const LIBRARY_ANIME_CHARACTER_ROLES = ['main', 'supporting', 'cameo', 'other'] as const

export type LibraryAnimeCharacterRole = (typeof LIBRARY_ANIME_CHARACTER_ROLES)[number]

export const LIBRARY_ANIME_COMPANY_ROLES = ['studio', 'producer', 'distributor', 'other'] as const

export type LibraryAnimeCompanyRole = (typeof LIBRARY_ANIME_COMPANY_ROLES)[number]

export const LIBRARY_COMIC_FORMATS = [
  'manga',
  'manhua',
  'manhwa',
  'webtoon',
  'doujinshi',
  'other'
] as const

export type LibraryComicFormat = (typeof LIBRARY_COMIC_FORMATS)[number]

export const LIBRARY_COMIC_PERSON_ROLES = ['author', 'originalCreator', 'art', 'other'] as const

export type LibraryComicPersonRole = (typeof LIBRARY_COMIC_PERSON_ROLES)[number]

export const LIBRARY_COMIC_CHARACTER_ROLES = ['main', 'supporting', 'cameo', 'other'] as const

export type LibraryComicCharacterRole = (typeof LIBRARY_COMIC_CHARACTER_ROLES)[number]

export const LIBRARY_COMIC_COMPANY_ROLES = ['publisher', 'imprint', 'other'] as const

export type LibraryComicCompanyRole = (typeof LIBRARY_COMIC_COMPANY_ROLES)[number]

export const LIBRARY_NOVEL_FORMATS = ['lightNovel', 'webNovel', 'general', 'other'] as const

export type LibraryNovelFormat = (typeof LIBRARY_NOVEL_FORMATS)[number]

export const LIBRARY_NOVEL_PERSON_ROLES = [
  'author',
  'illustrator',
  'originalCreator',
  'other'
] as const

export type LibraryNovelPersonRole = (typeof LIBRARY_NOVEL_PERSON_ROLES)[number]

export const LIBRARY_NOVEL_CHARACTER_ROLES = ['main', 'supporting', 'cameo', 'other'] as const

export type LibraryNovelCharacterRole = (typeof LIBRARY_NOVEL_CHARACTER_ROLES)[number]

export const LIBRARY_NOVEL_COMPANY_ROLES = ['publisher', 'imprint', 'other'] as const

export type LibraryNovelCompanyRole = (typeof LIBRARY_NOVEL_COMPANY_ROLES)[number]

export const LIBRARY_CHARACTER_PERSON_ROLES = [
  'actor',
  'illustration',
  'designer',
  'other'
] as const

export type LibraryCharacterPersonRole = (typeof LIBRARY_CHARACTER_PERSON_ROLES)[number]

export const LIBRARY_MEDIA_RELATION_TYPES = [
  'sequel',
  'prequel',
  'sideStory',
  'parentStory',
  'summary',
  'fullStory',
  'adaptation',
  'sourceMaterial',
  'mediaMix',
  'alternative',
  'other'
] as const

export type LibraryMediaRelationType = (typeof LIBRARY_MEDIA_RELATION_TYPES)[number]

export const LIBRARY_COMPANY_RELATION_TYPES = [
  'parent',
  'subsidiary',
  'brand',
  'brandOwner',
  'renamedTo',
  'renamedFrom',
  'spinOff',
  'spinOffOrigin',
  'other'
] as const

export type LibraryCompanyRelationType = (typeof LIBRARY_COMPANY_RELATION_TYPES)[number]
