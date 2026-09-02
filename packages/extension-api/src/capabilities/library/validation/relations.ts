import { LIBRARY_MEDIA_TYPES, type LibraryMediaType } from '../graph'
import {
  LIBRARY_MEDIA_RELATION_TYPE_RULES,
  type LibraryMediaRelationCreateInput,
  type LibraryMediaRelationPatch,
  type LibraryMediaRelationQuery,
  type LibraryMediaRelationSelector
} from '../relations'
import { LIBRARY_MEDIA_RELATION_TYPES } from '../../../shared/library'
import type { ValidationIssue } from '../../../shared/validation'
import {
  validateOptionalFiniteNumber,
  validateOptionalString,
  validateRequiredEnumString,
  validateUnknownKeys
} from '../../../shared/validation'
import { isRecord, throwIfValidationIssues, validateLibraryEntityReference } from './shared'

const RELATION_CREATE_KEYS = new Set<string>(['from', 'to', 'type', 'note', 'order'])
const RELATION_SELECTOR_KEYS = new Set<string>(['from', 'to', 'type'])
const RELATION_PATCH_KEYS = new Set<string>(['type', 'note', 'order'])
const RELATION_QUERY_KEYS = new Set<string>(['entity', 'relatedEntity'])

export function validateLibraryMediaRelationCreateInput(value: unknown): ValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path: '$', message: 'Library media relation input must be an object.' }]
  }

  return [
    ...validateUnknownKeys(value, RELATION_CREATE_KEYS),
    ...validateRelationEndpoints(value),
    ...validateEndpointsDistinct(value),
    ...validateRequiredEnumString(
      value.type,
      '$.type',
      LIBRARY_MEDIA_RELATION_TYPES,
      'type must be one of the supported media relation types.'
    ),
    ...validateTypeAgainstPair(value),
    ...validateOptionalString(value.note, '$.note'),
    ...validateOptionalFiniteNumber(value.order, '$.order', 'order must be a finite number.')
  ]
}

export function validateLibraryMediaRelationSelector(value: unknown): ValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path: '$', message: 'Library media relation selector must be an object.' }]
  }

  return [
    ...validateUnknownKeys(value, RELATION_SELECTOR_KEYS),
    ...validateRelationEndpoints(value),
    ...validateRequiredEnumString(
      value.type,
      '$.type',
      LIBRARY_MEDIA_RELATION_TYPES,
      'type must be one of the supported media relation types.'
    )
  ]
}

export function validateLibraryMediaRelationUpdateInput(
  selector: unknown,
  patch: unknown
): ValidationIssue[] {
  const issues = validateLibraryMediaRelationSelector(selector)

  if (!isRecord(patch)) {
    issues.push({ path: '$', message: 'Patch must be an object.' })
    return issues
  }

  issues.push(
    ...validateUnknownKeys(patch, RELATION_PATCH_KEYS),
    ...validateOptionalString(patch.note, '$.note'),
    ...validateOptionalFiniteNumber(patch.order, '$.order', 'order must be a finite number.')
  )

  if (patch.type !== undefined) {
    issues.push(
      ...validateRequiredEnumString(
        patch.type,
        '$.type',
        LIBRARY_MEDIA_RELATION_TYPES,
        'type must be one of the supported media relation types.'
      )
    )
    if (isRecord(selector)) {
      issues.push(...validateTypeAgainstPair({ ...selector, type: patch.type }))
    }
  }

  return issues
}

export function validateLibraryMediaRelationQuery(value: unknown): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  if (!isRecord(value)) {
    return [{ path: '$', message: 'Library media relation query must be an object.' }]
  }

  const issues = validateUnknownKeys(value, RELATION_QUERY_KEYS)
  if (value.entity !== undefined) {
    issues.push(...validateMediaEntityReference(value.entity, '$.entity'))
  }
  if (value.relatedEntity !== undefined) {
    issues.push(...validateMediaEntityReference(value.relatedEntity, '$.relatedEntity'))
  }
  return issues
}

export function assertValidLibraryMediaRelationCreateInput(
  value: unknown
): asserts value is LibraryMediaRelationCreateInput {
  throwIfValidationIssues(
    'library.relations.create input',
    validateLibraryMediaRelationCreateInput(value)
  )
}

export function assertValidLibraryMediaRelationSelector(
  value: unknown
): asserts value is LibraryMediaRelationSelector {
  throwIfValidationIssues(
    'library media relation selector',
    validateLibraryMediaRelationSelector(value)
  )
}

export function assertValidLibraryMediaRelationUpdateInput(
  selector: unknown,
  patch: unknown
): asserts selector is LibraryMediaRelationSelector {
  throwIfValidationIssues(
    'library.relations.update input',
    validateLibraryMediaRelationUpdateInput(selector, patch)
  )
}

export function assertValidLibraryMediaRelationQuery(
  value: unknown
): asserts value is LibraryMediaRelationQuery | undefined {
  throwIfValidationIssues('library.relations.list query', validateLibraryMediaRelationQuery(value))
}

export function assertValidLibraryMediaRelationPatch(
  value: unknown
): asserts value is LibraryMediaRelationPatch {
  if (!isRecord(value)) {
    throwIfValidationIssues('library media relation patch', [
      { path: '$', message: 'Patch must be an object.' }
    ])
  }
}

function validateRelationEndpoints(value: Record<string, unknown>): ValidationIssue[] {
  return [
    ...validateMediaEntityReference(value.from, '$.from'),
    ...validateMediaEntityReference(value.to, '$.to')
  ]
}

/** A relation is an edge between two entries; self-edges are rejected at create. */
function validateEndpointsDistinct(value: Record<string, unknown>): ValidationIssue[] {
  const { from, to } = value
  if (!isRecord(from) || !isRecord(to)) {
    return []
  }
  if (typeof from.id !== 'string' || from.id.trim() === '') {
    return []
  }
  if (from.entityType !== to.entityType || from.id !== to.id) {
    return []
  }

  return [{ path: '$.to', message: 'to must reference a different entry than from.' }]
}

function validateMediaEntityReference(value: unknown, path: string): ValidationIssue[] {
  const issues = validateLibraryEntityReference(value, path)
  if (
    isRecord(value) &&
    typeof value.entityType === 'string' &&
    !LIBRARY_MEDIA_TYPES.includes(value.entityType as LibraryMediaType)
  ) {
    issues.push({
      path: `${path}.entityType`,
      message: 'entityType must be one of the supported media types.'
    })
  }
  return issues
}

/** The ordered endpoint pair constrains the relation vocabulary. */
function validateTypeAgainstPair(value: Record<string, unknown>): ValidationIssue[] {
  const fromType = readMediaType(value.from)
  const toType = readMediaType(value.to)
  if (!fromType || !toType || typeof value.type !== 'string') {
    return []
  }

  const allowed = LIBRARY_MEDIA_RELATION_TYPE_RULES[`${fromType}-${toType}`]
  if (allowed.includes(value.type as (typeof allowed)[number])) {
    return []
  }

  return [
    {
      path: '$.type',
      message: `type "${value.type}" is not allowed for the ${fromType}-${toType} endpoint pair.`
    }
  ]
}

function readMediaType(value: unknown): LibraryMediaType | undefined {
  if (
    isRecord(value) &&
    typeof value.entityType === 'string' &&
    LIBRARY_MEDIA_TYPES.includes(value.entityType as LibraryMediaType)
  ) {
    return value.entityType as LibraryMediaType
  }
  return undefined
}
