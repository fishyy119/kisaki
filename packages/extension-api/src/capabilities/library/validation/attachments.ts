import {
  LIBRARY_ATTACHMENT_KINDS,
  type LibraryAttachmentKind,
  type LibraryAttachmentOwnerType,
  type LibraryAttachmentRemoveInput,
  type LibraryAttachmentWriteInput
} from '../attachments'
import type { ValidationIssue } from '../../../shared/validation'
import {
  validateOptionalBoolean,
  validateRequiredEnumString,
  validateRequiredString,
  validateUnknownKeys
} from '../../../shared/validation'
import { isRecord, throwIfValidationIssues, validateOptionalNonEmptyString } from './common'

const ENTITY_REFERENCE_KEYS = new Set<string>(['entityType', 'id'])
const ATTACHMENT_WRITE_KEYS = new Set<string>(['entity', 'slot', 'source', 'replace'])
const ATTACHMENT_REMOVE_KEYS = new Set<string>(['entity', 'slot', 'fileName'])

const ATTACHMENT_SLOTS_BY_OWNER = {
  game: ['cover', 'backdrop', 'logo', 'icon', 'description-inline'],
  anime: ['cover', 'backdrop', 'logo', 'description-inline'],
  character: ['photo'],
  person: ['photo'],
  company: ['logo'],
  collection: ['cover']
} as const satisfies Record<LibraryAttachmentOwnerType, readonly LibraryAttachmentKind[]>

/** Owner vocabulary derives from the slot table so the two can never drift. */
const ATTACHMENT_OWNER_TYPES = Object.keys(
  ATTACHMENT_SLOTS_BY_OWNER
) as readonly LibraryAttachmentOwnerType[]

export function validateLibraryAttachmentWriteInput(value: unknown): ValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path: '$', message: 'Library attachment write input must be an object.' }]
  }

  const issues = [
    ...validateUnknownKeys(value, ATTACHMENT_WRITE_KEYS),
    ...validateLibraryAttachmentEntityReference(value.entity, '$.entity'),
    ...validateRequiredEnumString(
      value.slot,
      '$.slot',
      LIBRARY_ATTACHMENT_KINDS,
      'slot must be one of the supported library attachment slots.'
    ),
    ...validateOptionalBoolean(value.replace, '$.replace')
  ]

  if (isAttachmentOwnerReference(value.entity) && isLibraryAttachmentKind(value.slot)) {
    issues.push(...validateAttachmentSlotForOwner(value.entity.entityType, value.slot, '$.slot'))
  }

  issues.push(...validateAttachmentSource(value.source, '$.source'))
  return issues
}

export function validateLibraryAttachmentRemoveInput(value: unknown): ValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path: '$', message: 'Library attachment remove input must be an object.' }]
  }

  const issues = [
    ...validateUnknownKeys(value, ATTACHMENT_REMOVE_KEYS),
    ...validateLibraryAttachmentEntityReference(value.entity, '$.entity'),
    ...validateRequiredEnumString(
      value.slot,
      '$.slot',
      LIBRARY_ATTACHMENT_KINDS,
      'slot must be one of the supported library attachment slots.'
    ),
    ...validateOptionalNonEmptyString(value.fileName, '$.fileName')
  ]

  if (isAttachmentOwnerReference(value.entity) && isLibraryAttachmentKind(value.slot)) {
    issues.push(...validateAttachmentSlotForOwner(value.entity.entityType, value.slot, '$.slot'))
  }

  return issues
}

export function validateLibraryAttachmentOwnerReference(value: unknown): ValidationIssue[] {
  return validateLibraryAttachmentEntityReference(value, '$')
}

export function assertValidLibraryAttachmentWriteInput(
  value: unknown
): asserts value is LibraryAttachmentWriteInput {
  throwIfValidationIssues(
    'library.attachments.put input',
    validateLibraryAttachmentWriteInput(value)
  )
}

export function assertValidLibraryAttachmentRemoveInput(
  value: unknown
): asserts value is LibraryAttachmentRemoveInput {
  throwIfValidationIssues(
    'library.attachments.remove input',
    validateLibraryAttachmentRemoveInput(value)
  )
}

export function assertValidLibraryAttachmentOwnerReference(
  value: unknown
): asserts value is LibraryAttachmentWriteInput['entity'] {
  throwIfValidationIssues(
    'library.attachments.list entity',
    validateLibraryAttachmentOwnerReference(value)
  )
}

function validateLibraryAttachmentEntityReference(value: unknown, path: string): ValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path, message: 'Library attachment entity must be an object.' }]
  }

  return [
    ...validateUnknownKeys(value, ENTITY_REFERENCE_KEYS, path),
    ...validateRequiredEnumString(
      value.entityType,
      `${path}.entityType`,
      ATTACHMENT_OWNER_TYPES,
      'entityType must be one of the supported library attachment owner types.'
    ),
    ...validateRequiredString(value.id, `${path}.id`, {
      trim: true,
      valueMessage: 'id must be a non-empty string.'
    })
  ]
}

function validateAttachmentSlotForOwner(
  owner: LibraryAttachmentOwnerType,
  slot: LibraryAttachmentKind,
  path: string
): ValidationIssue[] {
  const allowedSlots: readonly LibraryAttachmentKind[] = ATTACHMENT_SLOTS_BY_OWNER[owner]
  if (allowedSlots.includes(slot)) {
    return []
  }

  return [
    {
      path,
      message: `slot "${slot}" is not supported for "${owner}" entities.`
    }
  ]
}

function validateAttachmentSource(value: unknown, path: string): ValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path, message: 'Attachment source must be an object.' }]
  }

  if (typeof value.kind !== 'string') {
    return [{ path: `${path}.kind`, message: 'source.kind must be a string.' }]
  }

  switch (value.kind) {
    case 'buffer': {
      const issues = [
        ...validateUnknownKeys(
          value,
          new Set<string>(['kind', 'buffer', 'fileName', 'contentType']),
          path
        ),
        ...validateOptionalNonEmptyString(value.fileName, `${path}.fileName`),
        ...validateOptionalNonEmptyString(value.contentType, `${path}.contentType`)
      ]
      if (!(value.buffer instanceof Uint8Array)) {
        issues.push({ path: `${path}.buffer`, message: 'buffer must be a Uint8Array.' })
      }
      return issues
    }
    case 'url':
      return [
        ...validateUnknownKeys(value, new Set<string>(['kind', 'url', 'fileName']), path),
        ...validateRequiredString(value.url, `${path}.url`, {
          trim: true,
          valueMessage: 'url must be a non-empty string.'
        }),
        ...validateOptionalNonEmptyString(value.fileName, `${path}.fileName`)
      ]
    case 'path':
      return [
        ...validateUnknownKeys(value, new Set<string>(['kind', 'path']), path),
        ...validateRequiredString(value.path, `${path}.path`, {
          trim: true,
          valueMessage: 'path must be a non-empty string.'
        })
      ]
    default:
      return [{ path: `${path}.kind`, message: 'Unknown attachment source kind.' }]
  }
}

function isLibraryAttachmentKind(value: unknown): value is LibraryAttachmentKind {
  return (
    typeof value === 'string' && LIBRARY_ATTACHMENT_KINDS.includes(value as LibraryAttachmentKind)
  )
}

function isAttachmentOwnerReference(
  value: unknown
): value is { entityType: LibraryAttachmentOwnerType; id: string } {
  return (
    isRecord(value) &&
    typeof value.entityType === 'string' &&
    Object.hasOwn(ATTACHMENT_SLOTS_BY_OWNER, value.entityType)
  )
}
