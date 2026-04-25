import type {
  LibraryCharacterCreateInput,
  LibraryCharacterPatch,
  LibraryCollectionCreateInput,
  LibraryCollectionPatch,
  LibraryCompanyCreateInput,
  LibraryCompanyPatch,
  LibraryEntityType,
  LibraryGameCreateInput,
  LibraryGamePatch,
  LibraryPersonCreateInput,
  LibraryPersonPatch,
  LibraryTagCreateInput,
  LibraryTagPatch
} from './entities'
import {
  LIBRARY_ATTACHMENT_KINDS,
  type LibraryAttachmentRemoveInput,
  type LibraryAttachmentWriteInput,
  type LibraryAttachmentKind,
  type LibraryAttachmentOwnerType
} from './attachments'
import {
  LIBRARY_BLOOD_TYPES,
  LIBRARY_CUP_SIZES,
  LIBRARY_ENTITY_TYPES,
  LIBRARY_GAME_LAUNCHER_MODES,
  LIBRARY_GAME_MONITOR_MODES,
  LIBRARY_GAME_STATUSES,
  LIBRARY_GENDERS
} from './entities'
import {
  LIBRARY_CHARACTER_PERSON_ROLES,
  LIBRARY_GAME_CHARACTER_ROLES,
  LIBRARY_GAME_COMPANY_ROLES,
  LIBRARY_GAME_PERSON_ROLES,
  LIBRARY_RELATION_KINDS,
  type LibraryRelationCreateInput,
  type LibraryRelationKind,
  type LibraryRelationPatch,
  type LibraryRelationSelector
} from './relations'
import { createValidationError } from '../../shared/errors'
import type { ValidationIssue } from '../../shared/validation'
import {
  isPlainObject,
  validateOptionalBoolean,
  validateOptionalEnumString,
  validateOptionalFiniteNumber,
  validateOptionalString,
  validateRequiredArray,
  validateRequiredBoolean,
  validateRequiredEnumString,
  validateRequiredFiniteNumber,
  validateRequiredString,
  validateSerializableRecord,
  validateUnknownKeys
} from '../../shared/validation'

const ENTITY_REFERENCE_KEYS = new Set<string>(['entityType', 'id'])
const PARTIAL_DATE_KEYS = new Set<string>(['year', 'month', 'day'])
const EXTERNAL_ID_KEYS = new Set<string>(['source', 'id'])
const RELATED_SITE_KEYS = new Set<string>(['label', 'url'])
const SAVE_BACKUP_KEYS = new Set<string>(['backupAt', 'note', 'locked', 'saveFile', 'sizeBytes'])
const DYNAMIC_COLLECTION_KEYS = new Set<string>(['game', 'character', 'person', 'company'])
const DYNAMIC_ENTITY_CONFIG_KEYS = new Set<string>([
  'enabled',
  'filter',
  'sortField',
  'sortDirection'
])
const RELATION_CREATE_KEYS = new Set<string>(['kind', 'from', 'to', 'metadata'])
const RELATION_QUERY_SELECTOR_KEYS = new Set<string>(['kind', 'from', 'to', 'type'])
const ATTACHMENT_WRITE_KEYS = new Set<string>(['entity', 'slot', 'source', 'replace'])
const ATTACHMENT_REMOVE_KEYS = new Set<string>(['entity', 'slot', 'fileName'])

const ENTITY_BASE_CREATE_KEYS = ['name', 'description'] as const
const NAMED_ENTITY_KEYS = ['originalName', 'sortName'] as const
const RANKED_ENTITY_KEYS = [
  ...ENTITY_BASE_CREATE_KEYS,
  ...NAMED_ENTITY_KEYS,
  'score',
  'isFavorite',
  'isNsfw',
  'relatedSites'
] as const

const GAME_CREATE_KEYS = new Set<string>([
  ...RANKED_ENTITY_KEYS,
  'coverFile',
  'backdropFile',
  'logoFile',
  'iconFile',
  'releaseDate',
  'status',
  'savePath',
  'saveBackups',
  'maxSaveBackups',
  'launcherMode',
  'launcherPath',
  'monitorMode',
  'monitorPath',
  'gameDirPath',
  'descriptionInlineFiles',
  'externalIds'
])
const GAME_PATCH_KEYS = new Set<string>([...GAME_CREATE_KEYS, 'lastActiveAt', 'totalDuration'])
const PERSON_CREATE_KEYS = new Set<string>([
  ...RANKED_ENTITY_KEYS,
  'photoFile',
  'birthDate',
  'deathDate',
  'gender',
  'externalIds'
])
const COMPANY_CREATE_KEYS = new Set<string>([
  ...RANKED_ENTITY_KEYS,
  'foundedDate',
  'logoFile',
  'externalIds'
])
const CHARACTER_CREATE_KEYS = new Set<string>([
  ...RANKED_ENTITY_KEYS,
  'photoFile',
  'birthDate',
  'gender',
  'bloodType',
  'height',
  'weight',
  'bust',
  'waist',
  'hips',
  'cup',
  'age',
  'externalIds'
])
const COLLECTION_CREATE_KEYS = new Set<string>([
  ...ENTITY_BASE_CREATE_KEYS,
  'coverFile',
  'isNsfw',
  'order',
  'isDynamic',
  'dynamicConfig'
])
const TAG_CREATE_KEYS = new Set<string>([...ENTITY_BASE_CREATE_KEYS, 'isNsfw'])

const RELATION_ENDPOINTS = {
  'game-person': { from: 'game', to: 'person', roleValues: LIBRARY_GAME_PERSON_ROLES },
  'game-company': { from: 'game', to: 'company', roleValues: LIBRARY_GAME_COMPANY_ROLES },
  'game-character': { from: 'game', to: 'character', roleValues: LIBRARY_GAME_CHARACTER_ROLES },
  'character-person': {
    from: 'character',
    to: 'person',
    roleValues: LIBRARY_CHARACTER_PERSON_ROLES
  },
  'game-tag': { from: 'game', to: 'tag', spoiler: true },
  'character-tag': { from: 'character', to: 'tag', spoiler: true },
  'person-tag': { from: 'person', to: 'tag', spoiler: true },
  'company-tag': { from: 'company', to: 'tag', spoiler: true },
  'collection-game': { from: 'collection', to: 'game' },
  'collection-character': { from: 'collection', to: 'character' },
  'collection-person': { from: 'collection', to: 'person' },
  'collection-company': { from: 'collection', to: 'company' }
} as const

const ATTACHMENT_SLOTS_BY_OWNER = {
  game: ['cover', 'backdrop', 'logo', 'icon', 'description-inline'],
  character: ['photo'],
  person: ['photo'],
  company: ['logo'],
  collection: ['cover']
} as const satisfies Record<LibraryAttachmentOwnerType, readonly LibraryAttachmentKind[]>

export function validateLibraryGameCreateInput(value: unknown): ValidationIssue[] {
  return validateGameWriteInput(value, '$', true)
}

export function validateLibraryGamePatch(value: unknown): ValidationIssue[] {
  return validateGameWriteInput(value, '$', false)
}

export function validateLibraryPersonCreateInput(value: unknown): ValidationIssue[] {
  return validatePersonWriteInput(value, '$', true)
}

export function validateLibraryPersonPatch(value: unknown): ValidationIssue[] {
  return validatePersonWriteInput(value, '$', false)
}

export function validateLibraryCompanyCreateInput(value: unknown): ValidationIssue[] {
  return validateCompanyWriteInput(value, '$', true)
}

export function validateLibraryCompanyPatch(value: unknown): ValidationIssue[] {
  return validateCompanyWriteInput(value, '$', false)
}

export function validateLibraryCharacterCreateInput(value: unknown): ValidationIssue[] {
  return validateCharacterWriteInput(value, '$', true)
}

export function validateLibraryCharacterPatch(value: unknown): ValidationIssue[] {
  return validateCharacterWriteInput(value, '$', false)
}

export function validateLibraryCollectionCreateInput(value: unknown): ValidationIssue[] {
  return validateCollectionWriteInput(value, '$', true)
}

export function validateLibraryCollectionPatch(value: unknown): ValidationIssue[] {
  return validateCollectionWriteInput(value, '$', false)
}

export function validateLibraryTagCreateInput(value: unknown): ValidationIssue[] {
  return validateTagWriteInput(value, '$', true)
}

export function validateLibraryTagPatch(value: unknown): ValidationIssue[] {
  return validateTagWriteInput(value, '$', false)
}

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

export function assertValidLibraryEntityId(
  value: unknown,
  label = 'library entity id'
): asserts value is string {
  const issues = validateRequiredString(value, '$', {
    trim: true,
    valueMessage: `${label} must be a non-empty string.`
  })
  throwIfValidationIssues(label, issues)
}

export function assertValidLibraryGameCreateInput(
  value: unknown
): asserts value is LibraryGameCreateInput {
  throwIfValidationIssues('library.games.create input', validateLibraryGameCreateInput(value))
}

export function assertValidLibraryGamePatch(value: unknown): asserts value is LibraryGamePatch {
  throwIfValidationIssues('library.games.update patch', validateLibraryGamePatch(value))
}

export function assertValidLibraryPersonCreateInput(
  value: unknown
): asserts value is LibraryPersonCreateInput {
  throwIfValidationIssues('library.persons.create input', validateLibraryPersonCreateInput(value))
}

export function assertValidLibraryPersonPatch(value: unknown): asserts value is LibraryPersonPatch {
  throwIfValidationIssues('library.persons.update patch', validateLibraryPersonPatch(value))
}

export function assertValidLibraryCompanyCreateInput(
  value: unknown
): asserts value is LibraryCompanyCreateInput {
  throwIfValidationIssues(
    'library.companies.create input',
    validateLibraryCompanyCreateInput(value)
  )
}

export function assertValidLibraryCompanyPatch(
  value: unknown
): asserts value is LibraryCompanyPatch {
  throwIfValidationIssues('library.companies.update patch', validateLibraryCompanyPatch(value))
}

export function assertValidLibraryCharacterCreateInput(
  value: unknown
): asserts value is LibraryCharacterCreateInput {
  throwIfValidationIssues(
    'library.characters.create input',
    validateLibraryCharacterCreateInput(value)
  )
}

export function assertValidLibraryCharacterPatch(
  value: unknown
): asserts value is LibraryCharacterPatch {
  throwIfValidationIssues('library.characters.update patch', validateLibraryCharacterPatch(value))
}

export function assertValidLibraryCollectionCreateInput(
  value: unknown
): asserts value is LibraryCollectionCreateInput {
  throwIfValidationIssues(
    'library.collections.create input',
    validateLibraryCollectionCreateInput(value)
  )
}

export function assertValidLibraryCollectionPatch(
  value: unknown
): asserts value is LibraryCollectionPatch {
  throwIfValidationIssues('library.collections.update patch', validateLibraryCollectionPatch(value))
}

export function assertValidLibraryTagCreateInput(
  value: unknown
): asserts value is LibraryTagCreateInput {
  throwIfValidationIssues('library.tags.create input', validateLibraryTagCreateInput(value))
}

export function assertValidLibraryTagPatch(value: unknown): asserts value is LibraryTagPatch {
  throwIfValidationIssues('library.tags.update patch', validateLibraryTagPatch(value))
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

export function assertValidLibraryRelationPatchForKind(
  kind: LibraryRelationKind,
  value: unknown
): asserts value is LibraryRelationPatch {
  throwIfValidationIssues(
    'library relation patch',
    validateLibraryRelationPatchForKind(kind, value)
  )
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

function validateGameWriteInput(value: unknown, path: string, create: boolean): ValidationIssue[] {
  const input = requireWriteObject(value, path, create ? 'Game create input' : 'Game patch')
  if (!input) {
    return [
      {
        path,
        message: create ? 'Game create input must be an object.' : 'Game patch must be an object.'
      }
    ]
  }

  return [
    ...validateUnknownKeys(input, create ? GAME_CREATE_KEYS : GAME_PATCH_KEYS, path),
    ...validateRankedEntityFields(input, path, create),
    ...validateOptionalNonEmptyString(input.coverFile, `${path}.coverFile`),
    ...validateOptionalNonEmptyString(input.backdropFile, `${path}.backdropFile`),
    ...validateOptionalNonEmptyString(input.logoFile, `${path}.logoFile`),
    ...validateOptionalNonEmptyString(input.iconFile, `${path}.iconFile`),
    ...validateOptionalPartialDate(input.releaseDate, `${path}.releaseDate`),
    ...validateOptionalEnumString(
      input.status,
      `${path}.status`,
      LIBRARY_GAME_STATUSES,
      'status must be one of the supported game statuses.'
    ),
    ...validateOptionalString(input.savePath, `${path}.savePath`),
    ...validateOptionalSaveBackups(input.saveBackups, `${path}.saveBackups`),
    ...validateOptionalNonNegativeInteger(input.maxSaveBackups, `${path}.maxSaveBackups`),
    ...validateOptionalEnumString(
      input.launcherMode,
      `${path}.launcherMode`,
      LIBRARY_GAME_LAUNCHER_MODES,
      'launcherMode must be one of the supported launcher modes.'
    ),
    ...validateOptionalString(input.launcherPath, `${path}.launcherPath`),
    ...validateOptionalEnumString(
      input.monitorMode,
      `${path}.monitorMode`,
      LIBRARY_GAME_MONITOR_MODES,
      'monitorMode must be one of the supported monitor modes.'
    ),
    ...validateOptionalString(input.monitorPath, `${path}.monitorPath`),
    ...validateOptionalString(input.gameDirPath, `${path}.gameDirPath`),
    ...validateOptionalStringArray(input.descriptionInlineFiles, `${path}.descriptionInlineFiles`),
    ...validateOptionalExternalIds(input.externalIds, `${path}.externalIds`),
    ...validateOptionalNullableFiniteNumber(input.lastActiveAt, `${path}.lastActiveAt`),
    ...validateOptionalNonNegativeFiniteNumber(input.totalDuration, `${path}.totalDuration`)
  ]
}

function validatePersonWriteInput(
  value: unknown,
  path: string,
  create: boolean
): ValidationIssue[] {
  const input = requireWriteObject(value, path, create ? 'Person create input' : 'Person patch')
  if (!input) {
    return [
      {
        path,
        message: create
          ? 'Person create input must be an object.'
          : 'Person patch must be an object.'
      }
    ]
  }

  return [
    ...validateUnknownKeys(input, PERSON_CREATE_KEYS, path),
    ...validateRankedEntityFields(input, path, create),
    ...validateOptionalNonEmptyString(input.photoFile, `${path}.photoFile`),
    ...validateOptionalPartialDate(input.birthDate, `${path}.birthDate`),
    ...validateOptionalPartialDate(input.deathDate, `${path}.deathDate`),
    ...validateOptionalEnumString(
      input.gender,
      `${path}.gender`,
      LIBRARY_GENDERS,
      'gender must be one of the supported gender values.'
    ),
    ...validateOptionalExternalIds(input.externalIds, `${path}.externalIds`)
  ]
}

function validateCompanyWriteInput(
  value: unknown,
  path: string,
  create: boolean
): ValidationIssue[] {
  const input = requireWriteObject(value, path, create ? 'Company create input' : 'Company patch')
  if (!input) {
    return [
      {
        path,
        message: create
          ? 'Company create input must be an object.'
          : 'Company patch must be an object.'
      }
    ]
  }

  return [
    ...validateUnknownKeys(input, COMPANY_CREATE_KEYS, path),
    ...validateRankedEntityFields(input, path, create),
    ...validateOptionalPartialDate(input.foundedDate, `${path}.foundedDate`),
    ...validateOptionalNonEmptyString(input.logoFile, `${path}.logoFile`),
    ...validateOptionalExternalIds(input.externalIds, `${path}.externalIds`)
  ]
}

function validateCharacterWriteInput(
  value: unknown,
  path: string,
  create: boolean
): ValidationIssue[] {
  const input = requireWriteObject(
    value,
    path,
    create ? 'Character create input' : 'Character patch'
  )
  if (!input) {
    return [
      {
        path,
        message: create
          ? 'Character create input must be an object.'
          : 'Character patch must be an object.'
      }
    ]
  }

  return [
    ...validateUnknownKeys(input, CHARACTER_CREATE_KEYS, path),
    ...validateRankedEntityFields(input, path, create),
    ...validateOptionalNonEmptyString(input.photoFile, `${path}.photoFile`),
    ...validateOptionalPartialDate(input.birthDate, `${path}.birthDate`),
    ...validateOptionalEnumString(
      input.gender,
      `${path}.gender`,
      LIBRARY_GENDERS,
      'gender must be one of the supported gender values.'
    ),
    ...validateOptionalEnumString(
      input.bloodType,
      `${path}.bloodType`,
      LIBRARY_BLOOD_TYPES,
      'bloodType must be one of the supported blood types.'
    ),
    ...validateOptionalNonNegativeFiniteNumber(input.height, `${path}.height`),
    ...validateOptionalNonNegativeFiniteNumber(input.weight, `${path}.weight`),
    ...validateOptionalNonNegativeFiniteNumber(input.bust, `${path}.bust`),
    ...validateOptionalNonNegativeFiniteNumber(input.waist, `${path}.waist`),
    ...validateOptionalNonNegativeFiniteNumber(input.hips, `${path}.hips`),
    ...validateOptionalEnumString(
      input.cup,
      `${path}.cup`,
      LIBRARY_CUP_SIZES,
      'cup must be one of the supported cup sizes.'
    ),
    ...validateOptionalNonNegativeFiniteNumber(input.age, `${path}.age`),
    ...validateOptionalExternalIds(input.externalIds, `${path}.externalIds`)
  ]
}

function validateCollectionWriteInput(
  value: unknown,
  path: string,
  create: boolean
): ValidationIssue[] {
  const input = requireWriteObject(
    value,
    path,
    create ? 'Collection create input' : 'Collection patch'
  )
  if (!input) {
    return [
      {
        path,
        message: create
          ? 'Collection create input must be an object.'
          : 'Collection patch must be an object.'
      }
    ]
  }

  return [
    ...validateUnknownKeys(input, COLLECTION_CREATE_KEYS, path),
    ...validateEntityBaseFields(input, path, create),
    ...validateOptionalNonEmptyString(input.coverFile, `${path}.coverFile`),
    ...validateOptionalBoolean(input.isNsfw, `${path}.isNsfw`),
    ...validateOptionalFiniteNumber(input.order, `${path}.order`, 'order must be a finite number.'),
    ...validateOptionalBoolean(input.isDynamic, `${path}.isDynamic`),
    ...validateOptionalDynamicCollectionConfig(input.dynamicConfig, `${path}.dynamicConfig`)
  ]
}

function validateTagWriteInput(value: unknown, path: string, create: boolean): ValidationIssue[] {
  const input = requireWriteObject(value, path, create ? 'Tag create input' : 'Tag patch')
  if (!input) {
    return [
      {
        path,
        message: create ? 'Tag create input must be an object.' : 'Tag patch must be an object.'
      }
    ]
  }

  return [
    ...validateUnknownKeys(input, TAG_CREATE_KEYS, path),
    ...validateEntityBaseFields(input, path, create),
    ...validateOptionalBoolean(input.isNsfw, `${path}.isNsfw`)
  ]
}

function validateEntityBaseFields(
  input: Record<string, unknown>,
  path: string,
  create: boolean
): ValidationIssue[] {
  const issues = create
    ? validateRequiredString(input.name, `${path}.name`, {
        trim: true,
        valueMessage: 'name must be a non-empty string.'
      })
    : validateOptionalNonEmptyString(input.name, `${path}.name`)

  issues.push(...validateOptionalString(input.description, `${path}.description`))
  return issues
}

function validateNamedEntityFields(
  input: Record<string, unknown>,
  path: string,
  create: boolean
): ValidationIssue[] {
  return [
    ...validateEntityBaseFields(input, path, create),
    ...validateOptionalString(input.originalName, `${path}.originalName`),
    ...validateOptionalString(input.sortName, `${path}.sortName`)
  ]
}

function validateRankedEntityFields(
  input: Record<string, unknown>,
  path: string,
  create: boolean
): ValidationIssue[] {
  return [
    ...validateNamedEntityFields(input, path, create),
    ...validateOptionalNullableFiniteNumber(input.score, `${path}.score`),
    ...validateOptionalBoolean(input.isFavorite, `${path}.isFavorite`),
    ...validateOptionalBoolean(input.isNsfw, `${path}.isNsfw`),
    ...validateOptionalRelatedSites(input.relatedSites, `${path}.relatedSites`)
  ]
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

function validateLibraryEntityReference(
  value: unknown,
  path: string,
  expectedEntityType?: LibraryEntityType
): ValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path, message: 'Library entity reference must be an object.' }]
  }

  const issues = [
    ...validateUnknownKeys(value, ENTITY_REFERENCE_KEYS, path),
    ...validateRequiredEnumString(
      value.entityType,
      `${path}.entityType`,
      LIBRARY_ENTITY_TYPES,
      'entityType must be one of the supported library entity types.'
    ),
    ...validateRequiredString(value.id, `${path}.id`, {
      trim: true,
      valueMessage: 'id must be a non-empty string.'
    })
  ]

  if (expectedEntityType && value.entityType !== expectedEntityType) {
    issues.push({
      path: `${path}.entityType`,
      message: `entityType must be "${expectedEntityType}".`
    })
  }

  return issues
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
      ['game', 'character', 'person', 'company', 'collection'] as const,
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

function validateOptionalPartialDate(value: unknown, path: string): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  if (!isRecord(value)) {
    return [{ path, message: 'Partial date must be an object.' }]
  }

  return [
    ...validateUnknownKeys(value, PARTIAL_DATE_KEYS, path),
    ...validateOptionalInteger(value.year, `${path}.year`, 'year must be an integer.'),
    ...validateOptionalIntegerInRange(value.month, `${path}.month`, 1, 12),
    ...validateOptionalIntegerInRange(value.day, `${path}.day`, 1, 31)
  ]
}

function validateOptionalExternalIds(value: unknown, path: string): ValidationIssue[] {
  return validateOptionalArrayOf(value, path, 'externalIds must be an array.', (item, itemPath) =>
    validateExternalId(item, itemPath)
  )
}

function validateExternalId(value: unknown, path: string): ValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path, message: 'External id must be an object.' }]
  }

  return [
    ...validateUnknownKeys(value, EXTERNAL_ID_KEYS, path),
    ...validateRequiredString(value.source, `${path}.source`, {
      trim: true,
      valueMessage: 'source must be a non-empty string.'
    }),
    ...validateRequiredString(value.id, `${path}.id`, {
      trim: true,
      valueMessage: 'id must be a non-empty string.'
    })
  ]
}

function validateOptionalRelatedSites(value: unknown, path: string): ValidationIssue[] {
  return validateOptionalArrayOf(value, path, 'relatedSites must be an array.', (item, itemPath) =>
    validateRelatedSite(item, itemPath)
  )
}

function validateRelatedSite(value: unknown, path: string): ValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path, message: 'Related site must be an object.' }]
  }

  return [
    ...validateUnknownKeys(value, RELATED_SITE_KEYS, path),
    ...validateRequiredString(value.label, `${path}.label`, {
      trim: true,
      valueMessage: 'label must be a non-empty string.'
    }),
    ...validateRequiredString(value.url, `${path}.url`, {
      trim: true,
      valueMessage: 'url must be a non-empty string.'
    })
  ]
}

function validateOptionalSaveBackups(value: unknown, path: string): ValidationIssue[] {
  return validateOptionalArrayOf(value, path, 'saveBackups must be an array.', (item, itemPath) =>
    validateSaveBackup(item, itemPath)
  )
}

function validateSaveBackup(value: unknown, path: string): ValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path, message: 'Save backup must be an object.' }]
  }

  return [
    ...validateUnknownKeys(value, SAVE_BACKUP_KEYS, path),
    ...validateRequiredFiniteNumber(value.backupAt, `${path}.backupAt`),
    ...validateRequiredString(value.note, `${path}.note`, { minLength: 0 }),
    ...validateRequiredBoolean(value.locked, `${path}.locked`),
    ...validateRequiredString(value.saveFile, `${path}.saveFile`, {
      trim: true,
      valueMessage: 'saveFile must be a non-empty string.'
    }),
    ...validateOptionalNonNegativeFiniteNumber(value.sizeBytes, `${path}.sizeBytes`)
  ]
}

function validateOptionalDynamicCollectionConfig(value: unknown, path: string): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  if (!isRecord(value)) {
    return [{ path, message: 'dynamicConfig must be an object.' }]
  }

  const issues = validateUnknownKeys(value, DYNAMIC_COLLECTION_KEYS, path)
  for (const key of DYNAMIC_COLLECTION_KEYS) {
    issues.push(...validateDynamicEntityConfig(value[key], `${path}.${key}`))
  }
  return issues
}

function validateDynamicEntityConfig(value: unknown, path: string): ValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path, message: 'Dynamic entity config must be an object.' }]
  }

  return [
    ...validateUnknownKeys(value, DYNAMIC_ENTITY_CONFIG_KEYS, path),
    ...validateRequiredBoolean(value.enabled, `${path}.enabled`),
    ...validateSerializableRecord(value.filter, `${path}.filter`),
    ...validateRequiredString(value.sortField, `${path}.sortField`, {
      trim: true,
      valueMessage: 'sortField must be a non-empty string.'
    }),
    ...validateRequiredEnumString(
      value.sortDirection,
      `${path}.sortDirection`,
      ['asc', 'desc'] as const,
      'sortDirection must be "asc" or "desc".'
    )
  ]
}

function validateOptionalStringArray(value: unknown, path: string): ValidationIssue[] {
  return validateOptionalArrayOf(
    value,
    path,
    'Field must be an array of strings.',
    (item, itemPath) =>
      typeof item === 'string' ? [] : [{ path: itemPath, message: 'Array item must be a string.' }]
  )
}

function validateOptionalArrayOf(
  value: unknown,
  path: string,
  typeMessage: string,
  validateItem: (item: unknown, path: string) => ValidationIssue[]
): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  const issues = validateRequiredArray(value, path, { typeMessage })
  if (!Array.isArray(value)) {
    return issues
  }

  for (const [index, item] of value.entries()) {
    issues.push(...validateItem(item, `${path}[${index}]`))
  }
  return issues
}

function validateOptionalNullableFiniteNumber(value: unknown, path: string): ValidationIssue[] {
  if (value === undefined || value === null) {
    return []
  }

  return validateOptionalFiniteNumber(value, path)
}

function validateOptionalNonNegativeFiniteNumber(value: unknown, path: string): ValidationIssue[] {
  const issues = validateOptionalFiniteNumber(value, path, 'Field must be a finite number.')
  if (typeof value === 'number' && value < 0) {
    issues.push({ path, message: 'Field must be greater than or equal to zero.' })
  }
  return issues
}

function validateOptionalNonNegativeInteger(value: unknown, path: string): ValidationIssue[] {
  const issues = validateOptionalInteger(value, path, 'Field must be an integer.')
  if (typeof value === 'number' && value < 0) {
    issues.push({ path, message: 'Field must be greater than or equal to zero.' })
  }
  return issues
}

function validateOptionalInteger(value: unknown, path: string, message: string): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return [{ path, message }]
  }

  return []
}

function validateOptionalIntegerInRange(
  value: unknown,
  path: string,
  min: number,
  max: number
): ValidationIssue[] {
  const issues = validateOptionalInteger(
    value,
    path,
    `Field must be an integer from ${min} to ${max}.`
  )
  if (typeof value === 'number' && Number.isInteger(value) && (value < min || value > max)) {
    issues.push({ path, message: `Field must be from ${min} to ${max}.` })
  }
  return issues
}

function validateOptionalNonEmptyString(value: unknown, path: string): ValidationIssue[] {
  return validateOptionalString(value, path, {
    minLength: 1,
    trim: true,
    valueMessage: 'Field must be a non-empty string when provided.'
  })
}

function requireWriteObject(
  value: unknown,
  path: string,
  label: string
): Record<string, unknown> | null {
  if (isRecord(value)) {
    return value
  }

  void path
  void label
  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!isPlainObject(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function isLibraryRelationKind(value: unknown): value is LibraryRelationKind {
  return typeof value === 'string' && LIBRARY_RELATION_KINDS.includes(value as LibraryRelationKind)
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

function throwIfValidationIssues(label: string, issues: readonly ValidationIssue[]): void {
  if (issues.length === 0) {
    return
  }

  throw createValidationError(`${label} is invalid:\n${formatValidationIssues(issues)}`, {
    issues: issues.map((issue) => ({
      path: issue.path,
      message: issue.message
    }))
  })
}

function formatValidationIssues(issues: readonly ValidationIssue[]): string {
  return issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n')
}
