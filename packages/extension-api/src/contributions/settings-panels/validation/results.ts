import { validateExtensionErrorShape } from '../../../shared/errors'
import { validateJsonObject } from '../../../shared/json'
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
  validateUnknownKeys
} from '../../../shared/validation'
import {
  DIALOG_TARGET_KEYS,
  POPOVER_TARGET_KEYS,
  RESULT_FAILURE_KEYS,
  type ResultCapability
} from './constants'

type SettingsPanelKnownTargetIds = ReadonlySet<string> | readonly string[]

interface SettingsPanelResultTargetValidationContext {
  dialogIds?: SettingsPanelKnownTargetIds
  popoverIds?: SettingsPanelKnownTargetIds
}

export function validateSettingsPanelRootChangeResult(value: unknown): ValidationIssue[] {
  return validateSettingsPanelResultLike(value, {
    allowedRefreshTargets: ['self', 'root', 'all'],
    allowClosePopover: true
  })
}

export function validateSettingsPanelDialogChangeResult(value: unknown): ValidationIssue[] {
  return validateSettingsPanelResultLike(value, {
    allowedRefreshTargets: ['self', 'dialog', 'root', 'all'],
    allowClosePopover: true
  })
}

export function validateSettingsPanelPopoverActionResult(value: unknown): ValidationIssue[] {
  return validateSettingsPanelResultLike(value, {
    allowedRefreshTargets: ['self', 'popover', 'dialog', 'root', 'all'],
    allowClosePopover: true
  })
}

export function validateSettingsPanelPopoverChangeResult(value: unknown): ValidationIssue[] {
  return validateSettingsPanelPopoverActionResult(value)
}

export function validateSettingsPanelPopoverButtonResult(value: unknown): ValidationIssue[] {
  return validateSettingsPanelPopoverActionResult(value)
}

export function validateSettingsPanelRootButtonResult(
  value: unknown,
  targets?: {
    dialogIds?: ReadonlySet<string> | readonly string[]
    popoverIds?: ReadonlySet<string> | readonly string[]
  }
): ValidationIssue[] {
  return validateSettingsPanelResultLike(
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

export function validateSettingsPanelDialogButtonResult(
  value: unknown,
  targets?: {
    popoverIds?: ReadonlySet<string> | readonly string[]
  }
): ValidationIssue[] {
  return validateSettingsPanelResultLike(
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

export function validateSettingsPanelRootSubmitResult(value: unknown): ValidationIssue[] {
  return validateSettingsPanelResultLike(value, {
    allowedRefreshTargets: ['self', 'root', 'all'],
    allowClosePopover: true,
    allowedCloseTargets: ['root'],
    allowClosePopoverWithClose: true
  })
}

export function validateSettingsPanelDialogSubmitResult(value: unknown): ValidationIssue[] {
  return validateSettingsPanelResultLike(value, {
    allowedRefreshTargets: ['self', 'dialog', 'root', 'all'],
    allowClosePopover: true,
    allowedCloseTargets: ['dialog'],
    allowClosePopoverWithClose: true
  })
}

function validateSettingsPanelResultLike(
  value: unknown,
  capability: ResultCapability,
  targets?: SettingsPanelResultTargetValidationContext
): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path: '$', message: 'Settings panel result must be an object.' }]
  }

  const issues = [
    ...validateRequiredBoolean(value.success, '$.success').map((issue) => ({
      ...issue,
      message: 'success must be a boolean.'
    }))
  ]

  if (value.success === false) {
    issues.push(...validateSettingsPanelFailureResult(value, capability))
    return issues
  }

  issues.push(...validateSettingsPanelSuccessResult(value, capability, targets))
  return issues
}

function validateSettingsPanelFailureResult(
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
      'refresh is not supported for this settings panel surface.'
    )
  ]

  if (value.error === undefined) {
    issues.push({ path: '$.error', message: 'error is required when success is false.' })
  } else {
    issues.push(...prefixIssues('$.error', validateExtensionErrorShape(value.error)))
  }

  return issues
}

function validateSettingsPanelSuccessResult(
  value: Record<string, unknown>,
  capability: ResultCapability,
  targets?: SettingsPanelResultTargetValidationContext
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
        message: 'closePopover is not supported for this settings panel surface.'
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
        message: 'openDialog is not supported for this settings panel surface.'
      })
    }
    issues.push(
      ...validateSettingsPanelDialogTarget(value.openDialog, '$.openDialog', targets?.dialogIds)
    )
  }

  if (hasOpenPopover) {
    if (!capability.allowOpenPopover) {
      issues.push({
        path: '$.openPopover',
        message: 'openPopover is not supported for this settings panel surface.'
      })
    }
    issues.push(
      ...validateSettingsPanelPopoverTarget(value.openPopover, '$.openPopover', targets?.popoverIds)
    )
  }

  if (hasClose) {
    const closeTargets = capability.allowedCloseTargets ?? []
    if (closeTargets.length === 0) {
      issues.push({
        path: '$.close',
        message: 'close is not supported for this settings panel surface.'
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
        message: 'closePopover cannot be combined with close for this settings panel surface.'
      })
    }
  }

  if (value.refresh !== undefined) {
    issues.push(
      ...validateRequiredEnumString(
        value.refresh,
        '$.refresh',
        capability.allowedRefreshTargets,
        'refresh is not supported for this settings panel surface.'
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

function validateSettingsPanelDialogTarget(
  value: unknown,
  path: string,
  knownDialogIds?: SettingsPanelKnownTargetIds
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
    issues.push(...validateJsonObject(value.params, `${path}.params`))
  }

  issues.push(
    ...validateKnownTargetId(
      value.dialogId,
      `${path}.dialogId`,
      knownDialogIds,
      'dialogId must reference a registered settings panel dialog.'
    )
  )

  return issues
}

function validateSettingsPanelPopoverTarget(
  value: unknown,
  path: string,
  knownPopoverIds?: SettingsPanelKnownTargetIds
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
    issues.push(...validateJsonObject(value.params, `${path}.params`))
  }

  issues.push(
    ...validateKnownTargetId(
      value.popoverId,
      `${path}.popoverId`,
      knownPopoverIds,
      'popoverId must reference a registered settings panel popover.'
    )
  )

  return issues
}

function validateKnownTargetId(
  value: unknown,
  path: string,
  knownIds: SettingsPanelKnownTargetIds | undefined,
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

function hasKnownTargetId(knownIds: SettingsPanelKnownTargetIds, id: string): boolean {
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
