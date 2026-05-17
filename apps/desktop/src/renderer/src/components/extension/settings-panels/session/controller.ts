import { computed, isRef, onBeforeUnmount, ref, toRaw, watch, type Ref } from 'vue'
import { ipcManager } from '@renderer/core/ipc'
import { notify } from '@renderer/core/notify'
import type {
  SerializableRecord,
  SerializableValue,
  SettingsPanelCallbackResult
} from '@kisaki/extension-api'
import type {
  ExtensionResolvedSettingsPanelNode,
  ExtensionSettingsPanelCallbackResponse,
  ExtensionSettingsPanelRegistrationInfo,
  ExtensionSettingsPanelInvokeRequest,
  ExtensionSettingsPanelOpenRequest,
  ExtensionSettingsPanelOpenResponse,
  ExtensionSettingsPanelParentRef,
  ExtensionSettingsPanelRefreshRequest,
  ExtensionSettingsPanelRefreshResponse,
  ExtensionSettingsPanelSession,
  ExtensionSettingsPanelReleaseRequest,
  ExtensionSettingsPanelSubmitRequest,
  ExtensionSettingsPanelSurface
} from '@shared/extension'
import { createSurfaceState, getSurfaceKey, mergeSurfaceState } from './surface-state'
import type {
  ExtensionSettingsPanelSessionController,
  SettingsPanelInvokeSource,
  SettingsPanelSurfaceState
} from './types'
import { createLogger } from '@renderer/core/log'

const log = createLogger('Extension')

interface SettingsPanelSessionOptions {
  available?: Ref<boolean>
  registrationRevision?: Ref<number>
}

export function useExtensionSettingsPanelSession(
  contribution: Ref<ExtensionSettingsPanelRegistrationInfo>,
  open: Ref<boolean>,
  options: SettingsPanelSessionOptions = {}
): ExtensionSettingsPanelSessionController {
  const session = ref<ExtensionSettingsPanelSession | null>(null)
  const root = ref<SettingsPanelSurfaceState<'root'> | null>(null)
  const activeDialog = ref<SettingsPanelSurfaceState<'dialog'> | null>(null)
  const activeRootPopover = ref<SettingsPanelSurfaceState<'popover'> | null>(null)
  const activeDialogPopover = ref<SettingsPanelSurfaceState<'popover'> | null>(null)
  const opening = ref(false)
  const error = ref<string | null>(null)
  const busyCallbacks = ref<Set<string>>(new Set())
  const submittingSurfaces = ref<Set<string>>(new Set())
  const callbackRequestIds = new Map<string, string>()
  const submitRequestIds = new Map<string, string>()
  let openRequestId = 0

  const busy = computed(
    () => opening.value || busyCallbacks.value.size > 0 || submittingSurfaces.value.size > 0
  )

  const stopRefreshListener = ipcManager.on(
    'extension:settings-panels-refresh-requested',
    (_event, event) => {
      if (!open.value || !session.value) {
        return
      }

      if (
        event.extensionId !== contribution.value.extensionId ||
        event.contributionId !== contribution.value.contributionId
      ) {
        return
      }

      void refresh('all', event.reason).catch((e) => {
        notify.error('刷新扩展设置失败', getErrorMessage(e))
      })
    }
  )

  watch(
    [
      open,
      () => options.available?.value ?? true,
      () => contribution.value.extensionId,
      () => contribution.value.contributionId,
      () => options.registrationRevision?.value ?? 0
    ],
    ([isOpen], oldValue) => {
      const wasOpen = oldValue?.[0]
      const isAvailable = options.available?.value ?? true

      if (!isOpen) {
        if (wasOpen) {
          releaseAll()
        }
        opening.value = false
        return
      }

      if (isAvailable) {
        void openRoot()
      } else {
        suspendForReload()
      }
    },
    { immediate: true }
  )

  onBeforeUnmount(() => {
    openRequestId += 1
    stopRefreshListener()
    releaseAll()
  })

  async function openRoot(): Promise<void> {
    const requestId = ++openRequestId
    releaseAll(false)
    opening.value = true
    error.value = null

    try {
      const response = await invokeIpc<ExtensionSettingsPanelOpenResponse>(
        'extension:open-settings-panel',
        {
          surface: 'root',
          extensionId: contribution.value.extensionId,
          contributionId: contribution.value.contributionId
        }
      )

      if (requestId !== openRequestId || !open.value || response.surface !== 'root') {
        if (response.surface === 'root') {
          void releaseSession({
            ...response.session,
            surface: 'all'
          })
        }
        return
      }

      session.value = response.session
      root.value = createSurfaceState('root', response.view)
    } catch (e) {
      if (requestId === openRequestId) {
        error.value = getErrorMessage(e)
      }
    } finally {
      if (requestId === openRequestId) {
        opening.value = false
      }
    }
  }

  function suspendForReload(): void {
    releaseAll(true, { releaseHostSession: false })
    opening.value = true
    error.value = null
  }

  async function retry(): Promise<void> {
    await openRoot()
  }

  function closeRoot(): void {
    open.value = false
  }

  async function closeDialog(): Promise<void> {
    const dialog = activeDialog.value
    if (!dialog || !session.value) {
      return
    }

    await closePopover({ surface: 'dialog', dialogId: dialog.view.dialogId })
    activeDialog.value = null
    await releaseSession({
      ...session.value,
      surface: 'dialog',
      dialogId: dialog.view.dialogId
    })
  }

  async function closePopover(parent: ExtensionSettingsPanelParentRef): Promise<void> {
    const popover = parent.surface === 'root' ? activeRootPopover.value : activeDialogPopover.value
    if (!popover || !session.value) {
      return
    }

    if (parent.surface === 'root') {
      activeRootPopover.value = null
    } else {
      activeDialogPopover.value = null
    }

    await releaseSession({
      ...session.value,
      surface: 'popover',
      parent,
      popoverId: popover.view.popoverId
    })
  }

  function updateValue(
    surface: SettingsPanelSurfaceState<ExtensionSettingsPanelSurface>,
    nodeId: string,
    value: SerializableValue
  ): void {
    const nextDirtyNodeIds = surface.draft.dirtyNodeIds.includes(nodeId)
      ? surface.draft.dirtyNodeIds
      : [...surface.draft.dirtyNodeIds, nodeId]

    surface.draft = {
      values: {
        ...surface.draft.values,
        [nodeId]: value
      },
      dirtyNodeIds: nextDirtyNodeIds
    }
  }

  async function invokeNode(
    source: SettingsPanelInvokeSource<ExtensionSettingsPanelSurface>
  ): Promise<void> {
    const callbackId = getSettingsNodeCallbackId(source.node)
    if (!callbackId || !session.value) {
      return
    }

    const requestId = createRequestId()
    const requestRevision = source.surface.revision
    callbackRequestIds.set(callbackId, requestId)
    setCallbackBusy(callbackId, true)

    try {
      const response = await invokeIpc<ExtensionSettingsPanelCallbackResponse>(
        'extension:invoke-settings-panel-node',
        toInvokeRequest(source, callbackId, requestId)
      )
      if (!isCurrentCallbackRequest(callbackId, requestId, source.surface, requestRevision)) {
        return
      }
      await applyCallbackResult(response.result, source)
    } catch (e) {
      if (isCurrentCallbackRequest(callbackId, requestId, source.surface, requestRevision)) {
        notify.error('扩展设置操作失败', getErrorMessage(e))
      }
    } finally {
      if (callbackRequestIds.get(callbackId) === requestId) {
        callbackRequestIds.delete(callbackId)
        setCallbackBusy(callbackId, false)
      }
    }
  }

  async function submit(surface: SettingsPanelSurfaceState<'root' | 'dialog'>): Promise<void> {
    if (!session.value) {
      return
    }

    const surfaceKey = getSurfaceKey(surface)
    if (submittingSurfaces.value.has(surfaceKey)) {
      return
    }

    const requestId = createRequestId()
    const requestRevision = surface.revision
    submitRequestIds.set(surfaceKey, requestId)
    setSubmitting(surfaceKey, true)
    try {
      const response = await invokeIpc<ExtensionSettingsPanelCallbackResponse>(
        'extension:submit-settings-panel',
        toSubmitRequest(surface)
      )
      if (!isCurrentSubmitRequest(surfaceKey, requestId, surface, requestRevision)) {
        return
      }
      await applyCallbackResult(response.result, {
        surface,
        fieldId: '',
        node: { kind: 'divider', id: '__submit__' }
      })
    } catch (e) {
      if (isCurrentSubmitRequest(surfaceKey, requestId, surface, requestRevision)) {
        notify.error('保存扩展设置失败', getErrorMessage(e))
      }
    } finally {
      if (submitRequestIds.get(surfaceKey) === requestId) {
        submitRequestIds.delete(surfaceKey)
        setSubmitting(surfaceKey, false)
      }
    }
  }

  function isCallbackBusy(callbackId?: string): boolean {
    return !!callbackId && busyCallbacks.value.has(callbackId)
  }

  function getNodeKey(
    surface: SettingsPanelSurfaceState<ExtensionSettingsPanelSurface>,
    fieldId: string,
    nodeId: string
  ): string {
    return `${getSurfaceKey(surface)}:${fieldId}:${nodeId}`
  }

  async function applyCallbackResult(
    result: SettingsPanelCallbackResult,
    source: SettingsPanelInvokeSource<ExtensionSettingsPanelSurface>
  ): Promise<void> {
    if (!result.success) {
      notify.error('扩展设置操作失败', result.error.message)
      if (result.closePopover) {
        await closeSourcePopover(source.surface)
      }
      if (result.refresh) {
        await refresh(result.refresh, undefined, source.surface)
      }
      return
    }

    if (result.message) {
      notify.success(result.message)
    }

    if (result.closePopover) {
      await closeSourcePopover(source.surface)
    }

    if ('openDialog' in result && result.openDialog) {
      await openDialog(result.openDialog.dialogId, result.openDialog.params)
      return
    }

    if ('openPopover' in result && result.openPopover) {
      await openPopover(
        source.surface,
        getNodeKey(source.surface, source.fieldId, source.node.id),
        result.openPopover.popoverId,
        result.openPopover.params
      )
      return
    }

    if ('close' in result && result.close) {
      if (result.close === 'root') {
        closeRoot()
      } else {
        await closeDialog()
      }
      return
    }

    if (result.refresh) {
      await refresh(result.refresh, undefined, source.surface)
    }
  }

  async function openDialog(dialogId: string, params?: SerializableRecord): Promise<void> {
    if (!session.value || !root.value) {
      return
    }

    await closePopover({ surface: 'root' })

    const response = await invokeIpc<ExtensionSettingsPanelOpenResponse>(
      'extension:open-settings-panel',
      {
        ...session.value,
        surface: 'dialog',
        dialogId,
        params,
        parentDraft: root.value.draft,
        revision: root.value.revision
      }
    )

    if (response.surface === 'dialog') {
      if (activeDialog.value) {
        await closeDialog()
      }
      activeDialog.value = createSurfaceState('dialog', response.dialog)
    }
  }

  async function openPopover(
    parentSurface: SettingsPanelSurfaceState<ExtensionSettingsPanelSurface>,
    anchorNodeKey: string,
    popoverId: string,
    params?: SerializableRecord
  ): Promise<void> {
    if (!session.value || parentSurface.surface === 'popover') {
      return
    }

    const parent = toParentRef(parentSurface)
    await closePopover(parent)

    const response = await invokeIpc<ExtensionSettingsPanelOpenResponse>(
      'extension:open-settings-panel',
      {
        ...session.value,
        surface: 'popover',
        popoverId,
        parent,
        params,
        parentDraft: parentSurface.draft,
        anchorNodeKey,
        revision: parentSurface.revision
      }
    )

    if (response.surface !== 'popover') {
      return
    }

    const state = createSurfaceState('popover', response.popover)
    if (parent.surface === 'root') {
      activeRootPopover.value = state
    } else {
      activeDialogPopover.value = state
    }
  }

  async function refresh(
    target: string,
    reason?: ExtensionSettingsPanelRefreshRequest['reason'],
    sourceSurface?: SettingsPanelSurfaceState<ExtensionSettingsPanelSurface>
  ): Promise<void> {
    if (!session.value || !root.value) {
      return
    }

    const normalizedTarget = target === 'self' ? (sourceSurface?.surface ?? 'root') : target
    if (normalizedTarget === 'popover' && sourceSurface?.surface === 'popover') {
      await refreshPopover(sourceSurface, reason)
      return
    }

    if (normalizedTarget === 'dialog') {
      await refreshDialog(reason)
      return
    }

    if (normalizedTarget === 'root') {
      await refreshRoot(reason)
      return
    }

    if (normalizedTarget === 'all') {
      await refreshAll(reason)
      return
    }
  }

  async function refreshRoot(
    reason?: ExtensionSettingsPanelRefreshRequest['reason']
  ): Promise<void> {
    if (!session.value || !root.value) {
      return
    }

    await closePopover({ surface: 'root' })
    const response = await invokeIpc<ExtensionSettingsPanelRefreshResponse>(
      'extension:refresh-settings-panel',
      {
        ...session.value,
        surface: 'root',
        draft: root.value.draft,
        reason,
        revision: root.value.revision
      }
    )

    if (response.surface === 'root') {
      root.value = mergeSurfaceState(root.value, response.view)
    }
  }

  async function refreshDialog(
    reason?: ExtensionSettingsPanelRefreshRequest['reason']
  ): Promise<void> {
    if (!session.value || !root.value || !activeDialog.value) {
      return
    }

    await closePopover({ surface: 'dialog', dialogId: activeDialog.value.view.dialogId })
    const dialog = activeDialog.value
    const response = await invokeIpc<ExtensionSettingsPanelRefreshResponse>(
      'extension:refresh-settings-panel',
      {
        ...session.value,
        surface: 'dialog',
        dialogId: dialog.view.dialogId,
        draft: dialog.draft,
        parentDraft: root.value.draft,
        reason,
        revision: dialog.revision
      }
    )

    if (response.surface === 'dialog') {
      activeDialog.value = mergeSurfaceState(dialog, response.dialog)
    }
  }

  async function refreshPopover(
    popover: SettingsPanelSurfaceState<'popover'>,
    reason?: ExtensionSettingsPanelRefreshRequest['reason']
  ): Promise<void> {
    if (!session.value || !root.value) {
      return
    }

    const parentSurface = getParentSurface(popover.view.parent)
    if (!parentSurface) {
      return
    }

    const response = await invokeIpc<ExtensionSettingsPanelRefreshResponse>(
      'extension:refresh-settings-panel',
      {
        ...session.value,
        surface: 'popover',
        popoverId: popover.view.popoverId,
        parent: popover.view.parent,
        draft: popover.draft,
        parentDraft: parentSurface.draft,
        reason,
        revision: popover.revision
      }
    )

    if (response.surface !== 'popover') {
      return
    }

    const next = mergeSurfaceState(popover, response.popover)
    if (popover.view.parent.surface === 'root') {
      activeRootPopover.value = next
    } else {
      activeDialogPopover.value = next
    }
  }

  async function refreshAll(
    reason?: ExtensionSettingsPanelRefreshRequest['reason']
  ): Promise<void> {
    if (!session.value || !root.value) {
      return
    }

    activeRootPopover.value = null
    activeDialogPopover.value = null

    const response = await invokeIpc<ExtensionSettingsPanelRefreshResponse>(
      'extension:refresh-settings-panel',
      {
        ...session.value,
        surface: 'all',
        rootDraft: root.value.draft,
        activeDialog: activeDialog.value
          ? {
              dialogId: activeDialog.value.view.dialogId,
              draft: activeDialog.value.draft
            }
          : undefined,
        reason,
        revision: root.value.revision
      }
    )

    if (response.surface !== 'all') {
      return
    }

    root.value = mergeSurfaceState(root.value, response.view)
    activeDialog.value =
      response.activeDialog && activeDialog.value
        ? mergeSurfaceState(activeDialog.value, response.activeDialog.dialog)
        : null
  }

  function toInvokeRequest(
    source: SettingsPanelInvokeSource<ExtensionSettingsPanelSurface>,
    callbackId: string,
    requestId: string
  ): ExtensionSettingsPanelInvokeRequest {
    if (!session.value) {
      throw new Error('Settings session is not active.')
    }

    const base = {
      ...session.value,
      callbackId,
      fieldId: source.fieldId,
      nodeId: source.node.id,
      value: source.value,
      requestId,
      revision: source.surface.revision
    }

    if (source.surface.surface === 'root') {
      return {
        ...base,
        surface: 'root',
        draft: source.surface.draft
      }
    }

    if (source.surface.surface === 'dialog') {
      if (!root.value) {
        throw new Error('Settings root is not active.')
      }
      return {
        ...base,
        surface: 'dialog',
        dialogId: source.surface.view.dialogId,
        draft: source.surface.draft,
        parentDraft: root.value.draft
      }
    }

    const parentSurface = getParentSurface(source.surface.view.parent)
    if (!parentSurface) {
      throw new Error('Settings popover parent is not active.')
    }

    return {
      ...base,
      surface: 'popover',
      popoverId: source.surface.view.popoverId,
      parent: source.surface.view.parent,
      draft: source.surface.draft,
      parentDraft: parentSurface.draft
    }
  }

  function toSubmitRequest(
    surface: SettingsPanelSurfaceState<'root' | 'dialog'>
  ): ExtensionSettingsPanelSubmitRequest {
    if (!session.value) {
      throw new Error('Settings session is not active.')
    }

    if (surface.surface === 'root') {
      return {
        ...session.value,
        surface: 'root',
        draft: surface.draft,
        revision: surface.revision
      }
    }

    if (!root.value) {
      throw new Error('Settings root is not active.')
    }

    return {
      ...session.value,
      surface: 'dialog',
      dialogId: surface.view.dialogId,
      draft: surface.draft,
      parentDraft: root.value.draft,
      revision: surface.revision
    }
  }

  function getParentSurface(
    parent: ExtensionSettingsPanelParentRef
  ): SettingsPanelSurfaceState<'root' | 'dialog'> | null {
    if (parent.surface === 'root') {
      return root.value
    }

    if (activeDialog.value?.view.dialogId === parent.dialogId) {
      return activeDialog.value
    }

    return null
  }

  async function closeSourcePopover(
    surface: SettingsPanelSurfaceState<ExtensionSettingsPanelSurface>
  ): Promise<void> {
    if (surface.surface === 'popover') {
      await closePopover(surface.view.parent)
      return
    }

    await closePopover(toParentRef(surface))
  }

  function toParentRef(
    surface: SettingsPanelSurfaceState<'root' | 'dialog'>
  ): ExtensionSettingsPanelParentRef {
    return surface.surface === 'root'
      ? { surface: 'root' }
      : { surface: 'dialog', dialogId: surface.view.dialogId }
  }

  function isCurrentCallbackRequest(
    callbackId: string,
    requestId: string,
    surface: SettingsPanelSurfaceState<ExtensionSettingsPanelSurface>,
    revision: number
  ): boolean {
    return callbackRequestIds.get(callbackId) === requestId && isCurrentSurface(surface, revision)
  }

  function isCurrentSubmitRequest(
    surfaceKey: string,
    requestId: string,
    surface: SettingsPanelSurfaceState<ExtensionSettingsPanelSurface>,
    revision: number
  ): boolean {
    return submitRequestIds.get(surfaceKey) === requestId && isCurrentSurface(surface, revision)
  }

  function isCurrentSurface(
    surface: SettingsPanelSurfaceState<ExtensionSettingsPanelSurface>,
    revision: number
  ): boolean {
    const current = getCurrentSurface(surface)
    return current === surface && current.revision === revision
  }

  function getCurrentSurface(
    surface: SettingsPanelSurfaceState<ExtensionSettingsPanelSurface>
  ): SettingsPanelSurfaceState<ExtensionSettingsPanelSurface> | null {
    if (surface.surface === 'root') {
      return root.value
    }

    if (surface.surface === 'dialog') {
      return activeDialog.value
    }

    return surface.view.parent.surface === 'root'
      ? activeRootPopover.value
      : activeDialogPopover.value
  }

  function setCallbackBusy(callbackId: string, busyValue: boolean): void {
    const next = new Set(busyCallbacks.value)
    if (busyValue) {
      next.add(callbackId)
    } else {
      next.delete(callbackId)
    }
    busyCallbacks.value = next
  }

  function setSubmitting(surfaceKey: string, busyValue: boolean): void {
    const next = new Set(submittingSurfaces.value)
    if (busyValue) {
      next.add(surfaceKey)
    } else {
      next.delete(surfaceKey)
    }
    submittingSurfaces.value = next
  }

  function releaseAll(cancelPending = true, options: { releaseHostSession?: boolean } = {}): void {
    if (cancelPending) {
      openRequestId += 1
    }

    const current = session.value
    session.value = null
    root.value = null
    activeDialog.value = null
    activeRootPopover.value = null
    activeDialogPopover.value = null
    callbackRequestIds.clear()
    submitRequestIds.clear()
    busyCallbacks.value = new Set()
    submittingSurfaces.value = new Set()

    if (current && (options.releaseHostSession ?? true)) {
      void releaseSession({ ...current, surface: 'all' })
    }
  }

  return {
    session,
    root,
    activeDialog,
    activeRootPopover,
    activeDialogPopover,
    opening,
    busy,
    error,
    openRoot,
    closeRoot,
    closeDialog,
    closePopover,
    retry,
    updateValue,
    invokeNode,
    submit,
    isCallbackBusy,
    getNodeKey
  }
}

function getSettingsNodeCallbackId(node: ExtensionResolvedSettingsPanelNode): string | undefined {
  return 'callbackId' in node ? node.callbackId : undefined
}

async function releaseSession(request: ExtensionSettingsPanelReleaseRequest): Promise<void> {
  try {
    await invokeIpc<void>('extension:release-settings-panel', request)
  } catch (e) {
    log.warn('Failed to release settings session:', e)
  }
}

async function invokeIpc<T>(
  channel: 'extension:open-settings-panel',
  request: ExtensionSettingsPanelOpenRequest
): Promise<T>
async function invokeIpc<T>(
  channel: 'extension:refresh-settings-panel',
  request: ExtensionSettingsPanelRefreshRequest
): Promise<T>
async function invokeIpc<T>(
  channel: 'extension:submit-settings-panel',
  request: ExtensionSettingsPanelSubmitRequest
): Promise<T>
async function invokeIpc<T>(
  channel: 'extension:invoke-settings-panel-node',
  request: ExtensionSettingsPanelInvokeRequest
): Promise<T>
async function invokeIpc<T>(
  channel: 'extension:release-settings-panel',
  request: ExtensionSettingsPanelReleaseRequest
): Promise<T>
async function invokeIpc<T>(
  channel:
    | 'extension:open-settings-panel'
    | 'extension:refresh-settings-panel'
    | 'extension:submit-settings-panel'
    | 'extension:invoke-settings-panel-node'
    | 'extension:release-settings-panel',
  request:
    | ExtensionSettingsPanelOpenRequest
    | ExtensionSettingsPanelRefreshRequest
    | ExtensionSettingsPanelSubmitRequest
    | ExtensionSettingsPanelInvokeRequest
    | ExtensionSettingsPanelReleaseRequest
): Promise<T> {
  const result = await ipcManager.invoke(channel, toPlainIpcPayload(request) as never)
  if (result.success) {
    return ('data' in result ? result.data : undefined) as T
  }

  throw new Error(result.error || 'Extension settings panel request failed.')
}

function toPlainIpcPayload<
  T extends
    | ExtensionSettingsPanelOpenRequest
    | ExtensionSettingsPanelRefreshRequest
    | ExtensionSettingsPanelSubmitRequest
    | ExtensionSettingsPanelInvokeRequest
    | ExtensionSettingsPanelReleaseRequest
>(request: T): T {
  return toPlainIpcValue(request, new WeakMap()) as T
}

function toPlainIpcValue(value: unknown, seen: WeakMap<object, unknown>): unknown {
  if (isRef(value)) {
    return toPlainIpcValue(value.value, seen)
  }

  if (value === null || typeof value !== 'object') {
    return value
  }

  const raw = toRaw(value) as object
  const cached = seen.get(raw)
  if (cached) {
    return cached
  }

  if (Array.isArray(raw)) {
    const array: unknown[] = []
    seen.set(raw, array)
    for (const item of raw) {
      array.push(toPlainIpcValue(item, seen))
    }
    return array
  }

  const record: Record<string, unknown> = {}
  seen.set(raw, record)
  for (const [key, entry] of Object.entries(raw)) {
    record[key] = toPlainIpcValue(entry, seen)
  }

  return record
}

function createRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}:${Math.random()}`
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
