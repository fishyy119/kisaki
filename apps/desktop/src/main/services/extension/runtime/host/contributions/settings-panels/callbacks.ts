import { randomUUID } from 'node:crypto'
import {
  readErrorCode,
  readErrorDetails,
  type SerializableRecord,
  type SettingsPanelCallbackResult,
  type SettingsPanelContribution,
  type SettingsPanelInvokeRequest,
  validateSettingsPanelDialogButtonResult,
  validateSettingsPanelDialogCommitResult,
  validateSettingsPanelPopoverActionResult,
  validateSettingsPanelRootButtonResult,
  validateSettingsPanelRootCommitResult
} from '@kisaki/extension-api'
import { formatValidationIssues } from '../shared'
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
import type { NormalizeSettingsPanelContext, SettingsPanelCallbackKind } from './types'
import {
  compactRecord,
  createSettingsPanelError,
  normalizeSettingsPanelExtensionValue,
  validateCommitValue
} from './values'

type SettingsPanelNodeCallback = (
  event: Record<string, unknown>
) => Promise<SettingsPanelCallbackResult> | SettingsPanelCallbackResult

export function registerSettingsPanelCallback(
  fieldId: string,
  nodeId: string,
  kind: SettingsPanelCallbackKind,
  context: NormalizeSettingsPanelContext,
  callback: SettingsPanelNodeCallback,
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
          return Promise.resolve(createSettingsPanelError(valueIssue, 'validation_failure'))
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
  callback: SettingsPanelNodeCallback,
  kind: SettingsPanelCallbackKind,
  contribution: SettingsPanelContribution<any, any>,
  fieldId: string,
  nodeId: string,
  request: Extract<SettingsPanelInvokeRequest, { surface: 'root' }>,
  signal: AbortSignal
): Promise<SettingsPanelCallbackResult> {
  if (kind === 'commit') {
    return invokeSettingsPanelCallback(
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
      validateSettingsPanelRootCommitResult
    )
  }

  return invokeSettingsPanelCallback(
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
      validateSettingsPanelRootButtonResult(value, {
        dialogIds: Object.keys(contribution.dialogs ?? {}),
        popoverIds: Object.keys(contribution.popovers ?? {})
      })
  )
}

function invokeDialogCallback(
  extensionId: string,
  label: string,
  callback: SettingsPanelNodeCallback,
  kind: SettingsPanelCallbackKind,
  contribution: SettingsPanelContribution<any, any>,
  params: SerializableRecord,
  fieldId: string,
  nodeId: string,
  request: Extract<SettingsPanelInvokeRequest, { surface: 'dialog' }>,
  signal: AbortSignal
): Promise<SettingsPanelCallbackResult> {
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
    return invokeSettingsPanelCallback(
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
      validateSettingsPanelDialogCommitResult
    )
  }

  return invokeSettingsPanelCallback(
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
      validateSettingsPanelDialogButtonResult(value, {
        popoverIds: Object.keys(contribution.popovers ?? {})
      })
  )
}

function invokePopoverCallback(
  extensionId: string,
  label: string,
  callback: SettingsPanelNodeCallback,
  kind: SettingsPanelCallbackKind,
  params: SerializableRecord,
  fieldId: string,
  nodeId: string,
  request: Extract<SettingsPanelInvokeRequest, { surface: 'popover' }>,
  signal: AbortSignal
): Promise<SettingsPanelCallbackResult> {
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

  return invokeSettingsPanelCallback(
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
    validateSettingsPanelPopoverActionResult
  )
}

export async function invokeSettingsPanelCallback(
  extensionId: string,
  label: string,
  callback: () => Promise<SettingsPanelCallbackResult> | SettingsPanelCallbackResult,
  validate: (value: unknown) => readonly { path: string; message: string }[]
): Promise<SettingsPanelCallbackResult> {
  try {
    const result = normalizeSettingsPanelExtensionValue(await callback(), label)
    const issues = validate(result)
    if (issues.length > 0) {
      console.warn(
        `[ExtensionHost][${extensionId}] ${label} returned an invalid settings result:\n${formatValidationIssues(
          issues
        )}`
      )
      return createSettingsPanelError(
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
    return createSettingsPanelError(
      error instanceof Error ? error.message : 'Extension settings callback failed.',
      readErrorCode(error) ?? 'internal',
      readErrorDetails(error)
    )
  }
}
