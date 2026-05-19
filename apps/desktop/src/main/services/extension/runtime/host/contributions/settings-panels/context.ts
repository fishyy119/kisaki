import type {
  ExtensionErrorShape,
  SerializableRecord,
  SettingsPanelDraftSnapshot,
  SettingsPanelParentRef,
  SettingsPanelRefreshReason
} from '@kisaki/extension-api'
import { compactRecord } from './values'
export function createRootContext(
  contributionId: string,
  sessionId: string,
  draft: SettingsPanelDraftSnapshot,
  signal: AbortSignal,
  reason?: SettingsPanelRefreshReason
) {
  return {
    surface: 'root' as const,
    contributionId,
    sessionId,
    values: draft.values,
    dirtyNodeIds: draft.dirtyNodeIds,
    reason,
    signal
  }
}

export function createDialogContext(
  contributionId: string,
  sessionId: string,
  dialogId: string,
  params: SerializableRecord,
  draft: SettingsPanelDraftSnapshot,
  parentDraft: SettingsPanelDraftSnapshot,
  signal: AbortSignal,
  reason?: SettingsPanelRefreshReason
) {
  return {
    surface: 'dialog' as const,
    contributionId,
    sessionId,
    dialogId,
    params,
    values: draft.values,
    dirtyNodeIds: draft.dirtyNodeIds,
    parentValues: parentDraft.values,
    parentDirtyNodeIds: parentDraft.dirtyNodeIds,
    reason,
    signal
  }
}

export function createPopoverContext(
  contributionId: string,
  sessionId: string,
  popoverId: string,
  parent: SettingsPanelParentRef,
  params: SerializableRecord,
  draft: SettingsPanelDraftSnapshot,
  parentDraft: SettingsPanelDraftSnapshot,
  signal: AbortSignal,
  reason?: SettingsPanelRefreshReason
) {
  return {
    surface: 'popover' as const,
    contributionId,
    sessionId,
    popoverId,
    parent,
    params,
    values: draft.values,
    dirtyNodeIds: draft.dirtyNodeIds,
    parentValues: parentDraft.values,
    parentDirtyNodeIds: parentDraft.dirtyNodeIds,
    reason,
    signal
  }
}

export function createRootChangeHelpers() {
  return {
    success: createSuccess,
    fail: createFailure,
    refresh: createRefresh,
    closePopover: createClosePopover
  }
}

export function createRootButtonHelpers() {
  return {
    ...createRootChangeHelpers(),
    close: createClose,
    openDialog: createOpenDialog,
    openPopover: createOpenPopover
  }
}

export function createRootSubmitHelpers() {
  return {
    ...createRootChangeHelpers(),
    close: createClose
  }
}

export function createDialogChangeHelpers() {
  return {
    success: createSuccess,
    fail: createFailure,
    refresh: createRefresh,
    closePopover: createClosePopover
  }
}

export function createDialogButtonHelpers() {
  return {
    ...createDialogChangeHelpers(),
    close: createClose,
    openPopover: createOpenPopover
  }
}

export function createDialogSubmitHelpers() {
  return {
    ...createDialogChangeHelpers(),
    close: createClose
  }
}

export function createPopoverActionHelpers() {
  return {
    success: createSuccess,
    fail: createFailure,
    refresh: createRefresh,
    closePopover: createClosePopover
  }
}

function createSuccess(options: Record<string, unknown> = {}) {
  return compactRecord({ success: true, ...options })
}

function createFailure(error: ExtensionErrorShape, options: Record<string, unknown> = {}) {
  return compactRecord({ success: false, error, ...options })
}

function createRefresh(target = 'self', options: Record<string, unknown> = {}) {
  return compactRecord({ success: true, ...options, refresh: target })
}

function createClose(target: string, options: Record<string, unknown> = {}) {
  return compactRecord({ success: true, ...options, close: target })
}

function createClosePopover(options: Record<string, unknown> = {}) {
  return compactRecord({ success: true, ...options, closePopover: true })
}

function createOpenDialog(
  dialogId: string,
  params?: SerializableRecord,
  options: Record<string, unknown> = {}
) {
  return compactRecord({
    success: true,
    ...options,
    openDialog: compactRecord({ dialogId, params })
  })
}

function createOpenPopover(
  popoverId: string,
  params?: SerializableRecord,
  options: Record<string, unknown> = {}
) {
  return compactRecord({
    success: true,
    ...options,
    openPopover: compactRecord({ popoverId, params })
  })
}
