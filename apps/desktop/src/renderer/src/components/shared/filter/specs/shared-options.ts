import { messages } from '@renderer/core/i18n'

/** Blood type and cup size options are Latin letters; no localization needed. */
export const BLOOD_TYPE_OPTIONS = [
  { value: 'A', label: 'A' },
  { value: 'B', label: 'B' },
  { value: 'O', label: 'O' },
  { value: 'AB', label: 'AB' }
] as const

export const CUP_SIZE_OPTIONS = [
  { value: 'aaa', label: 'AAA' },
  { value: 'aa', label: 'AA' },
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
  { value: 'c', label: 'C' },
  { value: 'd', label: 'D' },
  { value: 'e', label: 'E' },
  { value: 'f', label: 'F' },
  { value: 'g', label: 'G' },
  { value: 'h', label: 'H' },
  { value: 'i', label: 'I' },
  { value: 'j', label: 'J' },
  { value: 'k', label: 'K' }
] as const

/** Localized gender options for the current UI locale. */
export function getGenderOptions(): { value: string; label: string }[] {
  const gender = messages.value.library.gender
  return [
    { value: 'male', label: gender.male },
    { value: 'female', label: gender.female },
    { value: 'other', label: gender.other }
  ]
}

/** Localized game completion status options for the current UI locale. */
export function getGameStatusOptions(): { value: string; label: string }[] {
  const status = messages.value.library.gameStatus
  return [
    { value: 'notStarted', label: status.notStarted },
    { value: 'inProgress', label: status.inProgress },
    { value: 'partial', label: status.partial },
    { value: 'completed', label: status.completed },
    { value: 'multiple', label: status.multiple },
    { value: 'shelved', label: status.shelved }
  ]
}

/** Localized anime watch status options for the current UI locale. */
export function getAnimeStatusOptions(): { value: string; label: string }[] {
  const status = messages.value.library.animeStatus
  return [
    { value: 'planned', label: status.planned },
    { value: 'watching', label: status.watching },
    { value: 'completed', label: status.completed },
    { value: 'onHold', label: status.onHold },
    { value: 'dropped', label: status.dropped }
  ]
}

/** Localized anime format options for the current UI locale. */
export function getAnimeFormatOptions(): { value: string; label: string }[] {
  const format = messages.value.library.animeFormat
  return [
    { value: 'tv', label: format.tv },
    { value: 'movie', label: format.movie },
    { value: 'ova', label: format.ova },
    { value: 'ona', label: format.ona },
    { value: 'special', label: format.special },
    { value: 'other', label: format.other }
  ]
}

/** Localized series watch status options for the current UI locale. */
export function getTvStatusOptions(): { value: string; label: string }[] {
  const status = messages.value.library.tvStatus
  return [
    { value: 'planned', label: status.planned },
    { value: 'watching', label: status.watching },
    { value: 'completed', label: status.completed },
    { value: 'onHold', label: status.onHold },
    { value: 'dropped', label: status.dropped }
  ]
}

/** Localized series format options for the current UI locale. */
export function getTvFormatOptions(): { value: string; label: string }[] {
  const format = messages.value.library.tvFormat
  return [
    { value: 'scripted', label: format.scripted },
    { value: 'miniseries', label: format.miniseries },
    { value: 'documentary', label: format.documentary },
    { value: 'reality', label: format.reality },
    { value: 'talkShow', label: format.talkShow },
    { value: 'variety', label: format.variety },
    { value: 'news', label: format.news },
    { value: 'other', label: format.other }
  ]
}

/** Localized movie watch status options for the current UI locale. */
export function getMovieStatusOptions(): { value: string; label: string }[] {
  const status = messages.value.library.movieStatus
  return [
    { value: 'planned', label: status.planned },
    { value: 'watching', label: status.watching },
    { value: 'completed', label: status.completed },
    { value: 'onHold', label: status.onHold },
    { value: 'dropped', label: status.dropped }
  ]
}

/** Localized movie format options for the current UI locale. */
export function getMovieFormatOptions(): { value: string; label: string }[] {
  const format = messages.value.library.movieFormat
  return [
    { value: 'theatrical', label: format.theatrical },
    { value: 'documentary', label: format.documentary },
    { value: 'short', label: format.short },
    { value: 'tvMovie', label: format.tvMovie },
    { value: 'other', label: format.other }
  ]
}
