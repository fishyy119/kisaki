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

/** Localized game status options for the current UI locale. */
export function getGameStatusOptions(): { value: string; label: string }[] {
  const status = messages.value.library.status
  return [
    { value: 'notStarted', label: status.notStarted },
    { value: 'inProgress', label: status.inProgress },
    { value: 'partial', label: status.partial },
    { value: 'completed', label: status.completed },
    { value: 'multiple', label: status.multiple },
    { value: 'shelved', label: status.shelved }
  ]
}
