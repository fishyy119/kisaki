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

/** Localized comic read status options for the current UI locale. */
export function getComicStatusOptions(): { value: string; label: string }[] {
  const status = messages.value.library.comicStatus
  return [
    { value: 'planned', label: status.planned },
    { value: 'reading', label: status.reading },
    { value: 'completed', label: status.completed },
    { value: 'onHold', label: status.onHold },
    { value: 'dropped', label: status.dropped }
  ]
}

/** Localized comic format options for the current UI locale. */
export function getComicFormatOptions(): { value: string; label: string }[] {
  const format = messages.value.library.comicFormat
  return [
    { value: 'manga', label: format.manga },
    { value: 'manhua', label: format.manhua },
    { value: 'manhwa', label: format.manhwa },
    { value: 'webtoon', label: format.webtoon },
    { value: 'doujinshi', label: format.doujinshi },
    { value: 'other', label: format.other }
  ]
}

/** Localized novel read status options for the current UI locale. */
export function getNovelStatusOptions(): { value: string; label: string }[] {
  const status = messages.value.library.novelStatus
  return [
    { value: 'planned', label: status.planned },
    { value: 'reading', label: status.reading },
    { value: 'completed', label: status.completed },
    { value: 'onHold', label: status.onHold },
    { value: 'dropped', label: status.dropped }
  ]
}

/** Localized novel format options for the current UI locale. */
export function getNovelFormatOptions(): { value: string; label: string }[] {
  const format = messages.value.library.novelFormat
  return [
    { value: 'lightNovel', label: format.lightNovel },
    { value: 'webNovel', label: format.webNovel },
    { value: 'general', label: format.general },
    { value: 'other', label: format.other }
  ]
}
