import { randomUUID } from 'node:crypto'
import {
  readErrorCode,
  readErrorDetails,
  type SerializableRecord,
  type SettingsCallbackResult,
  type SettingsContribution,
  type SettingsInvokeRequest,
  validateSettingsDialogButtonResult,
  validateSettingsDialogCommitResult,
  validateSettingsPopoverActionResult,
  validateSettingsRootButtonResult,
  validateSettingsRootCommitResult
} from '@kisaki/extension-api'
import { formatValidationIssues } from '../types'
import {
  createDialogButtonHelpers,
  createDialogCommitHelpers,
  createDialogContext,
  createPopoverActionHelpers,
  createPopoverContext,
  createRootButtonHelpers,
  createRootCommitHelpers,
  createRootContext
} from './context'
import type { NormalizeSettingsContext, SettingsCallbackKind } from './types'
import { compactRecord, createSettingsError, validateCommitValue } from './values'

type SettingsNodeCallback = (
  event: Record<string, unknown>
) => Promise<SettingsCallbackResult> | SettingsCallbackResult

export function registerSettingsCallback(
  fieldId: string,
  nodeId: string,
  kind: SettingsCallbackKind,
  context: NormalizeSettingsContext,
  callback: SettingsNodeCallback,
  valueKind?: string
): string {
  const callbackId = randomUUID()
  context.surface.callbacks.set(callbackId, {
    kind,
    fieldId,
    nodeId,
    invoke: (request, signal) => {
      if (kind === 'commit') {
        const valueIssue = validateCommitValue(valueKind, request.value)
        if (valueIssue) {
          return Promise.resolve(createSettingsError(valueIssue, 'validation_failure'))
        }
      }

      const label = `Settings callback "${context.contribution.id}:${context.surface.surface}:${nodeId}"`

      if (request.surface === 'root') {
        return invokeRootCallback(
          context.extensionId,
          label,
          callback,
          kind,
          context.contribution,
          fieldId,
          nodeId,
          request,
          signal
        )
      }

      if (request.surface === 'dialog') {
        return invokeDialogCallback(
          context.extensionId,
          label,
          callback,
          kind,
          context.contribution,
          context.surface.params,
          fieldId,
          nodeId,
          request,
          signal
        )
      }

      return invokePopoverCallback(
        context.extensionId,
        label,
        callback,
        kind,
        context.surface.params,
        fieldId,
        nodeId,
        request,
        signal
      )
    }
  })
  return callbackId
}

function invokeRootCallback(
  extensionId: string,
  label: string,
  callback: SettingsNodeCallback,
  kind: SettingsCallbackKind,
  contribution: SettingsContribution<any, any>,
  fieldId: string,
  nodeId: string,
  request: Extract<SettingsInvokeRequest, { surface: 'root' }>,
  signal: AbortSignal
): Promise<SettingsCallbackResult> {
  if (kind === 'commit') {
    return invokeSettingsCallback(
      extensionId,
      label,
      () =>
        callback({
          ...createRootContext(request.contributionId, request.sessionId, request.draft, signal),
          ...createRootCommitHelpers(),
          fieldId,
          nodeId,
          value: request.value
        }),
      validateSettingsRootCommitResult
    )
  }

  return invokeSettingsCallback(
    extensionId,
    label,
    () =>
      callback({
        ...createRootContext(request.contributionId, request.sessionId, request.draft, signal),
        ...createRootButtonHelpers(),
        fieldId,
        nodeId
      }),
    (value) =>
      validateSettingsRootButtonResult(value, {
        dialogIds: Object.keys(contribution.dialogs ?? {}),
        popoverIds: Object.keys(contribution.popovers ?? {})
      })
  )
}

function invokeDialogCallback(
  extensionId: string,
  label: string,
  callback: SettingsNodeCallback,
  kind: SettingsCallbackKind,
  contribution: SettingsContribution<any, any>,
  params: SerializableRecord,
  fieldId: string,
  nodeId: string,
  request: Extract<SettingsInvokeRequest, { surface: 'dialog' }>,
  signal: AbortSignal
): Promise<SettingsCallbackResult> {
  const context = createDialogContext(
    request.contributionId,
    request.sessionId,
    request.dialogId,
    params,
    request.draft,
    request.parentDraft,
    signal
  )

  if (kind === 'commit') {
    return invokeSettingsCallback(
      extensionId,
      label,
      () =>
        callback({
          ...context,
          ...createDialogCommitHelpers(),
          fieldId,
          nodeId,
          value: request.value
        }),
      validateSettingsDialogCommitResult
    )
  }

  return invokeSettingsCallback(
    extensionId,
    label,
    () =>
      callback({
        ...context,
        ...createDialogButtonHelpers(),
        fieldId,
        nodeId
      }),
    (value) =>
      validateSettingsDialogButtonResult(value, {
        popoverIds: Object.keys(contribution.popovers ?? {})
      })
  )
}

function invokePopoverCallback(
  extensionId: string,
  label: string,
  callback: SettingsNodeCallback,
  kind: SettingsCallbackKind,
  params: SerializableRecord,
  fieldId: string,
  nodeId: string,
  request: Extract<SettingsInvokeRequest, { surface: 'popover' }>,
  signal: AbortSignal
): Promise<SettingsCallbackResult> {
  const context = createPopoverContext(
    request.contributionId,
    request.sessionId,
    request.popoverId,
    request.parent,
    params,
    request.draft,
    request.parentDraft,
    signal
  )

  return invokeSettingsCallback(
    extensionId,
    label,
    () =>
      callback(
        compactRecord({
          ...context,
          ...createPopoverActionHelpers(),
          fieldId,
          nodeId,
          value: kind === 'commit' ? request.value : undefined
        })
      ),
    validateSettingsPopoverActionResult
  )
}

export async function invokeSettingsCallback(
  extensionId: string,
  label: string,
  callback: () => Promise<SettingsCallbackResult> | SettingsCallbackResult,
  validate: (value: unknown) => readonly { path: string; message: string }[]
): Promise<SettingsCallbackResult> {
  try {
    const result = await callback()
    const issues = validate(result)
    if (issues.length > 0) {
      console.warn(
        `[ExtensionHost][${extensionId}] ${label} returned an invalid settings result:\n${formatValidationIssues(
          issues
        )}`
      )
      return createSettingsError(
        'Extension settings callback returned an invalid result.',
        'validation_failure',
        {
          issues: issues.map((issue) => ({
            path: issue.path,
            message: issue.message
          }))
        }
      )
    }

    return result
  } catch (error) {
    console.warn(`[ExtensionHost][${extensionId}] ${label} failed:`, error)
    return createSettingsError(
      error instanceof Error ? error.message : 'Extension settings callback failed.',
      readErrorCode(error) ?? 'internal',
      readErrorDetails(error)
    )
  }
}
