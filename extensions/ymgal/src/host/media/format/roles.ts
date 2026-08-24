import type {
  LibraryGameCharacterRole,
  LibraryGamePersonRole,
  LibraryGender
} from '@kisaki3/extension-sdk'
import type { YmgalStaff } from '../../api/types'
import { trimToUndefined } from './text'

/**
 * Maps YMGal's free-text staff job names onto the library's person roles.
 *
 * The archive job name is whatever the contributing editor typed, in Chinese,
 * Japanese, or English, so matching is keyword-based over a normalized form.
 * Unrecognized jobs stay `other`: the credit is still real, only its category
 * is unknown, and the raw job name travels with the fact as its note.
 */
export function mapStaffRole(staff: YmgalStaff): LibraryGamePersonRole {
  const raw = (readJobName(staff) ?? '').toLowerCase()
  if (!raw) {
    return 'other'
  }

  const compact = raw.replace(/[\s_-]+/g, '')
  const matches = (...needles: readonly string[]): boolean =>
    needles.some((needle) => raw.includes(needle) || compact.includes(needle))

  if (matches('声优', '聲優', '配音', '声の出演', 'cv', 'voice', 'voiceactor', 'cast')) {
    return 'actor'
  }

  if (matches('音乐', '音樂', '作曲', '作词', '作詞', '主题歌', 'music', 'composer', 'song')) {
    return 'music'
  }

  if (matches('脚本', '剧本', '劇本', 'シナリオ', 'scenario', 'writer', 'script')) {
    return 'scenario'
  }

  if (
    matches(
      '原画',
      '原畫',
      '立绘',
      '立繪',
      '美术',
      '美術',
      '人设',
      '人設',
      '角色设计',
      'illustrat',
      'art',
      'characterdesign'
    )
  ) {
    return 'illustration'
  }

  if (matches('程序', '程式', '引擎', 'program', 'engineer')) {
    return 'programmer'
  }

  if (
    matches(
      '导演',
      '導演',
      '监督',
      '監督',
      '制作人',
      '製作人',
      '策划',
      '策劃',
      'director',
      'producer'
    )
  ) {
    return 'director'
  }

  return 'other'
}

/** The staff entry's own job name, falling back to its employment label. */
export function readJobName(staff: YmgalStaff): string | undefined {
  return (
    trimToUndefined(staff.jobName) ??
    trimToUndefined(staff.job_name) ??
    trimToUndefined(staff.empName) ??
    trimToUndefined(staff.emp_name)
  )
}

/** What the source says about this credit beyond its role. */
export function readStaffNote(staff: YmgalStaff): string | undefined {
  return trimToUndefined(staff.empDesc) ?? trimToUndefined(staff.desc)
}

/** YMGal marks the lead cast with position 1 and named support with 2. */
export function mapCharacterRole(position: number | null | undefined): LibraryGameCharacterRole {
  if (position === 1) {
    return 'main'
  }
  if (position === 2) {
    return 'supporting'
  }
  return 'other'
}

export function mapGender(value: number | string | null | undefined): LibraryGender | undefined {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^\d+$/.test(value.trim())
        ? Number.parseInt(value.trim(), 10)
        : null

  switch (numeric) {
    case 1:
      return 'male'
    case 2:
      return 'female'
    case 3:
      return 'other'
    default:
      return undefined
  }
}
