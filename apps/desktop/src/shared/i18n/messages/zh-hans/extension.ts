import type { Messages } from '../schema'

type ReleaseActionKind = 'install' | 'update' | 'reinstall' | 'downgrade'

const RELEASE_ACTIONS: Record<ReleaseActionKind, string> = {
  install: '安装',
  update: '更新',
  reinstall: '重新安装',
  downgrade: '降级'
}

/** Extension platform surfaces: manager pages, panels, dialogs, and webviews. */
export const extension = {
  title: '扩展',
  webviewPageClosed: '该扩展页面已关闭',

  categories: {
    scraper: '元数据',
    tool: '工具',
    theme: '主题',
    integration: '集成',
    uncategorized: '未分类',
    joinSeparator: '、'
  },

  nav: {
    discover: '发现',
    installed: '已安装',
    repositories: '仓库',
    signers: '签名'
  },

  header: {
    reloadPending: ({ count }: { count: number }) =>
      `扩展代码已更新（${count}），点击重载进程以应用`,
    reloadHost: '重载扩展进程',
    reloadProcess: '重载进程',
    install: '安装扩展'
  },

  host: {
    reloading: '正在重载扩展进程',
    reloaded: '扩展进程已重载',
    reloadFailed: '重载扩展进程失败',
    codeUpdatedTitle: '扩展代码已更新',
    pendingChanges: ({ subject }: { subject: string }) => `${subject}有未应用的修改`,
    subjectSingle: ({ id }: { id: string }) => `扩展 ${id}`,
    subjectMultiple: ({ count }: { count: number }) => `${count} 个扩展`
  },

  entityMenu: {
    loading: '加载扩展菜单…',
    loadFailed: '扩展菜单加载失败',
    partiallyUnavailable: '部分扩展菜单不可用',
    actionFailed: '扩展菜单操作失败'
  },

  actions: {
    install: '安装',
    update: '更新',
    reinstall: '重新安装',
    downgrade: '降级',
    apply: '应用'
  },

  release: {
    actionTitle: ({ action }: { action: string }) => `${action}扩展`,
    prepareTitle: '准备扩展版本',
    importLocalTitle: '导入本地扩展',
    repositoryDescription: '检查版本、仓库来源和签名后继续',
    localDescription: '选择本地 .kisx 文件并确认',
    confirmAction: ({ action }: { action: string }) => `确认${action}`,
    selectFile: '选择文件',
    planFailed: '无法创建版本计划',
    filePickerTitle: '选择扩展文件',
    filePickerFilterName: '扩展包',
    cancelled: '操作已取消',
    applied: ({ action }: { action: string }) => `扩展${action}成功`,
    applyFailed: '操作失败',
    signerTrusted: '签名已信任',
    signerUntrusted: '签名未信任',
    signerChanged: '签名已变更',
    signerUnsigned: '未签名',
    kindStable: '稳定版',
    kindPreview: '预览版',
    unknownSize: '未知大小',
    repositoryLine: ({ name }: { name: string }) => `仓库：${name}`,
    localFileLine: ({ size }: { size: string }) => `本地文件 · ${size}`,
    currentVersion: '当前版本',
    notInstalled: '未安装',
    releaseKind: '版本类型',
    signerFingerprint: '签名指纹',
    artifactSize: '安装包大小',
    changelog: '更新日志',
    viewChangelog: '查看',
    needsConfirmation: '需要确认',
    enableAfterApply: '应用后启用',
    updatePolicy: '更新策略',
    trustSigner: '信任此扩展的签名指纹',
    pickLocalHint: '选择本地扩展包文件（.kisx）'
  },

  policy: {
    manual: '手动',
    auto: '自动',
    pinned: '锁定'
  },

  installer: {
    releaseTitle: ({ action, name }: { action: ReleaseActionKind; name: string }) =>
      `${RELEASE_ACTIONS[action]}扩展 ${name}`,
    localTitle: '应用本地扩展包',
    completedTitle: ({ action }: { action: ReleaseActionKind }) =>
      `${RELEASE_ACTIONS[action]}扩展完成`,
    completedSummary: ({
      action,
      name,
      version
    }: {
      action: ReleaseActionKind
      name: string
      version: string
    }) => `已${RELEASE_ACTIONS[action]} ${name} v${version}`,
    cancelledSummary: ({ action }: { action: ReleaseActionKind }) =>
      `扩展${RELEASE_ACTIONS[action]}已取消`,
    localCancelledSummary: '扩展包应用已取消',
    phases: {
      waitLock: '等待扩展包写入锁',
      prepare: '准备扩展安装包',
      verify: '校验扩展安装包',
      extract: '解压扩展安装包',
      commit: '提交扩展安装状态'
    }
  },

  repositoryRefresh: {
    refreshOneTitle: ({ name }: { name: string }) => `刷新仓库 ${name}`,
    refreshAllTitle: '刷新全部扩展仓库',
    allSubjectLabel: '全部扩展仓库',
    cancelledSummary: '扩展仓库刷新已取消',
    preparing: '准备刷新扩展仓库',
    noneEnabled: '没有启用的扩展仓库',
    refreshingOne: ({ name }: { name: string }) => `正在刷新 ${name}`,
    refreshedOne: ({ name }: { name: string }) => `已刷新 ${name}`,
    oneFailedTitle: '仓库刷新失败',
    oneFailedSummary: ({ name }: { name: string }) => `${name} 刷新失败`,
    oneNotModifiedTitle: '仓库未变化',
    oneCompletedTitle: '仓库刷新完成',
    oneNotModifiedSummary: ({ name }: { name: string }) => `${name} 已是最新`,
    oneRefreshedSummary: ({ name }: { name: string }) => `${name} 已刷新`,
    allFailedTitle: '扩展仓库刷新失败',
    allPartialTitle: '部分扩展仓库刷新失败',
    allCompletedTitle: '扩展仓库刷新完成',
    noneEnabledSummary: '没有启用的扩展仓库',
    allSummary: ({
      processed,
      total,
      succeeded,
      notModified,
      failed
    }: {
      processed: number
      total: number
      succeeded: number
      notModified: number
      failed: number
    }) =>
      `已处理 ${processed}/${total} 个仓库，成功 ${succeeded}，未变化 ${notModified}，失败 ${failed}`
  },

  updatePolicyDialog: {
    title: '更新配置',
    policyLabel: '更新策略',
    receivePrerelease: '接收预览版更新',
    saved: '更新配置已保存',
    saveFailed: '保存更新配置失败'
  },

  uninstall: {
    title: ({ name }: { name: string }) => `卸载 ${name}？`,
    purgeData: '同时清除扩展数据',
    confirmPurge: '卸载并清除',
    confirm: '卸载',
    uninstalledPurged: '扩展已卸载并清除数据',
    uninstalled: '扩展已卸载',
    purgeFailed: '扩展已卸载，清除数据失败',
    failed: '卸载失败'
  },

  discover: {
    emptyTitle: '未找到扩展',
    emptyCategoryDescription: '该分类下暂无可用扩展',
    emptyDescription: '暂无可用扩展',
    loadMore: '加载更多',
    sortRelevance: '相关',
    sortName: '名称',
    sortPublishedAt: '发布',
    sortUpdatedAt: '更新',
    sortRepositoryPriority: '仓库',
    searchPlaceholder: '搜索扩展名称或描述…',
    allRepositories: '全部仓库',
    compatibleOnly: '仅显示兼容版本',
    allCompatibility: '显示全部兼容状态',
    allCategories: '全部',
    unknownAuthor: '未知作者',
    sourceCount: ({ count }: { count: number }) => `${count} 个来源`,
    noVersion: '无版本',
    noDescription: '无描述',
    homepage: '主页',
    details: '详情',
    installed: '已安装',
    install: '安装',
    unknownTime: '未知时间',
    unknownSize: '未知大小',
    extensionId: '扩展 ID',
    author: '作者',
    latestPublish: '最近发布',
    codeRepository: '代码仓库',
    versions: '版本',
    latestBadge: '最新版',
    previewBadge: '预览版',
    yankedBadge: '已撤回',
    apiIncompatibleBadge: 'API 不兼容',
    noArtifactBadge: '无可用包',
    unsignedBadge: '未签名',
    sourcesLine: ({ value }: { value: string }) => `来源：${value}`,
    publishedLine: ({ value }: { value: string }) => `发布时间：${value}`,
    apiLine: ({ value }: { value: string }) => `扩展 API：${value}`,
    sizeLine: ({ value }: { value: string }) => `安装包大小：${value}`
  },

  installed: {
    filterAll: '全部',
    filterEnabled: '已启用',
    filterDisabled: '已禁用',
    sortName: '名称',
    sortStatus: '状态',
    sortHasUpdate: '更新',
    startupUpdating: '启动更新中',
    repositoryRefreshFailed: '仓库刷新失败',
    autoUpdateFailedCount: ({ count }: { count: number }) => `${count} 个自动更新失败`,
    searchPlaceholder: '搜索已安装的扩展…',
    checkUpdates: '检查更新',
    showAll: '显示全部',
    showUpdatesOnly: '仅显示有更新',
    updatesAvailable: '发现可用更新',
    updatesAvailableCount: ({ count }: { count: number }) => `${count} 个扩展可以更新`,
    noUpdates: '暂无可用更新',
    checkUpdatesFailed: '检查更新失败',
    emptyTitle: '暂无已安装的扩展',
    emptyDescription: '从「发现」页面安装扩展',
    noMatchTitle: '没有匹配的扩展',
    noMatchDescription: '尝试调整筛选条件',

    unknownVersion: '未知版本',
    statusReady: '正常',
    statusInvalid: '包无效',
    statusMissingPackage: '包缺失',
    runtimeLoading: '加载中',
    runtimeRunning: '运行中',
    runtimeFailed: '加载失败',
    runtimeStopped: '未运行',
    builtinManaged: '内置扩展由 Kisaki 管理',
    enableFailed: '无法启用扩展',
    packageNotRunnable: '扩展包当前不可运行',
    enabledFeedback: '扩展已启用',
    disabledFeedback: '扩展已禁用',
    operationFailed: '操作失败',
    extensionOperationFailed: '扩展操作失败',
    builtinBadge: '内置',
    updateBadge: '更新',
    unknownAuthor: '未知',
    noDescription: '无描述',
    enableWithApp: '随应用启用',
    enabledState: '启用',
    disabledState: '禁用',
    update: '更新',
    detailsTooltip: '详情',
    updatePolicyTooltip: '更新配置',
    uninstallTooltip: '卸载',

    details: {
      basicInfo: '基础信息',
      extensionId: '扩展 ID',
      version: '版本',
      author: '作者',
      unknownAuthor: '未知作者',
      category: '类别',
      installedAt: '安装时间',
      homepage: '主页',
      status: '状态',
      enabledStatus: '启用状态',
      enabled: '已启用',
      disabled: '已禁用',
      packageStatus: '包状态',
      runtimeStatus: '运行状态',
      runtimeError: '运行错误',
      installationSource: '安装来源',
      sourceType: '类型',
      sourceBuiltin: '内置扩展',
      sourceRepository: '仓库安装',
      sourceLocalFile: '本地文件',
      sourceUnknown: '未知来源',
      repository: '仓库',
      repositoryUrl: '仓库地址',
      releaseDigest: '发布摘要',
      manifestDigest: '清单摘要',
      artifactSha256: '安装包 SHA256',
      signerFingerprint: '签名指纹',
      releaseVersion: '发布版本',
      publishedAt: '发布时间',
      extensionApi: '扩展 API',
      file: '文件',
      installDir: '安装目录',
      updateConfig: '更新配置',
      updatePolicy: '更新策略',
      pinnedVersion: '锁定版本',
      receivePrerelease: '接收预览版更新',
      packageIssues: '包问题',
      runtimeDiagnostics: '运行诊断',
      unknownTime: '未知时间',
      severityInfo: '信息',
      severityWarning: '警告',
      severityError: '错误'
    }
  },

  repository: {
    none: '无',
    stateEnabled: '已启用',
    stateDisabled: '已禁用',
    healthDisabled: '已禁用',
    healthError: '异常',
    healthNeverRefreshed: '未刷新',
    healthOk: '正常',
    added: '仓库已添加',
    addFailed: '添加仓库失败',
    officialAdded: '官方仓库已添加',
    officialAddFailed: '添加官方仓库失败',
    refreshAllStarted: '已开始刷新扩展仓库',
    refreshFailed: '刷新仓库失败',
    refreshStarted: '已开始刷新仓库',
    enabledFeedback: '仓库已启用',
    disabledFeedback: '仓库已禁用',
    deleted: '仓库已删除',
    operationFailed: '仓库操作失败',
    refreshAll: '刷新全部',
    addOfficial: '添加官方仓库',
    add: '添加仓库',
    emptyTitle: '暂无扩展仓库',
    priorityLine: ({ value }: { value: string }) => `优先级：${value}`,
    packageCountLine: ({ count }: { count: number }) => `扩展包：${count}`,
    manifestUpdatedLine: ({ value }: { value: string }) => `清单更新：${value}`,
    lastCheckedLine: ({ value }: { value: string }) => `上次检查：${value}`,
    detailsTooltip: '详情',

    addDialog: {
      title: '添加扩展仓库',
      manifestUrl: '仓库清单 URL',
      displayName: '显示名称',
      displayNamePlaceholder: '留空使用仓库清单名称'
    },

    removeDialog: {
      title: ({ name }: { name: string }) => `删除 ${name}？`,
      description: '确定要删除该仓库吗？删除后将不再从该仓库获取扩展目录，已安装的扩展不会被卸载。',
      deleting: '删除中'
    },

    details: {
      basicInfo: '基础信息',
      repositoryId: '仓库 ID',
      priority: '优先级',
      packages: '扩展包',
      localState: '本地状态',
      manifestUrl: '仓库清单 URL',
      manifestMetadata: '清单元数据',
      manifestDigest: '清单摘要',
      manifestUpdatedAt: '清单更新时间',
      refreshState: '刷新状态',
      lastChecked: '上次检查',
      lastSuccess: '上次成功',
      lastError: '最近错误',
      localRecord: '本地记录',
      createdAt: '创建时间',
      updatedAt: '更新时间'
    }
  },

  signer: {
    none: '无',
    localConfirmation: '本地确认',
    revoked: '签名信任已撤销',
    revokeFailed: '撤销签名信任失败',
    emptyTitle: '暂无信任的签名指纹',
    sourceLine: ({ value }: { value: string }) => `来源：${value}`,
    trustedAtLine: ({ value }: { value: string }) => `信任时间：${value}`,
    viewDetails: '查看详情',
    revokeTrust: '撤销信任',

    removeDialog: {
      title: '撤销签名信任？',
      description: ({ id }: { id: string }) =>
        `确定要撤销「${id}」的签名信任吗？新版本使用该指纹时将需要重新确认。`,
      revoking: '撤销中',
      revoke: '撤销'
    },

    details: {
      title: '签名详情',
      extensionId: '扩展 ID',
      algorithm: '算法',
      keyId: '密钥 ID',
      fingerprint: '签名指纹',
      publicKey: '公钥',
      trustRecordId: '信任记录 ID',
      sourceRepositoryId: '来源仓库 ID',
      sourceRepositoryUrl: '来源仓库 URL',
      trustedAt: '信任时间',
      createdAt: '创建时间'
    }
  }
} satisfies Messages['extension']
