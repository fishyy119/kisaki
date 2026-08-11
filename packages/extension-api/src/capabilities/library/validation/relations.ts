import {
  LIBRARY_RELATION_KINDS,
  type LibraryRelationCreateInput,
  type LibraryRelationKind,
  type LibraryRelationPatch,
  type LibraryRelationQuery,
  type LibraryRelationSelector
} from '../relations'
import {
  LIBRARY_ANIME_CHARACTER_ROLES,
  LIBRARY_ANIME_COMPANY_ROLES,
  LIBRARY_ANIME_PERSON_ROLES,
  LIBRARY_CHARACTER_PERSON_ROLES,
  LIBRARY_GAME_CHARACTER_ROLES,
  LIBRARY_GAME_COMPANY_ROLES,
  LIBRARY_GAME_PERSON_ROLES
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

const RELATION_CREATE_KEYS = new Set<string>(['kind', 'from', 'to', 'metadata'])
const RELATION_QUERY_SELECTOR_KEYS = new Set<string>(['kind', 'from', 'to', 'type'])
const RELATION_LIST_QUERY_KEYS = new Set<string>(['entity', 'relatedEntity', 'kinds'])

const RELATION_ENDPOINTS = {
  'game-person': { from: 'game', to: 'person', roleValues: LIBRARY_GAME_PERSON_ROLES },
  'game-company': { from: 'game', to: 'company', roleValues: LIBRARY_GAME_COMPANY_ROLES },
  'game-character': { from: 'game', to: 'character', roleValues: LIBRARY_GAME_CHARACTER_ROLES },
  'anime-person': { from: 'anime', to: 'person', roleValues: LIBRARY_ANIME_PERSON_ROLES },
  'anime-company': { from: 'anime', to: 'company', roleValues: LIBRARY_ANIME_COMPANY_ROLES },
  'anime-character': { from: 'anime', to: 'character', roleValues: LIBRARY_ANIME_CHARACTER_ROLES },
  'character-person': {
    from: 'character',
    to: 'person',
    roleValues: LIBRARY_CHARACTER_PERSON_ROLES
  },
  'game-tag': { from: 'game', to: 'tag', spoiler: true },
  'anime-tag': { from: 'anime', to: 'tag', spoiler: true },
  'character-tag': { from: 'character', to: 'tag', spoiler: true },
  'person-tag': { from: 'person', to: 'tag', spoiler: true },
  'company-tag': { from: 'company', to: 'tag', spoiler: true },
  'collection-game': { from: 'collection', to: 'game' },
  'collection-anime': { from: 'collection', to: 'anime' },
  'collection-character': { from: 'collection', to: 'character' },
  'collection-person': { from: 'collection', to: 'person' },
  'collection-company': { from: 'collection', to: 'company' }
} as const

export function validateLibraryRelationCreateInput(value: unknown): ValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path: '$', message: 'Library relation input must be an object.' }]
  }

  const issues = [
    ...validateUnknownKeys(value, RELATION_CREATE_KEYS),
    ...validateRequiredEnumString(
      value.kind,
      '$.kind',
      LIBRARY_RELATION_KINDS,
      'kind must be one of the supported library relation kinds.'
    )
  ]

  if (!isLibraryRelationKind(value.kind)) {
    return issues
  }

  const endpoint = RELATION_ENDPOINTS[value.kind]
  issues.push(
    ...validateLibraryEntityReference(value.from, '$.from', endpoint.from),
    ...validateLibraryEntityReference(value.to, '$.to', endpoint.to),
    ...validateRelationMetadata(value.kind, value.metadata, '$.metadata', true)
  )
  return issues
}

export function validateLibraryRelationSelector(value: unknown): ValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path: '$', message: 'Library relation selector must be an object.' }]
  }

  const issues = [
    ...validateRequiredEnumString(
      value.kind,
      '$.kind',
      LIBRARY_RELATION_KINDS,
      'kind must be one of the supported library relation kinds.'
    )
  ]

  if (!isLibraryRelationKind(value.kind)) {
    issues.push(...validateUnknownKeys(value, RELATION_QUERY_SELECTOR_KEYS))
    return issues
  }

  const endpoint = RELATION_ENDPOINTS[value.kind]
  const allowedKeys = relationHasRole(value.kind)
    ? RELATION_QUERY_SELECTOR_KEYS
    : new Set<string>(['kind', 'from', 'to'])

  issues.push(
    ...validateUnknownKeys(value, allowedKeys),
    ...validateLibraryEntityReference(value.from, '$.from', endpoint.from),
    ...validateLibraryEntityReference(value.to, '$.to', endpoint.to)
  )

  if (relationHasRole(value.kind)) {
    const roleValues = getRelationRoleValues(value.kind)
    issues.push(
      ...validateRequiredEnumString(
        value.type,
        '$.type',
        roleValues,
        'type must be one of the supported relation roles.'
      )
    )
  }

  return issues
}

export function validateLibraryRelationPatchForKind(
  kind: LibraryRelationKind,
  value: unknown
): ValidationIssue[] {
  return validateRelationMetadata(kind, value, '$', false)
}

export function validateLibraryRelationUpdateInput(
  selector: unknown,
  patch: unknown
): ValidationIssue[] {
  const issues = validateLibraryRelationSelector(selector)
  if (isRecord(selector) && isLibraryRelationKind(selector.kind)) {
    issues.push(...validateLibraryRelationPatchForKind(selector.kind, patch))
  } else {
    issues.push(...validatePatchObject(patch, '$'))
  }
  return issues
}

export function validateLibraryRelationQuery(value: unknown): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  if (!isRecord(value)) {
    return [{ path: '$', message: 'Library relation query must be an object.' }]
  }

  return [
    ...validateUnknownKeys(value, RELATION_LIST_QUERY_KEYS),
    ...validateOptionalLibraryEntityReference(value.entity, '$.entity'),
    ...validateOptionalLibraryEntityReference(value.relatedEntity, '$.relatedEntity'),
    ...validateOptionalRelationKindArray(value.kinds, '$.kinds')
  ]
}

export function assertValidLibraryRelationCreateInput(
  value: unknown
): asserts value is LibraryRelationCreateInput {
  throwIfValidationIssues(
    'library.relations.create input',
    validateLibraryRelationCreateInput(value)
  )
}

export function assertValidLibraryRelationSelector(
  value: unknown
): asserts value is LibraryRelationSelector {
  throwIfValidationIssues('library relation selector', validateLibraryRelationSelector(value))
}

export function assertValidLibraryRelationUpdateInput(
  selector: unknown,
  patch: unknown
): asserts selector is LibraryRelationSelector {
  throwIfValidationIssues(
    'library.relations.update input',
    validateLibraryRelationUpdateInput(selector, patch)
  )
}

export function assertValidLibraryRelationQuery(
  value: unknown
): asserts value is LibraryRelationQuery | undefined {
  throwIfValidationIssues('library.relations.list query', validateLibraryRelationQuery(value))
}

export function assertValidLibraryRelationPatchForKind(
  kind: LibraryRelationKind,
  value: unknown
): asserts value is LibraryRelationPatch {
  throwIfValidationIssues(
    'library relation patch',
    validateLibraryRelationPatchForKind(kind, value)
  )
}

function validateRelationMetadata(
  kind: LibraryRelationKind,
  value: unknown,
  path: string,
  create: boolean
): ValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path, message: 'Relation metadata must be an object.' }]
  }

  const role = relationHasRole(kind)
  const hasSpoiler = hasSpoilerMetadata(kind)
  const allowedKeys = new Set<string>([
    ...(role ? ['type'] : []),
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
    const roleValues = getRelationRoleValues(kind)
    issues.push(
      ...(create
        ? validateRequiredEnumString(
            value.type,
            `${path}.type`,
            roleValues,
            'type must be one of the supported relation roles.'
          )
        : validateOptionalEnumString(
            value.type,
            `${path}.type`,
            roleValues,
            'type must be one of the supported relation roles.'
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

function validateOptionalRelationKindArray(value: unknown, path: string): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  if (!Array.isArray(value)) {
    return [{ path, message: 'kinds must be an array of supported library relation kinds.' }]
  }

  const issues: ValidationIssue[] = []
  for (const [index, item] of value.entries()) {
    issues.push(
      ...validateRequiredEnumString(
        item,
        `${path}[${index}]`,
        LIBRARY_RELATION_KINDS,
        'kind must be one of the supported library relation kinds.'
      )
    )
  }
  return issues
}

function isLibraryRelationKind(value: unknown): value is LibraryRelationKind {
  return typeof value === 'string' && LIBRARY_RELATION_KINDS.includes(value as LibraryRelationKind)
}

function relationHasRole(
  kind: LibraryRelationKind
): kind is 'game-person' | 'game-company' | 'game-character' | 'character-person' {
  return 'roleValues' in RELATION_ENDPOINTS[kind]
}

function getRelationRoleValues(
  kind: 'game-person' | 'game-company' | 'game-character' | 'character-person'
): readonly string[] {
  return RELATION_ENDPOINTS[kind].roleValues
}

function hasSpoilerMetadata(kind: LibraryRelationKind): boolean {
  const endpoint = RELATION_ENDPOINTS[kind]
  return 'spoiler' in endpoint && endpoint.spoiler === true
}
