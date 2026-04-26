import type { ValidationIssue } from './validation'

export const EXTENSION_IDENTIFIER_MAX_LENGTH = 128
const EXTENSION_IDENTIFIER_SEGMENT_PATTERN_SOURCE = '[a-z0-9](?:[a-z0-9-]*[a-z0-9])?'
const WINDOWS_RESERVED_SEGMENT_PATTERN_SOURCE = '(?:con|prn|aux|nul|com[1-9]|lpt[1-9])'
export const EXTENSION_IDENTIFIER_PATTERN_SOURCE = `(?=.{1,${EXTENSION_IDENTIFIER_MAX_LENGTH}}$)(?!.*(?:^|\\.)${WINDOWS_RESERVED_SEGMENT_PATTERN_SOURCE}(?:\\.|$))${EXTENSION_IDENTIFIER_SEGMENT_PATTERN_SOURCE}(?:\\.${EXTENSION_IDENTIFIER_SEGMENT_PATTERN_SOURCE})*`
export const EXTENSION_IDENTIFIER_PATTERN = new RegExp(`^${EXTENSION_IDENTIFIER_PATTERN_SOURCE}$`)

const WINDOWS_RESERVED_SEGMENTS = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  'com1',
  'com2',
  'com3',
  'com4',
  'com5',
  'com6',
  'com7',
  'com8',
  'com9',
  'lpt1',
  'lpt2',
  'lpt3',
  'lpt4',
  'lpt5',
  'lpt6',
  'lpt7',
  'lpt8',
  'lpt9'
])

export function isExtensionIdentifier(value: unknown): value is string {
  return validateExtensionIdentifier(value).length === 0
}

export function validateExtensionIdentifier(value: unknown, path = '$.id'): ValidationIssue[] {
  if (typeof value !== 'string') {
    return [{ path, message: 'Extension id must be a string.' }]
  }

  if (value.length === 0) {
    return [{ path, message: 'Extension id must be non-empty.' }]
  }

  if (value.length > EXTENSION_IDENTIFIER_MAX_LENGTH) {
    return [
      {
        path,
        message: `Extension id must be at most ${EXTENSION_IDENTIFIER_MAX_LENGTH} characters.`
      }
    ]
  }

  if (!EXTENSION_IDENTIFIER_PATTERN.test(value)) {
    return [
      {
        path,
        message:
          'Extension id must use lowercase alphanumeric segments separated by dots, with hyphens only inside segments.'
      }
    ]
  }

  for (const segment of value.split('.')) {
    if (WINDOWS_RESERVED_SEGMENTS.has(segment)) {
      return [
        {
          path,
          message: `Extension id segment "${segment}" is reserved.`
        }
      ]
    }
  }

  return []
}
