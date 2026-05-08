import { computed, onBeforeUnmount, ref, watch, type ComputedRef, type Ref } from 'vue'
import { ipcManager } from '@renderer/core/ipc'
import { notify } from '@renderer/core/notify'
import type { MenuInput } from '@kisaki/extension-api'
import type {
  ExtensionMenuInvokeRequest,
  ExtensionMenuInvokeResponse,
  ExtensionMenuReleaseRequest,
  ExtensionMenuResolveRequest,
  ExtensionResolvedMenu,
  ExtensionResolvedMenuGroup,
  ExtensionResolvedMenuNode
} from '@shared/extension'

export interface ExtensionMenuSessionController {
  resolvedMenu: Ref<ExtensionResolvedMenu | null>
  loading: Ref<boolean>
  error: Ref<string | null>
  invokingKey: Ref<string | null>
  visibleGroups: ComputedRef<readonly ExtensionResolvedMenuGroup[]>
  hasContent: ComputedRef<boolean>
  resolveMenu: () => Promise<void>
  invokeNode: (
    group: ExtensionResolvedMenuGroup,
    node: ExtensionResolvedMenuNode,
    nodePath: readonly string[],
    value?: boolean | string
  ) => Promise<void>
  isInvoking: (group: ExtensionResolvedMenuGroup, nodePath: readonly string[]) => boolean
  releaseCurrentSession: () => void
}

export function useExtensionMenuSession(
  input: Ref<MenuInput>,
  enabled: Ref<boolean>
): ExtensionMenuSessionController {
  const resolvedMenu = ref<ExtensionResolvedMenu | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const invokingKey = ref<string | null>(null)
  let resolveRequestId = 0

  const inputKey = computed(() => getMenuInputKey(input.value))
  const visibleGroups = computed(() =>
    (resolvedMenu.value?.groups ?? [])
      .map((group) => ({
        ...group,
        nodes: group.nodes.filter((node) => node.kind === 'separator' || !node.hidden)
      }))
      .filter((group) => group.nodes.length > 0)
  )
  const hasContent = computed(
    () =>
      visibleGroups.value.length > 0 ||
      loading.value ||
      !!error.value ||
      (resolvedMenu.value?.errors.length ?? 0) > 0
  )

  const stopRefreshListener = ipcManager.on(
    'extension:menus-refresh-requested',
    (_event, event) => {
      if (!enabled.value || !resolvedMenu.value) {
        return
      }

      if (event.domain === input.value.domain && event.scope === input.value.scope) {
        void resolveMenu()
      }
    }
  )

  watch(
    [enabled, inputKey],
    ([isEnabled]) => {
      if (!isEnabled) {
        resolveRequestId += 1
        releaseCurrentSession()
        reset()
        return
      }

      void resolveMenu()
    },
    { immediate: true }
  )

  onBeforeUnmount(() => {
    resolveRequestId += 1
    stopRefreshListener()
    releaseCurrentSession()
  })

  async function resolveMenu(): Promise<void> {
    const requestId = ++resolveRequestId
    releaseCurrentSession()
    loading.value = true
    error.value = null
    resolvedMenu.value = null

    try {
      const menu = await invokeIpc<ExtensionResolvedMenu>('extension:resolve-menu', {
        input: input.value
      })

      if (requestId === resolveRequestId && enabled.value) {
        resolvedMenu.value = menu
      } else {
        releaseSession(menu.sessionId)
      }
    } catch (e) {
      if (requestId === resolveRequestId && enabled.value) {
        error.value = getErrorMessage(e)
      }
    } finally {
      if (requestId === resolveRequestId) {
        loading.value = false
      }
    }
  }

  async function invokeNode(
    group: ExtensionResolvedMenuGroup,
    node: ExtensionResolvedMenuNode,
    nodePath: readonly string[],
    value?: boolean | string
  ): Promise<void> {
    if (!enabled.value || node.kind === 'separator' || node.kind === 'submenu') {
      return
    }

    const menu = resolvedMenu.value
    if (!menu) {
      return
    }

    const callbackKey = getCallbackKey(group, nodePath)
    invokingKey.value = callbackKey

    try {
      const response = await invokeIpc<ExtensionMenuInvokeResponse>('extension:invoke-menu', {
        sessionId: menu.sessionId,
        extensionId: group.extensionId,
        contributionId: group.contributionId,
        nodePath,
        input: input.value,
        value
      })

      if (!response.result.success) {
        notify.error('扩展菜单操作失败', response.result.error.message)
      }

      if (response.result.refresh) {
        await resolveMenu()
      }
    } catch (e) {
      notify.error('扩展菜单操作失败', getErrorMessage(e))
    } finally {
      invokingKey.value = null
    }
  }

  function isInvoking(group: ExtensionResolvedMenuGroup, nodePath: readonly string[]): boolean {
    return invokingKey.value === getCallbackKey(group, nodePath)
  }

  function releaseCurrentSession(): void {
    const sessionId = resolvedMenu.value?.sessionId
    resolvedMenu.value = null

    if (sessionId) {
      releaseSession(sessionId)
    }
  }

  function reset(): void {
    resolvedMenu.value = null
    loading.value = false
    error.value = null
    invokingKey.value = null
  }

  return {
    resolvedMenu,
    loading,
    error,
    invokingKey,
    visibleGroups,
    hasContent,
    resolveMenu,
    invokeNode,
    isInvoking,
    releaseCurrentSession
  }
}

export function getMenuInputKey(input: MenuInput): string {
  if (input.domain === 'game' && input.scope === 'batch') {
    return `${input.domain}:${input.scope}:${input.entityIds.join(',')}`
  }

  return `${input.domain}:${input.scope}:${'entityId' in input ? input.entityId : ''}`
}

function getCallbackKey(group: ExtensionResolvedMenuGroup, nodePath: readonly string[]): string {
  return `${group.extensionId}:${group.contributionId}:${nodePath.join('/')}`
}

function releaseSession(sessionId: string): void {
  void invokeIpc<void>('extension:release-menu', { sessionId }).catch((e) => {
    console.warn('[ExtensionMenuSession] Failed to release menu session:', e)
  })
}

async function invokeIpc<T>(
  channel: 'extension:resolve-menu',
  request: ExtensionMenuResolveRequest
): Promise<T>
async function invokeIpc<T>(
  channel: 'extension:invoke-menu',
  request: ExtensionMenuInvokeRequest
): Promise<T>
async function invokeIpc<T>(
  channel: 'extension:release-menu',
  request: ExtensionMenuReleaseRequest
): Promise<T>
async function invokeIpc<T>(
  channel: 'extension:resolve-menu' | 'extension:invoke-menu' | 'extension:release-menu',
  request: ExtensionMenuResolveRequest | ExtensionMenuInvokeRequest | ExtensionMenuReleaseRequest
): Promise<T> {
  const result = await ipcManager.invoke(channel, request as never)
  if (result.success) {
    return ('data' in result ? result.data : undefined) as T
  }

  throw new Error(result.error)
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
