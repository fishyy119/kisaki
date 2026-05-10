import { pathToFileURL } from 'node:url'
import type { IpcService } from '@main/services/ipc'
import type {
  ExtensionCatalogInfo,
  ExtensionEntityMenuInvokeRequest,
  ExtensionEntityMenuReleaseRequest,
  ExtensionEntityMenuResolveRequest,
  ExtensionRegistryEntry,
  ExtensionSettingsPanelInvokeRequest,
  ExtensionSettingsPanelOpenRequest,
  ExtensionSettingsPanelRefreshRequest,
  ExtensionSettingsPanelReleaseRequest,
  ExtensionSettingsPanelSubmitRequest,
  ExtensionUpdateInfo as SharedExtensionUpdateInfo
} from '@shared/extension'
import type {
  ExtensionCatalogEntry,
  ExtensionDiscoveryEntry,
  ExtensionSearchOptions,
  ExtensionUpdateInfo
} from './types'
import type { ExtensionRuntimeState } from './runtime/manager'
import type { ExtensionService } from './service'
import { resolveExtensionFilePath } from './manifest'
import { requireSafeExtensionId } from './shared/path-confinement'

export function registerExtensionIpc(service: ExtensionService, ipc: IpcService): void {
  ipc.handle('extension:disable', async (_, extensionId: string) => {
    try {
      await service.disable(requireSafeExtensionId(extensionId))
      return { success: true }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle('extension:enable', async (_, extensionId: string) => {
    try {
      await service.enable(requireSafeExtensionId(extensionId))
      return { success: true }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle('extension:is-enabled', async (_, extensionId: string) => {
    try {
      return { success: true, data: await service.isEnabled(requireSafeExtensionId(extensionId)) }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle('extension:install', async (_, source: string) => {
    try {
      await service.install(requireNonEmptyString(source, 'source'))
      return { success: true }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle('extension:install-from-file', async (_, filePath: string) => {
    try {
      await service.installFromFile(requireNonEmptyString(filePath, 'filePath'))
      return { success: true }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle('extension:uninstall', async (_, extensionId: string) => {
    try {
      await service.uninstall(requireSafeExtensionId(extensionId))
      return { success: true }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle('extension:check-updates', async () => {
    try {
      return {
        success: true,
        data: (await service.checkUpdates()).map(toSharedExtensionUpdateInfo)
      }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle('extension:update', async (_, extensionId: string) => {
    try {
      await service.update(requireSafeExtensionId(extensionId))
      return { success: true }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle('extension:reload', async (_, extensionId: string) => {
    try {
      await service.reload(requireSafeExtensionId(extensionId))
      return { success: true }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle('extension:get-catalog', async () => {
    try {
      await service.refreshCatalog()
      return {
        success: true,
        data: service
          .getCatalog()
          .map((entry) => toExtensionCatalogInfo(entry, service.getRuntimeState(entry.id)))
      }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle('extension:get-contribution-snapshot', () => {
    try {
      return {
        success: true,
        data: service.getContributionSnapshot()
      }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle('extension:get-settings-panel-contributions', () => {
    try {
      return {
        success: true,
        data: service.getSettingsPanelContributions()
      }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle('extension:resolve-entity-menu', async (_, request) => {
    try {
      return {
        success: true,
        data: await service.resolveEntityMenu(requireMenuResolveRequest(request))
      }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle('extension:invoke-entity-menu', async (_, request) => {
    try {
      return {
        success: true,
        data: await service.invokeEntityMenuCallback(requireMenuInvokeRequest(request))
      }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle('extension:release-entity-menu', async (_, request) => {
    try {
      await service.releaseEntityMenu(requireMenuReleaseRequest(request))
      return { success: true }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle('extension:open-settings-panel', async (_, request) => {
    try {
      const data = await service.openSettingsPanel(requireSettingsOpenRequest(request))
      switch (data.surface) {
        case 'root':
          return { success: true, data }
        case 'dialog':
          return { success: true, data }
        case 'popover':
          return { success: true, data }
      }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle('extension:refresh-settings-panel', async (_, request) => {
    try {
      const data = await service.refreshSettingsPanel(requireSettingsRefreshRequest(request))
      switch (data.surface) {
        case 'root':
          return { success: true, data }
        case 'dialog':
          return { success: true, data }
        case 'popover':
          return { success: true, data }
        case 'all':
          return { success: true, data }
      }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle('extension:submit-settings-panel', async (_, request) => {
    try {
      return {
        success: true,
        data: await service.submitSettingsPanel(requireSettingsSubmitRequest(request))
      }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle('extension:invoke-settings-panel-node', async (_, request) => {
    try {
      return {
        success: true,
        data: await service.invokeSettingsPanelNode(requireSettingsInvokeRequest(request))
      }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle('extension:release-settings-panel', async (_, request) => {
    try {
      await service.releaseSettingsPanel(requireSettingsReleaseRequest(request))
      return { success: true }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle('extension:get-theme-contributions', () => {
    try {
      return {
        success: true,
        data: service.getThemeContributions()
      }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle('extension:get-sources', () => {
    try {
      return {
        success: true,
        data: [...service.getSearchableSources()]
      }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipc.handle(
    'extension:search',
    async (_, sourceName: string, query: string, options?: ExtensionSearchOptions) => {
      try {
        const result = await service.searchSource(
          requireNonEmptyString(sourceName, 'sourceName'),
          requireString(query, 'query'),
          options
        )
        return {
          success: true,
          data: {
            entries: result.entries.map(toExtensionRegistryEntry),
            total: result.total,
            hasMore: result.hasMore
          }
        }
      } catch (error) {
        return { success: false, error: toErrorMessage(error) }
      }
    }
  )
}

function toExtensionCatalogInfo(
  entry: ExtensionCatalogEntry,
  runtimeState: ExtensionRuntimeState | null
): ExtensionCatalogInfo {
  const runtimeStatus =
    entry.enabled && entry.status === 'ready' ? (runtimeState?.status ?? 'stopped') : 'stopped'
  const runtimeError = runtimeStatus === 'failed' ? (runtimeState?.error ?? null) : null
  const runtimeDiagnostics =
    entry.enabled && entry.status === 'ready' ? (runtimeState?.diagnostics ?? []) : []

  return {
    builtin: entry.builtin,
    id: entry.id,
    name: entry.manifest?.name ?? entry.id,
    version: entry.version,
    description: entry.manifest?.description,
    author: entry.manifest?.author,
    homepage: entry.manifest?.homepage,
    iconUrl: entry.manifest?.icon
      ? pathToFileURL(resolveExtensionFilePath(entry.packagePath, entry.manifest.icon)).toString()
      : undefined,
    categories: entry.categories,
    enabled: entry.enabled,
    status: entry.status,
    runtimeStatus,
    runtimeError,
    runtimeDiagnostics,
    source: entry.source,
    directory: entry.packagePath,
    issues: entry.issues
  }
}

function toSharedExtensionUpdateInfo(update: ExtensionUpdateInfo): SharedExtensionUpdateInfo {
  return {
    extensionId: update.extensionId,
    currentVersion: update.currentVersion,
    latestVersion: update.latestVersion,
    source: update.source
  }
}

function toExtensionRegistryEntry(entry: ExtensionDiscoveryEntry): ExtensionRegistryEntry {
  return {
    id: entry.id,
    name: entry.name,
    version: entry.version,
    description: entry.description,
    author: entry.author,
    homepage: entry.homepage,
    categories: entry.categories,
    provider: entry.provider,
    locator: entry.locator,
    iconUrl: entry.iconUrl,
    stars: entry.stars,
    updatedAt: entry.updatedAt
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown extension service error'
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string.`)
  }

  return value
}

function requireNonEmptyString(value: unknown, label: string): string {
  const normalized = requireString(value, label)
  if (normalized.length === 0) {
    throw new Error(`${label} must be non-empty.`)
  }

  return normalized
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }

  return value as Record<string, unknown>
}

function requireMenuResolveRequest(value: unknown): ExtensionEntityMenuResolveRequest {
  const request = requireRecord(value, 'request')
  return {
    input: requireMenuInput(request.input)
  }
}

function requireMenuInvokeRequest(value: unknown): ExtensionEntityMenuInvokeRequest {
  const request = requireRecord(value, 'request')
  const callbackValue = request.value
  if (
    callbackValue !== undefined &&
    typeof callbackValue !== 'boolean' &&
    typeof callbackValue !== 'string'
  ) {
    throw new Error('value must be a boolean or string when provided.')
  }

  return {
    extensionId: requireSafeExtensionId(request.extensionId),
    contributionId: requireNonEmptyString(request.contributionId, 'contributionId'),
    domain: requireNonEmptyString(
      request.domain,
      'domain'
    ) as ExtensionEntityMenuInvokeRequest['domain'],
    scope: requireNonEmptyString(
      request.scope,
      'scope'
    ) as ExtensionEntityMenuInvokeRequest['scope'],
    sessionId: requireNonEmptyString(request.sessionId, 'sessionId'),
    nodePath: requireStringArray(request.nodePath, 'nodePath'),
    input: requireMenuInput(request.input),
    value: callbackValue as ExtensionEntityMenuInvokeRequest['value']
  }
}

function requireMenuReleaseRequest(value: unknown): ExtensionEntityMenuReleaseRequest {
  const request = requireRecord(value, 'request')
  return {
    sessionId: requireNonEmptyString(request.sessionId, 'sessionId')
  }
}

function requireSettingsOpenRequest(value: unknown): ExtensionSettingsPanelOpenRequest {
  const request = requireRecord(value, 'request')
  const surface = requireSurface(request.surface, ['root', 'dialog', 'popover'], 'surface')
  const base = {
    extensionId: requireSafeExtensionId(request.extensionId),
    contributionId: requireNonEmptyString(request.contributionId, 'contributionId')
  }

  if (surface === 'root') {
    return {
      ...base,
      surface,
      reason: request.reason as Extract<
        ExtensionSettingsPanelOpenRequest,
        { surface: 'root' }
      >['reason']
    }
  }

  const sessionId = requireNonEmptyString(request.sessionId, 'sessionId')
  if (surface === 'dialog') {
    return {
      ...base,
      surface,
      sessionId,
      dialogId: requireNonEmptyString(request.dialogId, 'dialogId'),
      params: request.params as Extract<
        ExtensionSettingsPanelOpenRequest,
        { surface: 'dialog' }
      >['params'],
      parentDraft: requireSettingsDraftSnapshot(request.parentDraft, 'parentDraft'),
      revision: requireFiniteNumber(request.revision, 'revision')
    }
  }

  return {
    ...base,
    surface,
    sessionId,
    popoverId: requireNonEmptyString(request.popoverId, 'popoverId'),
    parent: requireSettingsParentRef(request.parent),
    params: request.params as Extract<
      ExtensionSettingsPanelOpenRequest,
      { surface: 'popover' }
    >['params'],
    parentDraft: requireSettingsDraftSnapshot(request.parentDraft, 'parentDraft'),
    anchorNodeKey: requireNonEmptyString(request.anchorNodeKey, 'anchorNodeKey'),
    revision: requireFiniteNumber(request.revision, 'revision')
  }
}

function requireSettingsRefreshRequest(value: unknown): ExtensionSettingsPanelRefreshRequest {
  const request = requireRecord(value, 'request')
  const surface = requireSurface(request.surface, ['root', 'dialog', 'popover', 'all'], 'surface')
  const base = {
    extensionId: requireSafeExtensionId(request.extensionId),
    contributionId: requireNonEmptyString(request.contributionId, 'contributionId'),
    sessionId: requireNonEmptyString(request.sessionId, 'sessionId'),
    reason: request.reason as ExtensionSettingsPanelRefreshRequest['reason'],
    revision: requireFiniteNumber(request.revision, 'revision')
  }

  switch (surface) {
    case 'root':
      return {
        ...base,
        surface,
        draft: requireSettingsDraftSnapshot(request.draft, 'draft')
      }

    case 'dialog':
      return {
        ...base,
        surface,
        dialogId: requireNonEmptyString(request.dialogId, 'dialogId'),
        draft: requireSettingsDraftSnapshot(request.draft, 'draft'),
        parentDraft: requireSettingsDraftSnapshot(request.parentDraft, 'parentDraft')
      }

    case 'popover':
      return {
        ...base,
        surface,
        popoverId: requireNonEmptyString(request.popoverId, 'popoverId'),
        parent: requireSettingsParentRef(request.parent),
        draft: requireSettingsDraftSnapshot(request.draft, 'draft'),
        parentDraft: requireSettingsDraftSnapshot(request.parentDraft, 'parentDraft')
      }

    case 'all':
      return {
        ...base,
        surface,
        rootDraft: requireSettingsDraftSnapshot(request.rootDraft, 'rootDraft'),
        activeDialog: requireOptionalActiveDialogRefresh(request.activeDialog)
      }
  }
}

function requireSettingsSubmitRequest(value: unknown): ExtensionSettingsPanelSubmitRequest {
  const request = requireRecord(value, 'request')
  const surface = requireSurface(request.surface, ['root', 'dialog'], 'surface')
  const base = {
    extensionId: requireSafeExtensionId(request.extensionId),
    contributionId: requireNonEmptyString(request.contributionId, 'contributionId'),
    sessionId: requireNonEmptyString(request.sessionId, 'sessionId'),
    revision: requireFiniteNumber(request.revision, 'revision')
  }

  if (surface === 'root') {
    return {
      ...base,
      surface,
      draft: requireSettingsDraftSnapshot(request.draft, 'draft')
    }
  }

  return {
    ...base,
    surface,
    dialogId: requireNonEmptyString(request.dialogId, 'dialogId'),
    draft: requireSettingsDraftSnapshot(request.draft, 'draft'),
    parentDraft: requireSettingsDraftSnapshot(request.parentDraft, 'parentDraft')
  }
}

function requireSettingsInvokeRequest(value: unknown): ExtensionSettingsPanelInvokeRequest {
  const request = requireRecord(value, 'request')
  const surface = requireSurface(request.surface, ['root', 'dialog', 'popover'], 'surface')
  const base = {
    extensionId: requireSafeExtensionId(request.extensionId),
    contributionId: requireNonEmptyString(request.contributionId, 'contributionId'),
    sessionId: requireNonEmptyString(request.sessionId, 'sessionId'),
    callbackId: requireNonEmptyString(request.callbackId, 'callbackId'),
    fieldId: requireNonEmptyString(request.fieldId, 'fieldId'),
    nodeId: requireNonEmptyString(request.nodeId, 'nodeId'),
    value: request.value as ExtensionSettingsPanelInvokeRequest['value'],
    requestId: requireNonEmptyString(request.requestId, 'requestId'),
    revision: requireFiniteNumber(request.revision, 'revision')
  }

  if (surface === 'root') {
    return {
      ...base,
      surface,
      draft: requireSettingsDraftSnapshot(request.draft, 'draft')
    }
  }

  if (surface === 'dialog') {
    return {
      ...base,
      surface,
      dialogId: requireNonEmptyString(request.dialogId, 'dialogId'),
      draft: requireSettingsDraftSnapshot(request.draft, 'draft'),
      parentDraft: requireSettingsDraftSnapshot(request.parentDraft, 'parentDraft')
    }
  }

  return {
    ...base,
    surface,
    popoverId: requireNonEmptyString(request.popoverId, 'popoverId'),
    parent: requireSettingsParentRef(request.parent),
    draft: requireSettingsDraftSnapshot(request.draft, 'draft'),
    parentDraft: requireSettingsDraftSnapshot(request.parentDraft, 'parentDraft')
  }
}

function requireSettingsReleaseRequest(value: unknown): ExtensionSettingsPanelReleaseRequest {
  const request = requireRecord(value, 'request')
  const surface = requireSurface(request.surface, ['root', 'dialog', 'popover', 'all'], 'surface')
  const base = {
    extensionId: requireSafeExtensionId(request.extensionId),
    contributionId: requireNonEmptyString(request.contributionId, 'contributionId'),
    sessionId: requireNonEmptyString(request.sessionId, 'sessionId')
  }

  if (surface === 'root' || surface === 'all') {
    return {
      ...base,
      surface
    }
  }

  if (surface === 'dialog') {
    return {
      ...base,
      surface,
      dialogId: requireNonEmptyString(request.dialogId, 'dialogId')
    }
  }

  return {
    ...base,
    surface,
    popoverId: requireNonEmptyString(request.popoverId, 'popoverId'),
    parent: requireSettingsParentRef(request.parent)
  }
}

function requireMenuInput(value: unknown): ExtensionEntityMenuResolveRequest['input'] {
  const input = requireRecord(value, 'input')
  requireNonEmptyString(input.domain, 'input.domain')
  requireNonEmptyString(input.scope, 'input.scope')
  return input as unknown as ExtensionEntityMenuResolveRequest['input']
}

function requireStringArray(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error(`${label} must be an array of strings.`)
  }

  return value
}

function requireSurface<const TSurface extends string>(
  value: unknown,
  allowed: readonly TSurface[],
  label: string
): TSurface {
  if (typeof value !== 'string' || !allowed.includes(value as TSurface)) {
    throw new Error(`${label} must be one of: ${allowed.join(', ')}.`)
  }

  return value as TSurface
}

function requireFiniteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`)
  }

  return value
}

function requireSettingsDraftSnapshot(
  value: unknown,
  label: string
): Extract<ExtensionSettingsPanelRefreshRequest, { surface: 'root' }>['draft'] {
  const snapshot = requireRecord(value, label)
  return {
    values: requireRecord(snapshot.values, `${label}.values`) as Extract<
      ExtensionSettingsPanelRefreshRequest,
      { surface: 'root' }
    >['draft']['values'],
    dirtyNodeIds: requireStringArray(snapshot.dirtyNodeIds, `${label}.dirtyNodeIds`)
  }
}

function requireSettingsParentRef(
  value: unknown
): Extract<ExtensionSettingsPanelOpenRequest, { surface: 'popover' }>['parent'] {
  const parent = requireRecord(value, 'parent')
  const surface = requireSurface(parent.surface, ['root', 'dialog'], 'parent.surface')
  if (surface === 'root') {
    return { surface }
  }

  return {
    surface,
    dialogId: requireNonEmptyString(parent.dialogId, 'parent.dialogId')
  }
}

function requireOptionalActiveDialogRefresh(
  value: unknown
): Extract<ExtensionSettingsPanelRefreshRequest, { surface: 'all' }>['activeDialog'] {
  if (value === undefined) {
    return undefined
  }

  const activeDialog = requireRecord(value, 'activeDialog')
  return {
    dialogId: requireNonEmptyString(activeDialog.dialogId, 'activeDialog.dialogId'),
    draft: requireSettingsDraftSnapshot(activeDialog.draft, 'activeDialog.draft')
  }
}
