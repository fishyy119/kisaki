/** Simplified Chinese message catalog for the Bangumi extension. */

import type { BangumiMediaScope } from '../../scopes'
import type { en } from './en'

type Scope = BangumiMediaScope
type CollectionType = 1 | 2 | 3 | 4 | 5

/** Scope noun with its measure word, used after a count. */
const COUNT_NOUNS: Record<Scope, string> = {
  book: '本书籍',
  game: '个游戏',
  anime: '部动画',
  music: '个音乐条目'
}

const NOUNS: Record<Scope, string> = {
  book: '书籍',
  game: '游戏',
  anime: '动画',
  music: '音乐条目'
}

const SCOPES: Record<Scope, string> = {
  book: '书籍',
  game: '游戏',
  anime: '动画',
  music: '音乐'
}

const COLLECTIONS: Record<Scope, Record<CollectionType, string>> = {
  book: { 1: '想读', 2: '读过', 3: '在读', 4: '搁置', 5: '抛弃' },
  game: { 1: '想玩', 2: '玩过', 3: '在玩', 4: '搁置', 5: '抛弃' },
  anime: { 1: '想看', 2: '看过', 3: '在看', 4: '搁置', 5: '抛弃' },
  music: { 1: '想听', 2: '听过', 3: '在听', 4: '搁置', 5: '抛弃' }
}

function countOf(scope: Scope, count: number): string {
  return `${count} ${COUNT_NOUNS[scope]}`
}

export const zhHans = {
  common: {
    cancel: '取消',
    close: '关闭',
    confirm: '确认',
    create: '创建',
    preview: '预览',
    none: '无',
    listSeparator: '、'
  },

  media: {
    scopes: SCOPES,
    collections: COLLECTIONS
  },

  errors: {
    authRequired: '请先登录 Bangumi 账号',
    authSessionInvalid: 'Bangumi 会话已失效，请重新登录',
    tokenRefreshFailed: 'Bangumi 凭据刷新失败，请重新登录',
    refreshTokenMissing: '不存在 Bangumi 刷新令牌，请重新登录',
    tokenSaveFailed: 'Bangumi 凭据保存失败',

    loginNotReady: 'Bangumi 登录尚未就绪',
    loginSessionExpired: 'Bangumi 登录会话已过期，请重新登录',
    loginCallbackInvalid: 'Bangumi 登录回调校验失败，请重新登录',
    loginDenied: 'Bangumi 授权已被拒绝，请重新登录',
    loginAuthorizeFailed: 'Bangumi 返回了授权错误，请重新登录',
    noPendingLogin: '没有等待完成的 Bangumi 登录',

    relayUnavailable: 'Kisaki OAuth 中继暂时不可用，请稍后再试',

    apiNotFound: 'Bangumi 条目不存在',
    apiRateLimited: 'Bangumi API 请求过于频繁，请稍后再试',
    apiRejected: 'Bangumi API 拒绝了本次请求',
    apiUnavailable: 'Bangumi API 暂时不可用',
    networkFailed: 'Bangumi API 网络请求失败',
    accountResponseInvalid: '无法识别 Bangumi 账号响应',
    idInvalid: ({ value }) => `“${value}”不是有效的 Bangumi ID`,

    operationCancelled: '操作已取消',
    jobCancelled: 'Bangumi 任务已取消',
    jobFailed: 'Bangumi 任务失败',
    jobAlreadyRunning: '该 Bangumi 任务正在运行，请等待完成或先取消',

    invalidMediaScope: '请选择有效的 Bangumi 媒体类型',
    mediaScopeNotRegistered: '该 Bangumi 媒体类型未注册',
    localWriteUnsupported: ({ scope }: { scope: Scope }) => `${SCOPES[scope]}暂不支持写入本地库`,
    localWriteUnsupportedGeneric: '该媒体类型暂不支持写入本地库',

    localMediaMissing: '本地条目不存在',
    bookKindUnresolved: 'Bangumi 未说明该书籍是漫画还是小说，因此未导入',
    localItemMissing: '本地条目不存在',
    importedItemMissing: '已导入的本地条目不存在',
    targetCollectionMissing: '所选目标合集不存在',
    selectTargetCollection: '请选择目标合集',
    indexTitleEmpty: 'Bangumi 目录标题为空，无法创建合集',
    indexInputRequired: '请输入 Bangumi 目录 ID 或链接',
    indexInputInvalid:
      'Bangumi 目录需要是数字 ID，或形如 https://bgm.tv/index/<id>、https://bangumi.tv/index/<id> 的链接',
    indexSubjectMissingId: 'Bangumi 目录条目缺少有效的条目 ID',
    collectionMissingSubjectId: 'Bangumi 收藏缺少有效的条目 ID',
    profileRequired: '请选择用于创建本地条目的刮削配置',
    profileNotFound: '所选刮削配置不存在'
  },

  oauth: {
    loginSucceededTitle: 'Bangumi 登录成功',
    loginFailedTitle: 'Bangumi 登录失败',
    loginCompleted: ({ nickname }: { nickname: string }) => `Bangumi 已登录：${nickname}`,
    callbackFailed: 'Bangumi 登录回调失败，请返回设置页面重试'
  },

  notifications: {
    autoSyncFailedTitle: 'Bangumi 自动同步失败',
    autoSyncFailedFallback: 'Bangumi 自动同步失败'
  },

  commands: {
    authRefresh: {
      title: '刷新 Bangumi 凭据',
      description: '刷新 Bangumi 令牌并验证当前账号'
    },
    syncChanged: {
      title: '同步已变更的 Bangumi 条目',
      description: '同步本次运行期间排队的本地条目变更'
    },
    syncFull: {
      title: 'Bangumi 全量同步',
      description: '扫描本地条目并同步 Bangumi 收藏状态与评分'
    },
    importCollections: {
      title: '导入我的 Bangumi 收藏',
      description: '按媒体类型导入当前 Bangumi 用户的收藏'
    },
    importIndex: {
      title: '导入 Bangumi 目录',
      description: '按媒体类型从 Bangumi 目录导入条目'
    }
  },

  jobs: {
    completed: 'Bangumi 任务已完成',
    cancelled: 'Bangumi 任务已取消',

    auth: {
      refreshingToken: '正在刷新 Bangumi 凭据…',
      verifyingAccount: '正在验证 Bangumi 账号…',
      accountValid: ({ nickname }: { nickname: string }) => `Bangumi 账号有效：${nickname}`,
      accountRefreshed: ({ nickname }: { nickname: string }) =>
        `Bangumi 账号摘要已更新：${nickname}`
    },

    sync: {
      loadingQueue: '正在读取 Bangumi 变更队列…',
      syncingQueue: '正在同步 Bangumi 变更队列…',
      queueUnsupported: ({ scope }: { scope: Scope }) => `${SCOPES[scope]}暂不支持本地变更同步`,
      queueCompleted: ({ count }: { count: number }) => `变更队列同步完成：已同步 ${count} 个条目`,
      fullUnsupported: ({ scope }: { scope: Scope }) => `${SCOPES[scope]}暂不支持本地全量同步`,
      fullCompleted: ({ count, scope }: { count: number; scope: Scope }) =>
        `全量同步完成：已同步 ${countOf(scope, count)}`,
      previewCompleted: ({ count, scope }: { count: number; scope: Scope }) =>
        `全量同步预览完成：可同步 ${countOf(scope, count)}`,
      scanningItems: ({ scope }: { scope: Scope }) => `正在扫描${NOUNS[scope]}…`,
      collectingItems: ({ scope }: { scope: Scope }) => `正在计算待同步的${NOUNS[scope]}…`,
      previewingItems: '正在预览 Bangumi 全量同步…',
      applyingItems: '正在同步 Bangumi 全量同步条目…'
    },

    import: {
      validating: '正在检查 Bangumi 导入参数…',
      validatingIndex: '正在检查 Bangumi 目录导入参数…',
      readingCollections: ({ scope, type }: { scope: Scope; type: CollectionType }) =>
        `正在读取 Bangumi「${COLLECTIONS[scope][type]}」收藏…`,
      readingIndex: '正在读取 Bangumi 目录条目…',
      matchingLocal: ({ scope }: { scope: Scope }) => `正在匹配${NOUNS[scope]}…`,
      collectingPlan: ({ scope }: { scope: Scope }) => `正在计算待导入的${NOUNS[scope]}…`,
      preparing: ({ scope }: { scope: Scope }) => `正在准备导入${NOUNS[scope]}…`,
      creatingLocal: ({ scope }: { scope: Scope }) => `正在添加${NOUNS[scope]}…`,
      patchingLocal: ({ scope }: { scope: Scope }) => `正在更新${NOUNS[scope]}…`,
      writeUnsupported: ({ scope }: { scope: Scope }) => `${SCOPES[scope]}暂不支持写入本地库`,
      collectionsCompleted: ({
        added,
        updated,
        scope
      }: {
        added: number
        updated: number
        scope: Scope
      }) => `收藏导入完成：新增 ${countOf(scope, added)}，更新已有 ${updated} 个`,
      collectionsPreviewCompleted: ({
        toImport,
        toPatch,
        scope
      }: {
        toImport: number
        toPatch: number
        scope: Scope
      }) => `收藏导入预览完成：将导入 ${countOf(scope, toImport)}，将更新已有 ${toPatch} 个`,
      indexCompleted: ({
        added,
        updated,
        scope
      }: {
        added: number
        updated: number
        scope: Scope
      }) => `目录导入完成：新增 ${countOf(scope, added)}，更新已有 ${updated} 个`,
      indexPreviewCompleted: ({
        toImport,
        toPatch,
        scope
      }: {
        toImport: number
        toPatch: number
        scope: Scope
      }) => `目录导入预览完成：将导入 ${countOf(scope, toImport)}，将更新已有 ${toPatch} 个`,
      buildingCollectionsPreview: '正在生成收藏导入预览…',
      buildingIndexPreview: '正在生成目录导入预览…',
      buildingRemoteCollectionsPreview: '正在生成远端收藏预览…',
      buildingRemoteIndexPreview: '正在生成远端目录预览…',
      remoteCollectionsPreviewCompleted: ({ scope }: { scope: Scope }) =>
        `${SCOPES[scope]}远端收藏预览完成`,
      remoteIndexPreviewCompleted: ({ scope }: { scope: Scope }) =>
        `${SCOPES[scope]}目录远端预览完成`
    },

    preview: {
      remoteBadge: ({ scope }: { scope: Scope }) => `${SCOPES[scope]}远端预览`,
      createLocalBadge: ({ scope }: { scope: Scope }) => `创建本地${NOUNS[scope]}`,
      updateLocalBadge: ({ scope }: { scope: Scope }) => `更新本地${NOUNS[scope]}`,
      createRemoteCollectionBadge: '创建 Bangumi 收藏',
      updateRemoteCollectionBadge: '更新 Bangumi 收藏',
      collectionStatus: '收藏状态',
      status: '状态',
      score: '评分',
      tags: '标签',
      collection: '合集',
      unitProgress: '阅读进度',
      unitProgressValue: ({ volumes, chapters }: { volumes: number; chapters: number }) =>
        `${volumes} 卷 / ${chapters} 话`,
      notCollected: '未收藏',
      notRated: '未评分',
      notInCollection: '未加入',
      notSet: '未设置',
      missing: '不存在',
      create: '创建',
      remote: '远端',
      indexEntry: '目录条目',
      remotePreview: '远端预览'
    },

    status: {
      planned: '计划中',
      active: '进行中',
      completed: '已完成',
      onHold: '搁置',
      dropped: '抛弃',
      unset: '未设置'
    }
  },

  automations: {
    names: {
      'auth-refresh': 'Bangumi：启动时刷新凭据',
      'sync-changed': 'Bangumi：启动后同步变更队列',
      'sync-full-daily': 'Bangumi：每日全量同步'
    },
    labels: {
      'auth-refresh': '启动时刷新凭据',
      'sync-changed': '启动后同步变更队列',
      'sync-full-daily': '每日全量同步'
    },
    descriptions: {
      'auth-refresh': '应用启动时刷新并验证 Bangumi 凭据',
      'sync-changed': '应用启动后同步上次运行期积累的本地变更',
      'sync-full-daily': '每天凌晨执行一次媒体库全量同步'
    },
    status: {
      missing: '未创建',
      enabled: '已启用',
      disabled: '已禁用'
    }
  },

  settings: {
    commandLabel: '设置',
    commandDescription: '打开 Bangumi 集成设置',
    webviewTitle: 'Bangumi'
  },

  ui: {
    loading: '正在加载 Bangumi 设置…',
    unavailable: 'Bangumi 设置不可用',
    unsavedChanges: '有未保存的更改',
    discardChanges: '放弃更改',
    savePreferences: '保存偏好',
    actionFailed: '操作失败，请重试',
    mediaScope: '媒体类型',
    mediaScopePlaceholder: '选择媒体类型',

    tabs: {
      overview: '概览',
      account: '账号',
      sync: '同步',
      import: '导入',
      automation: '自动化',
      maintenance: '维护'
    },

    overview: {
      statusTitle: '状态概览',
      accountLabel: '账号',
      notLoggedIn: '未登录',
      loggedIn: '已登录',
      notAuthorized: '未授权',
      credentialsExpired: '凭据过期',
      available: '可用',
      autoSyncLabel: '自动同步',
      enabled: '已启用',
      disabled: '未启用',
      syncItemCreate: '创建收藏',
      syncItemStatus: '游玩状态',
      syncItemScore: '评分',
      noSyncItems: '未选择同步项',
      recommendedAutomations: '推荐自动化',
      automationsComplete: '已全部创建',
      automationsMissing: ({ count }: { count: number }) => `${count} 个未创建`,
      templatesCount: ({ count }: { count: number }) => `${count} 个模板`,
      runtimeTitle: '运行状态',
      runningJobs: '正在运行的 Bangumi 任务',
      running: '运行中',
      idle: '空闲',
      localResources: '可用本地资源',
      localResourcesSummary: ({
        profiles,
        collections
      }: {
        profiles: number
        collections: number
      }) => `${profiles} 个刮削配置 / ${collections} 个合集`,
      quickActionsTitle: '快捷入口',
      importAction: '导入 Bangumi 收藏或目录',
      maintenanceAction: '调整网络和维护选项',
      automationsTitle: '自动化模板'
    },

    account: {
      sectionTitle: 'Bangumi 账号',
      loginStatus: '登录状态',
      verifiedDescription: ({ nickname }: { nickname: string }) => `账号验证成功：${nickname}`,
      notLoggedIn: '未登录',
      accessToken: '访问令牌',
      tokenSaved: '已保存',
      tokenMissing: '未保存',
      refreshable: '可刷新',
      expired: '已过期',
      expiresAt: '凭据有效期',
      actionsTitle: '账号操作',
      login: '登录 Bangumi',
      verify: '验证账号',
      refreshCredentials: '刷新凭据',
      logout: '退出登录'
    },

    sync: {
      preferencesTitle: '自动同步偏好',
      autoSync: '自动同步',
      autoSyncDescription: '监听本地条目创建和用户态字段变更',
      syncItems: '同步项',
      itemCreate: '创建收藏',
      itemStatus: '条目状态',
      itemScore: '评分',
      itemUnitProgress: '单元进度',
      clearRemoteScore: '允许删除远端评分',
      clearRemoteScoreDescription: '本地评分清空时同时清除 Bangumi 评分',
      manualTitle: '手动同步',
      manualDescription: '立即同步变更队列，或配置一次全量同步。进度和取消由任务中心处理。',
      syncChangedNow: '立即同步变更',
      fullSync: '全量同步'
    },

    import: {
      noProfilesWarning: '当前媒体类型尚未配置刮削配置，导入仍可预览，但执行本地写入前需要可用配置',
      sourceTitle: '导入来源',
      sourceDescription: '导入是一次性任务；选项只用于本次运行，不写入 Bangumi 偏好',
      myCollections: '我的收藏',
      myCollectionsDescription: '按收藏类型导入当前 Bangumi 用户所选媒体类型的收藏',
      bangumiIndex: 'Bangumi 目录',
      bangumiIndexDescription: '输入目录 ID 或链接后配置导入',
      indexPlaceholder: '目录 ID 或 https://bgm.tv/index/..',
      configureImport: '配置导入'
    },

    automation: {
      title: '推荐自动化',
      description: '这里只创建 Bangumi 推荐模板；启停、触发条件和历史由主应用自动化页面负责',
      create: '创建'
    },

    maintenance: {
      networkTitle: '网络与客户端',
      networkDescription: '这些偏好保存后影响后续 Bangumi API 请求',
      loginTimeout: '登录超时',
      minutes: '分钟',
      rateLimit: 'API 速率限制',
      rateLimitDescription: '请求数 / 时间窗口',
      seconds: '秒',
      apiTimeout: 'API 超时',
      retryCount: '重试次数',
      retryUnit: '次',
      debounce: '自动同步防抖',
      notifyErrors: '同步错误通知',
      notifyErrorsDescription: '同步任务失败时发送主应用通知',
      actionsTitle: '维护操作',
      actionsDescription: '这些操作立即生效且不可撤销',
      clearSyncState: '清除同步状态',
      clearSyncStateDescription: '将清空同步指纹与变更队列，下次同步会重新比对全部条目',
      resetSettings: '恢复默认设置',
      resetSettingsDescription: '将把 Bangumi 偏好设置重置为默认值，不会退出账号或删除自动化',
      confirmAction: '确认执行'
    },

    fullSync: {
      title: '全量同步',
      syncData: '同步数据',
      itemStatus: '条目状态',
      itemScore: '评分',
      itemUnitProgress: '单元进度',
      updateExisting: '更新已有收藏',
      updateExistingDescription: '关闭时只为远端缺失的条目创建 Bangumi 收藏',
      clearRemoteScore: '允许删除远端评分',
      batchSize: '批次大小',
      run: '执行同步',
      previewTitle: '全量同步预览',
      previewDescription: '确认即将同步到 Bangumi 的变更'
    },

    importCollections: {
      title: '导入我的收藏',
      profile: '刮削配置',
      profilePlaceholder: '选择刮削配置',
      collectionTypes: '收藏类型',
      dataItems: '导入用户态字段',
      itemStatus: '条目状态',
      itemScore: '评分',
      itemTags: '标签',
      itemUnitProgress: '阅读进度',
      patchExisting: '更新已有条目',
      targetCollection: '加入合集',
      collectionPlaceholder: '选择合集',
      start: '开始导入',
      previewTitle: '导入我的收藏预览',
      previewDescription: '确认将创建、更新或跳过的条目'
    },

    importIndex: {
      title: '导入目录',
      index: '目录',
      profile: '刮削配置',
      profilePlaceholder: '选择刮削配置',
      targetCollection: '目标合集',
      targetNone: '不放入合集',
      targetExisting: '已有合集',
      targetByIndexTitle: '按目录标题创建',
      selectCollection: '选择合集',
      collectionPlaceholder: '选择合集',
      patchExisting: '更新已有条目',
      start: '开始导入',
      previewTitle: '导入目录预览',
      previewDescription: '确认将创建、更新或跳过的条目'
    },

    previewDialog: {
      empty: '没有将要更改的条目'
    }
  }
} satisfies typeof en
