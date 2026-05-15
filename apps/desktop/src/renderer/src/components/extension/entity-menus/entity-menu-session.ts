import { computed, onBeforeUnmount, ref, watch, type ComputedRef, type Ref } from 'vue'
import { ipcManager } from '@renderer/core/ipc'
import { notify } from '@renderer/core/notify'
import type { EntityMenuInput } from '@kisaki/extension-api'
import type {
  ExtensionEntityMenuInvokeRequest,
  ExtensionEntityMenuInvokeResponse,
  ExtensionEntityMenuReleaseRequest,
  ExtensionEntityMenuResolveRequest,
  ExtensionResolvedEntityMenu,
  ExtensionResolvedEntityMenuGroup,
  ExtensionResolvedEntityMenuNode
} from '@shared/extension'
import { createLogger } from '@renderer/core/log'

const log = createLogger('Extension')

export interface ExtensionEntityMenuSessionController {
  resolvedMenu: Ref<ExtensionResolvedEntityMenu | null>
  loading: Ref<boolean>
  error: Ref<string | null>
  invokingKey: Ref<string | null>
  visibleGroups: ComputedRef<readonly ExtensionResolvedEntityMenuGroup[]>
  hasContent: ComputedRef<boolean>
  resolveEntityMenu: () => Promise<void>
  invokeNode: (
    group: ExtensionResolvedEntityMenuGroup,
    node: ExtensionResolvedEntityMenuNode,
    nodePath: readonly string[],
    value?: boolean | string
  ) => Promise<void>
  isInvoking: (group: ExtensionResolvedEntityMenuGroup, nodePath: readonly string[]) => boolean
  releaseCurrentSession: () => void
}

export function useExtensionEntityMenuSession(
  input: Ref<EntityMenuInput>,
  enabled: Ref<boolean>
): ExtensionEntityMenuSessionController {
  const resolvedMenu = ref<ExtensionResolvedEntityMenu | null>(null)
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
    'extension:entity-menus-refresh-requested',
    (_event, event) => {
      if (!enabled.value || !resolvedMenu.value) {
        return
      }

      if (event.domain === input.value.domain && event.scope === input.value.scope) {
        void resolveEntityMenu()
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

      void resolveEntityMenu()
    },
    { immediate: true }
  )

  onBeforeUnmount(() => {
    resolveRequestId += 1
    stopRefreshListener()
    releaseCurrentSession()
  })

  async function resolveEntityMenu(): Promise<void> {
    const requestId = ++resolveRequestId
    releaseCurrentSession()
    loading.value = true
    error.value = null
    resolvedMenu.value = null

    try {
      const menu = await invokeIpc<ExtensionResolvedEntityMenu>('extension:resolve-entity-menu', {
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
    group: ExtensionResolvedEntityMenuGroup,
    node: ExtensionResolvedEntityMenuNode,
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
      const response = await invokeIpc<ExtensionEntityMenuInvokeResponse>(
        'extension:invoke-entity-menu',
        {
          sessionId: menu.sessionId,
          extensionId: group.extensionId,
          contributionId: group.contributionId,
          domain: group.domain,
          scope: group.scope,
          nodePath,
          input: input.value,
          value
        }
      )

      if (!response.result.success) {
        notify.error('扩展菜单操作失败', response.result.error.message)
      }

      if (response.result.refresh) {
        await resolveEntityMenu()
      }
    } catch (e) {
      notify.error('扩展菜单操作失败', getErrorMessage(e))
    } finally {
      invokingKey.value = null
    }
  }

  function isInvoking(
    group: ExtensionResolvedEntityMenuGroup,
    nodePath: readonly string[]
  ): boolean {
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
    resolveEntityMenu,
    invokeNode,
    isInvoking,
    releaseCurrentSession
  }
}

export function getMenuInputKey(input: EntityMenuInput): string {
  if (input.domain === 'game' && input.scope === 'batch') {
    return `${input.domain}:${input.scope}:${input.entityIds.join(',')}`
  }

  return `${input.domain}:${input.scope}:${'entityId' in input ? input.entityId : ''}`
}

function getCallbackKey(
  group: ExtensionResolvedEntityMenuGroup,
  nodePath: readonly string[]
): string {
  return `${group.extensionId}:${group.domain}:${group.scope}:${group.contributionId}:${nodePath.join('/')}`
}

function releaseSession(sessionId: string): void {
  void invokeIpc<void>('extension:release-entity-menu', { sessionId }).catch((e) => {
    log.warn('Failed to release menu session:', e)
  })
}

async function invokeIpc<T>(
  channel: 'extension:resolve-entity-menu',
  request: ExtensionEntityMenuResolveRequest
): Promise<T>
async function invokeIpc<T>(
  channel: 'extension:invoke-entity-menu',
  request: ExtensionEntityMenuInvokeRequest
): Promise<T>
async function invokeIpc<T>(
  channel: 'extension:release-entity-menu',
  request: ExtensionEntityMenuReleaseRequest
): Promise<T>
async function invokeIpc<T>(
  channel:
    | 'extension:resolve-entity-menu'
    | 'extension:invoke-entity-menu'
    | 'extension:release-entity-menu',
  request:
    | ExtensionEntityMenuResolveRequest
    | ExtensionEntityMenuInvokeRequest
    | ExtensionEntityMenuReleaseRequest
): Promise<T> {
  const result = await ipcManager.invoke(channel, request as never)
  if (result.success) {
    return ('data' in result ? result.data : undefined) as T
  }

  throw new Error('Extension entity menu request failed.')
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
