import {
  LIBRARY_LINK_KINDS,
  type LibraryLinkCreateInput,
  type LibraryLinkKind,
  type LibraryLinkPatch,
  type LibraryLinkQuery,
  type LibraryLinkSelector
} from '../links'
import {
  LIBRARY_ANIME_CHARACTER_ROLES,
  LIBRARY_ANIME_COMPANY_ROLES,
  LIBRARY_ANIME_PERSON_ROLES,
  LIBRARY_CHARACTER_PERSON_ROLES,
  LIBRARY_COMIC_CHARACTER_ROLES,
  LIBRARY_COMIC_COMPANY_ROLES,
  LIBRARY_COMIC_PERSON_ROLES,
  LIBRARY_GAME_CHARACTER_ROLES,
  LIBRARY_GAME_COMPANY_ROLES,
  LIBRARY_GAME_PERSON_ROLES,
  LIBRARY_NOVEL_CHARACTER_ROLES,
  LIBRARY_NOVEL_COMPANY_ROLES,
  LIBRARY_NOVEL_PERSON_ROLES
} from '../../../shared/library'
import type { ValidationIssue } from '../../../shared/validation'
import {
  validateOptionalBoolean,
  validateOptionalEnumString,
  validateOptionalFiniteNumber,
  validateOptionalString,
  validateRequiredEnumString,
  validateUnknownKeys
} from '../../../shared/validation'
import { isRecord, throwIfValidationIssues, validateLibraryEntityReference } from './common'

const LINK_CREATE_KEYS = new Set<string>(['kind', 'from', 'to', 'metadata'])
const LINK_SELECTOR_KEYS = new Set<string>(['kind', 'from', 'to', 'role'])
const LINK_LIST_QUERY_KEYS = new Set<string>(['entity', 'relatedEntity', 'kinds'])

const LINK_ENDPOINTS = {
  'game-person': { from: 'game', to: 'person', roleValues: LIBRARY_GAME_PERSON_ROLES },
  'game-company': { from: 'game', to: 'company', roleValues: LIBRARY_GAME_COMPANY_ROLES },
  'game-character': { from: 'game', to: 'character', roleValues: LIBRARY_GAME_CHARACTER_ROLES },
  'anime-person': { from: 'anime', to: 'person', roleValues: LIBRARY_ANIME_PERSON_ROLES },
  'anime-company': { from: 'anime', to: 'company', roleValues: LIBRARY_ANIME_COMPANY_ROLES },
  'anime-character': { from: 'anime', to: 'character', roleValues: LIBRARY_ANIME_CHARACTER_ROLES },
  'comic-person': { from: 'comic', to: 'person', roleValues: LIBRARY_COMIC_PERSON_ROLES },
  'comic-company': { from: 'comic', to: 'company', roleValues: LIBRARY_COMIC_COMPANY_ROLES },
  'comic-character': { from: 'comic', to: 'character', roleValues: LIBRARY_COMIC_CHARACTER_ROLES },
  'novel-person': { from: 'novel', to: 'person', roleValues: LIBRARY_NOVEL_PERSON_ROLES },
  'novel-company': { from: 'novel', to: 'company', roleValues: LIBRARY_NOVEL_COMPANY_ROLES },
  'novel-character': { from: 'novel', to: 'character', roleValues: LIBRARY_NOVEL_CHARACTER_ROLES },
  'character-person': {
    from: 'character',
    to: 'person',
    roleValues: LIBRARY_CHARACTER_PERSON_ROLES
  },
  'game-tag': { from: 'game', to: 'tag', spoiler: true },
  'anime-tag': { from: 'anime', to: 'tag', spoiler: true },
  'comic-tag': { from: 'comic', to: 'tag', spoiler: true },
  'novel-tag': { from: 'novel', to: 'tag', spoiler: true },
  'character-tag': { from: 'character', to: 'tag', spoiler: true },
  'person-tag': { from: 'person', to: 'tag', spoiler: true },
  'company-tag': { from: 'company', to: 'tag', spoiler: true },
  'collection-game': { from: 'collection', to: 'game' },
  'collection-anime': { from: 'collection', to: 'anime' },
  'collection-comic': { from: 'collection', to: 'comic' },
  'collection-novel': { from: 'collection', to: 'novel' },
  'collection-character': { from: 'collection', to: 'character' },
  'collection-person': { from: 'collection', to: 'person' },
  'collection-company': { from: 'collection', to: 'company' }
} as const

export function validateLibraryLinkCreateInput(value: unknown): ValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path: '$', message: 'Library link input must be an object.' }]
  }

  const issues = [
    ...validateUnknownKeys(value, LINK_CREATE_KEYS),
    ...validateRequiredEnumString(
      value.kind,
      '$.kind',
      LIBRARY_LINK_KINDS,
      'kind must be one of the supported library link kinds.'
    )
  ]

  if (!matchesLibraryLinkKind(value.kind)) {
    return issues
  }

  const endpoint = LINK_ENDPOINTS[value.kind]
  issues.push(
    ...validateLibraryEntityReference(value.from, '$.from', endpoint.from),
    ...validateLibraryEntityReference(value.to, '$.to', endpoint.to),
    ...validateLinkMetadata(value.kind, value.metadata, '$.metadata', true)
  )
  return issues
}

export function validateLibraryLinkSelector(value: unknown): ValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path: '$', message: 'Library link selector must be an object.' }]
  }

  const issues = [
    ...validateRequiredEnumString(
      value.kind,
      '$.kind',
      LIBRARY_LINK_KINDS,
      'kind must be one of the supported library link kinds.'
    )
  ]

  if (!matchesLibraryLinkKind(value.kind)) {
    issues.push(...validateUnknownKeys(value, LINK_SELECTOR_KEYS))
    return issues
  }

  const endpoint = LINK_ENDPOINTS[value.kind]
  const allowedKeys = linkHasRole(value.kind)
    ? LINK_SELECTOR_KEYS
    : new Set<string>(['kind', 'from', 'to'])

  issues.push(
    ...validateUnknownKeys(value, allowedKeys),
    ...validateLibraryEntityReference(value.from, '$.from', endpoint.from),
    ...validateLibraryEntityReference(value.to, '$.to', endpoint.to)
  )

  if (linkHasRole(value.kind)) {
    const roleValues = getLinkRoleValues(value.kind)
    issues.push(
      ...validateRequiredEnumString(
        value.role,
        '$.role',
        roleValues,
        'role must be one of the supported link roles.'
      )
    )
  }

  return issues
}

export function validateLibraryLinkPatchForKind(
  kind: LibraryLinkKind,
  value: unknown
): ValidationIssue[] {
  return validateLinkMetadata(kind, value, '$', false)
}

export function validateLibraryLinkUpdateInput(
  selector: unknown,
  patch: unknown
): ValidationIssue[] {
  const issues = validateLibraryLinkSelector(selector)
  if (isRecord(selector) && matchesLibraryLinkKind(selector.kind)) {
    issues.push(...validateLibraryLinkPatchForKind(selector.kind, patch))
  } else {
    issues.push(...validatePatchObject(patch, '$'))
  }
  return issues
}

export function validateLibraryLinkQuery(value: unknown): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  if (!isRecord(value)) {
    return [{ path: '$', message: 'Library link query must be an object.' }]
  }

  return [
    ...validateUnknownKeys(value, LINK_LIST_QUERY_KEYS),
    ...validateOptionalLibraryEntityReference(value.entity, '$.entity'),
    ...validateOptionalLibraryEntityReference(value.relatedEntity, '$.relatedEntity'),
    ...validateOptionalLinkKindArray(value.kinds, '$.kinds')
  ]
}

export function assertValidLibraryLinkCreateInput(
  value: unknown
): asserts value is LibraryLinkCreateInput {
  throwIfValidationIssues('library.links.create input', validateLibraryLinkCreateInput(value))
}

export function assertValidLibraryLinkSelector(
  value: unknown
): asserts value is LibraryLinkSelector {
  throwIfValidationIssues('library link selector', validateLibraryLinkSelector(value))
}

export function assertValidLibraryLinkUpdateInput(
  selector: unknown,
  patch: unknown
): asserts selector is LibraryLinkSelector {
  throwIfValidationIssues(
    'library.links.update input',
    validateLibraryLinkUpdateInput(selector, patch)
  )
}

export function assertValidLibraryLinkQuery(
  value: unknown
): asserts value is LibraryLinkQuery | undefined {
  throwIfValidationIssues('library.links.list query', validateLibraryLinkQuery(value))
}

export function assertValidLibraryLinkPatchForKind(
  kind: LibraryLinkKind,
  value: unknown
): asserts value is LibraryLinkPatch {
  throwIfValidationIssues('library link patch', validateLibraryLinkPatchForKind(kind, value))
}

function validateLinkMetadata(
  kind: LibraryLinkKind,
  value: unknown,
  path: string,
  create: boolean
): ValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path, message: 'Link metadata must be an object.' }]
  }

  const role = linkHasRole(kind)
  const hasSpoiler = hasSpoilerMetadata(kind)
  const allowedKeys = new Set<string>([
    ...(role ? ['role'] : []),
    ...(role || hasSpoiler ? ['isSpoiler'] : []),
    'note',
    'order'
  ])

  const issues = [
    ...validateUnknownKeys(value, allowedKeys, path),
    ...validateOptionalString(value.note, `${path}.note`),
    ...validateOptionalFiniteNumber(value.order, `${path}.order`, 'order must be a finite number.')
  ]

  if (role) {
    const roleValues = getLinkRoleValues(kind)
    issues.push(
      ...(create
        ? validateRequiredEnumString(
            value.role,
            `${path}.role`,
            roleValues,
            'role must be one of the supported link roles.'
          )
        : validateOptionalEnumString(
            value.role,
            `${path}.role`,
            roleValues,
            'role must be one of the supported link roles.'
          ))
    )
  }

  if (role || hasSpoiler) {
    issues.push(...validateOptionalBoolean(value.isSpoiler, `${path}.isSpoiler`))
  }

  return issues
}

function validatePatchObject(value: unknown, path: string): ValidationIssue[] {
  return isRecord(value) ? [] : [{ path, message: 'Patch must be an object.' }]
}

function validateOptionalLibraryEntityReference(value: unknown, path: string): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  return validateLibraryEntityReference(value, path)
}

function validateOptionalLinkKindArray(value: unknown, path: string): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  if (!Array.isArray(value)) {
    return [{ path, message: 'kinds must be an array of supported library link kinds.' }]
  }

  const issues: ValidationIssue[] = []
  for (const [index, item] of value.entries()) {
    issues.push(
      ...validateRequiredEnumString(
        item,
        `${path}[${index}]`,
        LIBRARY_LINK_KINDS,
        'kind must be one of the supported library link kinds.'
      )
    )
  }
  return issues
}

function matchesLibraryLinkKind(value: unknown): value is LibraryLinkKind {
  return typeof value === 'string' && LIBRARY_LINK_KINDS.includes(value as LibraryLinkKind)
}

type RoleBearingLinkKind = {
  [K in LibraryLinkKind]: (typeof LINK_ENDPOINTS)[K] extends { roleValues: unknown } ? K : never
}[LibraryLinkKind]

function linkHasRole(kind: LibraryLinkKind): kind is RoleBearingLinkKind {
  return 'roleValues' in LINK_ENDPOINTS[kind]
}

function getLinkRoleValues(kind: RoleBearingLinkKind): readonly string[] {
  return LINK_ENDPOINTS[kind].roleValues
}

function hasSpoilerMetadata(kind: LibraryLinkKind): boolean {
  const endpoint = LINK_ENDPOINTS[kind]
  return 'spoiler' in endpoint && endpoint.spoiler === true
}
