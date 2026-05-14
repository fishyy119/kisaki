import type {
  ExtensionCatalogSearchRequest,
  ExtensionCreateInstallPlanRequest,
  ExtensionEntityMenuInvokeRequest,
  ExtensionEntityMenuReleaseRequest,
  ExtensionEntityMenuResolveRequest,
  ExtensionInstallFromFileRequest,
  ExtensionInstallReleaseRequest,
  ExtensionPurgeDataRequest,
  ExtensionRepositoryCreateRequest,
  ExtensionRepositoryUpdateRequest,
  ExtensionSettingsPanelInvokeRequest,
  ExtensionSettingsPanelOpenRequest,
  ExtensionSettingsPanelRefreshRequest,
  ExtensionSettingsPanelReleaseRequest,
  ExtensionSettingsPanelSubmitRequest,
  ExtensionUpdatePolicyRequest,
  ExtensionUpdateRequest
} from '@shared/extension'
import { requireSafeOperationId } from '../packages/layout'
import { requireSafeExtensionId } from '../shared/path-confinement'

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/

export function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string.`)
  }

  return value
}

export function requireNonEmptyString(value: unknown, label: string): string {
  const normalized = requireString(value, label)
  if (normalized.length === 0) {
    throw new Error(`${label} must be non-empty.`)
  }

  return normalized
}

export function requireRepositoryCreateRequest(value: unknown): ExtensionRepositoryCreateRequest {
  const request = requireRecord(value, 'request')
  return {
    url: requireNonEmptyString(request.url, 'url'),
    name: requireOptionalString(request.name, 'name'),
    state: requireOptionalRepositoryState(request.state),
    priority: requireOptionalSafeInteger(request.priority, 'priority')
  }
}

export function requireRepositoryUpdateRequest(value: unknown): ExtensionRepositoryUpdateRequest {
  const request = requireRecord(value, 'request')
  return {
    id: requireNonEmptyString(request.id, 'id'),
    url: requireOptionalString(request.url, 'url'),
    name: requireOptionalString(request.name, 'name'),
    state: requireOptionalRepositoryState(request.state),
    priority: requireOptionalSafeInteger(request.priority, 'priority')
  }
}

export function requireCatalogSearchRequest(value: unknown): ExtensionCatalogSearchRequest {
  const request = requireOptionalRecord(value, 'request')
  return {
    query: requireOptionalString(request.query, 'query'),
    category: requireOptionalString(
      request.category,
      'category'
    ) as ExtensionCatalogSearchRequest['category'],
    channel: requireOptionalString(request.channel, 'channel'),
    repositoryId: requireOptionalString(request.repositoryId, 'repositoryId'),
    compatibleOnly: requireOptionalBoolean(request.compatibleOnly, 'compatibleOnly'),
    installedOnly: requireOptionalBoolean(request.installedOnly, 'installedOnly'),
    hasUpdateOnly: requireOptionalBoolean(request.hasUpdateOnly, 'hasUpdateOnly'),
    sortBy: requireOptionalEnum(
      request.sortBy,
      ['relevance', 'name', 'updatedAt', 'publishedAt', 'repositoryPriority'],
      'sortBy'
    ) as ExtensionCatalogSearchRequest['sortBy'],
    sortDirection: requireOptionalEnum(
      request.sortDirection,
      ['asc', 'desc'],
      'sortDirection'
    ) as ExtensionCatalogSearchRequest['sortDirection'],
    page: requireOptionalPositiveInteger(request.page, 'page'),
    limit: requireOptionalPositiveInteger(request.limit, 'limit')
  }
}

export function requireCreateInstallPlanRequest(value: unknown): ExtensionCreateInstallPlanRequest {
  const request = requireRecord(value, 'request')
  const sourceKind = request.sourceKind ?? 'repository'

  if (sourceKind === 'local-file') {
    return {
      sourceKind,
      filePath: requireNonEmptyString(request.filePath, 'filePath')
    }
  }

  if (sourceKind !== 'repository') {
    throw new Error('sourceKind must be repository or local-file.')
  }

  return {
    sourceKind,
    extensionId: requireSafeExtensionId(request.extensionId),
    releaseId: requireOptionalString(request.releaseId, 'releaseId'),
    repositoryId: requireOptionalString(request.repositoryId, 'repositoryId')
  }
}

export function requireInstallReleaseRequest(value: unknown): ExtensionInstallReleaseRequest {
  const request = requireRecord(value, 'request')
  const updatePolicy = requireOptionalEnum(
    request.updatePolicy,
    ['manual', 'notify', 'auto', 'pinned'],
    'updatePolicy'
  ) as ExtensionInstallReleaseRequest['updatePolicy']

  return {
    sourceKind: 'repository',
    extensionId: requireSafeExtensionId(request.extensionId),
    releaseId: requireOptionalString(request.releaseId, 'releaseId'),
    repositoryId: requireOptionalString(request.repositoryId, 'repositoryId'),
    planId: requireNonEmptyString(request.planId, 'planId'),
    planFingerprint: requireSha256Hex(request.planFingerprint, 'planFingerprint'),
    operationId: requireSafeOperationId(request.operationId),
    trustSignerFingerprint: requireOptionalBoolean(
      request.trustSignerFingerprint,
      'trustSignerFingerprint'
    ),
    enabled: requireOptionalBoolean(request.enabled, 'enabled'),
    updatePolicy
  }
}

export function requireInstallFromFileRequest(value: unknown): ExtensionInstallFromFileRequest {
  const request = requireRecord(value, 'request')

  return {
    operationId: requireSafeOperationId(request.operationId),
    filePath: requireNonEmptyString(request.filePath, 'filePath'),
    planId: requireNonEmptyString(request.planId, 'planId'),
    planFingerprint: requireSha256Hex(request.planFingerprint, 'planFingerprint'),
    enabled: requireOptionalBoolean(request.enabled, 'enabled')
  }
}

export function requirePurgeDataRequest(value: unknown): ExtensionPurgeDataRequest {
  const request =
    typeof value === 'string' ? { extensionId: value } : requireRecord(value, 'request')

  return {
    extensionId: requireSafeExtensionId(request.extensionId),
    force: requireOptionalBoolean(request.force, 'force')
  }
}

export function requireUpdateRequest(value: unknown): ExtensionUpdateRequest {
  const request = requireRecord(value, 'request')
  return {
    operationId: requireSafeOperationId(request.operationId),
    extensionId: requireSafeExtensionId(request.extensionId),
    planId: requireNonEmptyString(request.planId, 'planId'),
    planFingerprint: requireSha256Hex(request.planFingerprint, 'planFingerprint'),
    trustSignerFingerprint: requireOptionalBoolean(
      request.trustSignerFingerprint,
      'trustSignerFingerprint'
    )
  }
}

export function requireUpdatePolicyRequest(value: unknown): ExtensionUpdatePolicyRequest {
  const request = requireRecord(value, 'request')
  const updatePolicy = requireOptionalEnum(
    request.updatePolicy,
    ['manual', 'notify', 'auto', 'pinned'],
    'updatePolicy'
  )
  if (!updatePolicy) {
    throw new Error('updatePolicy must be provided.')
  }

  return {
    extensionId: requireSafeExtensionId(request.extensionId),
    updatePolicy,
    pinnedVersion:
      request.pinnedVersion === null
        ? null
        : requireOptionalString(request.pinnedVersion, 'pinnedVersion')
  }
}

export function requireMenuResolveRequest(value: unknown): ExtensionEntityMenuResolveRequest {
  const request = requireRecord(value, 'request')
  return {
    input: requireMenuInput(request.input)
  }
}

export function requireMenuInvokeRequest(value: unknown): ExtensionEntityMenuInvokeRequest {
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

export function requireMenuReleaseRequest(value: unknown): ExtensionEntityMenuReleaseRequest {
  const request = requireRecord(value, 'request')
  return {
    sessionId: requireNonEmptyString(request.sessionId, 'sessionId')
  }
}

export function requireSettingsOpenRequest(value: unknown): ExtensionSettingsPanelOpenRequest {
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

export function requireSettingsRefreshRequest(
  value: unknown
): ExtensionSettingsPanelRefreshRequest {
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

export function requireSettingsSubmitRequest(value: unknown): ExtensionSettingsPanelSubmitRequest {
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

export function requireSettingsInvokeRequest(value: unknown): ExtensionSettingsPanelInvokeRequest {
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

export function requireSettingsReleaseRequest(
  value: unknown
): ExtensionSettingsPanelReleaseRequest {
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

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }

  return value as Record<string, unknown>
}

function requireOptionalRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === undefined || value === null) {
    return {}
  }

  return requireRecord(value, label)
}

function requireOptionalString(value: unknown, label: string): string | undefined {
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string when provided.`)
  }
  return value
}

function requireSha256Hex(value: unknown, label: string): string {
  const normalized = requireNonEmptyString(value, label)
  if (!SHA256_HEX_PATTERN.test(normalized)) {
    throw new Error(`${label} must be a sha256 hex digest.`)
  }
  return normalized
}

function requireOptionalBoolean(value: unknown, label: string): boolean | undefined {
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be a boolean when provided.`)
  }
  return value
}

function requireOptionalSafeInteger(value: unknown, label: string): number | undefined {
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new Error(`${label} must be a safe integer when provided.`)
  }
  return value
}

function requireOptionalPositiveInteger(value: unknown, label: string): number | undefined {
  const number = requireOptionalSafeInteger(value, label)
  if (number !== undefined && number <= 0) {
    throw new Error(`${label} must be greater than zero when provided.`)
  }
  return number
}

function requireOptionalRepositoryState(value: unknown): ExtensionRepositoryCreateRequest['state'] {
  return requireOptionalEnum(value, ['enabled', 'disabled'], 'state') as
    | ExtensionRepositoryCreateRequest['state']
    | undefined
}

function requireOptionalEnum<const T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string
): T | undefined {
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error(`${label} must be one of: ${allowed.join(', ')}.`)
  }
  return value as T
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
