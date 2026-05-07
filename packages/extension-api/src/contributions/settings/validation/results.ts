import { validateExtensionErrorShape } from '../../../shared/errors'
import type { ValidationIssue } from '../../../shared/validation'
import {
  isPlainObject,
  prefixIssues,
  validateOptionalBoolean,
  validateOptionalEnumString,
  validateOptionalString,
  validateRequiredBoolean,
  validateRequiredEnumString,
  validateRequiredString,
  validateSerializableRecord,
  validateUnknownKeys
} from '../../../shared/validation'
import {
  DIALOG_TARGET_KEYS,
  POPOVER_TARGET_KEYS,
  RESULT_FAILURE_KEYS,
  type ResultCapability
} from './constants'

type SettingsKnownTargetIds = ReadonlySet<string> | readonly string[]

interface SettingsResultTargetValidationContext {
  dialogIds?: SettingsKnownTargetIds
  popoverIds?: SettingsKnownTargetIds
}

export function validateSettingsRootCommitResult(value: unknown): ValidationIssue[] {
  return validateSettingsResultLike(value, {
    allowedRefreshTargets: ['self', 'root', 'all'],
    allowClosePopover: true
  })
}

export function validateSettingsDialogCommitResult(value: unknown): ValidationIssue[] {
  return validateSettingsResultLike(value, {
    allowedRefreshTargets: ['self', 'dialog', 'root', 'all'],
    allowClosePopover: true
  })
}

export function validateSettingsPopoverActionResult(value: unknown): ValidationIssue[] {
  return validateSettingsResultLike(value, {
    allowedRefreshTargets: ['self', 'popover', 'dialog', 'root', 'all'],
    allowClosePopover: true
  })
}

export function validateSettingsPopoverCommitResult(value: unknown): ValidationIssue[] {
  return validateSettingsPopoverActionResult(value)
}

export function validateSettingsPopoverButtonResult(value: unknown): ValidationIssue[] {
  return validateSettingsPopoverActionResult(value)
}

export function validateSettingsRootButtonResult(
  value: unknown,
  targets?: {
    dialogIds?: ReadonlySet<string> | readonly string[]
    popoverIds?: ReadonlySet<string> | readonly string[]
  }
): ValidationIssue[] {
  return validateSettingsResultLike(
    value,
    {
      allowedRefreshTargets: ['self', 'root', 'all'],
      allowClosePopover: true,
      allowOpenDialog: true,
      allowOpenPopover: true,
      allowedCloseTargets: ['root']
    },
    targets
  )
}

export function validateSettingsDialogButtonResult(
  value: unknown,
  targets?: {
    popoverIds?: ReadonlySet<string> | readonly string[]
  }
): ValidationIssue[] {
  return validateSettingsResultLike(
    value,
    {
      allowedRefreshTargets: ['self', 'dialog', 'root', 'all'],
      allowClosePopover: true,
      allowOpenPopover: true,
      allowedCloseTargets: ['dialog'],
      allowClosePopoverWithClose: true
    },
    targets
  )
}

export function validateSettingsRootSubmitResult(value: unknown): ValidationIssue[] {
  return validateSettingsResultLike(value, {
    allowedRefreshTargets: ['self', 'root', 'all'],
    allowClosePopover: true,
    allowedCloseTargets: ['root'],
    allowClosePopoverWithClose: true
  })
}

export function validateSettingsDialogSubmitResult(value: unknown): ValidationIssue[] {
  return validateSettingsResultLike(value, {
    allowedRefreshTargets: ['self', 'dialog', 'root', 'all'],
    allowClosePopover: true,
    allowedCloseTargets: ['dialog'],
    allowClosePopoverWithClose: true
  })
}

function validateSettingsResultLike(
  value: unknown,
  capability: ResultCapability,
  targets?: SettingsResultTargetValidationContext
): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path: '$', message: 'Settings result must be an object.' }]
  }

  const issues = [
    ...validateRequiredBoolean(value.success, '$.success').map((issue) => ({
      ...issue,
      message: 'success must be a boolean.'
    }))
  ]

  if (value.success === false) {
    issues.push(...validateSettingsFailureResult(value, capability))
    return issues
  }

  issues.push(...validateSettingsSuccessResult(value, capability, targets))
  return issues
}

function validateSettingsFailureResult(
  value: Record<string, unknown>,
  capability: ResultCapability
): ValidationIssue[] {
  const issues = [
    ...validateUnknownKeys(value, RESULT_FAILURE_KEYS),
    ...validateOptionalBoolean(value.closePopover, '$.closePopover').map((issue) => ({
      ...issue,
      message: 'closePopover must be a boolean when provided.'
    })),
    ...validateOptionalEnumString(
      value.refresh,
      '$.refresh',
      capability.allowedRefreshTargets,
      'refresh is not supported for this settings surface.'
    )
  ]

  if (value.error === undefined) {
    issues.push({ path: '$.error', message: 'error is required when success is false.' })
  } else {
    issues.push(...prefixIssues('$.error', validateExtensionErrorShape(value.error)))
  }

  return issues
}

function validateSettingsSuccessResult(
  value: Record<string, unknown>,
  capability: ResultCapability,
  targets?: SettingsResultTargetValidationContext
): ValidationIssue[] {
  const issues = [
    ...validateUnknownKeys(value, createSuccessResultKeySet()),
    ...validateOptionalString(value.message, '$.message', {
      typeMessage: 'message must be a string when provided.'
    })
  ]

  if (value.error !== undefined) {
    issues.push({ path: '$.error', message: 'error is only allowed when success is false.' })
  }

  if (value.closePopover !== undefined) {
    if (capability.allowClosePopover) {
      issues.push(
        ...validateOptionalBoolean(value.closePopover, '$.closePopover').map((issue) => ({
          ...issue,
          message: 'closePopover must be a boolean when provided.'
        }))
      )
    } else {
      issues.push({
        path: '$.closePopover',
        message: 'closePopover is not supported for this settings surface.'
      })
    }
  }

  const hasOpenDialog = value.openDialog !== undefined
  const hasOpenPopover = value.openPopover !== undefined
  const hasClose = value.close !== undefined
  const finalEffectCount = Number(hasOpenDialog) + Number(hasOpenPopover) + Number(hasClose)

  if (finalEffectCount > 1) {
    issues.push({
      path: '$',
      message: 'openDialog, openPopover, and close are mutually exclusive.'
    })
  }

  if (hasOpenDialog) {
    if (!capability.allowOpenDialog) {
      issues.push({
        path: '$.openDialog',
        message: 'openDialog is not supported for this settings surface.'
      })
    }
    issues.push(
      ...validateSettingsDialogTarget(value.openDialog, '$.openDialog', targets?.dialogIds)
    )
  }

  if (hasOpenPopover) {
    if (!capability.allowOpenPopover) {
      issues.push({
        path: '$.openPopover',
        message: 'openPopover is not supported for this settings surface.'
      })
    }
    issues.push(
      ...validateSettingsPopoverTarget(value.openPopover, '$.openPopover', targets?.popoverIds)
    )
  }

  if (hasClose) {
    const closeTargets = capability.allowedCloseTargets ?? []
    if (closeTargets.length === 0) {
      issues.push({
        path: '$.close',
        message: 'close is not supported for this settings surface.'
      })
    } else {
      issues.push(
        ...validateRequiredEnumString(
          value.close,
          '$.close',
          closeTargets,
          `close must be ${closeTargets.join(' or ')}.`
        )
      )
    }

    if (value.closePopover !== undefined && !capability.allowClosePopoverWithClose) {
      issues.push({
        path: '$.closePopover',
        message: 'closePopover cannot be combined with close for this settings surface.'
      })
    }
  }

  if (value.refresh !== undefined) {
    issues.push(
      ...validateRequiredEnumString(
        value.refresh,
        '$.refresh',
        capability.allowedRefreshTargets,
        'refresh is not supported for this settings surface.'
      )
    )

    if (hasOpenDialog || hasOpenPopover || hasClose) {
      issues.push({
        path: '$.refresh',
        message: 'refresh cannot be combined with openDialog, openPopover, or close.'
      })
    }
  }

  return issues
}

function validateSettingsDialogTarget(
  value: unknown,
  path: string,
  knownDialogIds?: SettingsKnownTargetIds
): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path, message: 'openDialog must be an object.' }]
  }

  const issues = [
    ...validateUnknownKeys(value, DIALOG_TARGET_KEYS, path),
    ...validateRequiredString(value.dialogId, `${path}.dialogId`, {
      trim: true,
      valueMessage: 'dialogId must be a non-empty string.'
    })
  ]

  if (value.params !== undefined) {
    issues.push(...validateSerializableRecord(value.params, `${path}.params`))
  }

  issues.push(
    ...validateKnownTargetId(
      value.dialogId,
      `${path}.dialogId`,
      knownDialogIds,
      'dialogId must reference a registered settings dialog.'
    )
  )

  return issues
}

function validateSettingsPopoverTarget(
  value: unknown,
  path: string,
  knownPopoverIds?: SettingsKnownTargetIds
): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path, message: 'openPopover must be an object.' }]
  }

  const issues = [
    ...validateUnknownKeys(value, POPOVER_TARGET_KEYS, path),
    ...validateRequiredString(value.popoverId, `${path}.popoverId`, {
      trim: true,
      valueMessage: 'popoverId must be a non-empty string.'
    })
  ]

  if (value.params !== undefined) {
    issues.push(...validateSerializableRecord(value.params, `${path}.params`))
  }

  issues.push(
    ...validateKnownTargetId(
      value.popoverId,
      `${path}.popoverId`,
      knownPopoverIds,
      'popoverId must reference a registered settings popover.'
    )
  )

  return issues
}

function validateKnownTargetId(
  value: unknown,
  path: string,
  knownIds: SettingsKnownTargetIds | undefined,
  message: string
): ValidationIssue[] {
  if (knownIds === undefined || typeof value !== 'string' || value.trim().length === 0) {
    return []
  }

  if (hasKnownTargetId(knownIds, value)) {
    return []
  }

  return [{ path, message }]
}

function hasKnownTargetId(knownIds: SettingsKnownTargetIds, id: string): boolean {
  return 'has' in knownIds ? knownIds.has(id) : knownIds.includes(id)
}

function createSuccessResultKeySet(): ReadonlySet<string> {
  return new Set<string>([
    'success',
    'message',
    'error',
    'refresh',
    'closePopover',
    'openDialog',
    'openPopover',
    'close'
  ])
}
