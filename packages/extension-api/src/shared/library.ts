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

export const LIBRARY_CHARACTER_PERSON_ROLES = [
  'actor',
  'illustration',
  'designer',
  'other'
] as const

export type LibraryCharacterPersonRole = (typeof LIBRARY_CHARACTER_PERSON_ROLES)[number]
