# 07 Settings Storage And Tasks

## 设置面板

Bangumi 设置贡献拆成 6 个 screen：

1. Index

   账号摘要、最近同步状态、最近导入结果、常用操作入口、后台 task 状态摘要。

2. Account

   登录状态、Kisaki 官方 OAuth Relay 状态、redirect URI 诊断、User-Agent 诊断、登录/退出/验证。

3. Sync

   自动同步开关、状态/评分开关、状态映射表、评分策略、未绑定处理、手动全量同步入口。

4. Import My Database

   收藏类型多选、scraper profile、目标合集、字段映射、dry-run、执行导入。

5. Import Bangumi Index

   目录 ID/URL、目录预览、scraper profile、目标合集、dry-run、执行导入。

6. Advanced

   Bangumi provider client rate limit、job history、清理缓存、清理 token、导出诊断。

当前 structured settings panel 就是扩展 UI 的正式设计方向。Bangumi 设置使用多 screen/dialog 组织复杂操作；后台任务的通用管理 UI 放在主应用 sidebar 下方 dropdown 打开的后台任务 dialog 中。

## Extension Storage

非敏感 settings 存 extension storage：

```ts
interface BangumiSettingsV2 {
  version: 2
  auth: {
    mode: 'kisakiRelay' | 'devOverride'
    relayBaseUrl?: string
    redirectUri?: string
    devClientId?: string
  }
  sync: {
    autoSyncEnabled: boolean
    autoSyncStatus: boolean
    autoSyncScore: boolean
    syncOnCreate: boolean
    unmappedStrategy: 'skip' | 'notify' | 'resolveWithProfile'
    resolveProfileId?: string
    statusToBangumi: Record<LibraryGameStatus, SubjectCollectionType | 'skip'>
    bangumiToStatus: Record<SubjectCollectionType, LibraryGameStatus | 'skip'>
    scoreMode: 'skipEmpty' | 'deleteRemoteWhenEmpty'
  }
  import: {
    defaultProfileId?: string
    defaultTargetCollectionId?: string
    importStatus: boolean
    importScore: boolean
    importTags: boolean
    importComment: false | 'note' | 'metadata'
    conflictPolicy: 'skip' | 'fillMissing' | 'overwriteSelected'
  }
  rateLimit: {
    providerRequestsPerSecond: number
    providerBurst: number
    retryCount: number
    backoffBaseMs: number
    backoffMaxMs: number
  }
}
```

同步状态可存 extension storage：

- `sync.lastFingerprintByGameId`
- `sync.lastRemotePayloadBySubjectId`
- `jobs.history`
- `imports.lastResult`

## Secrets

敏感值存 secure secrets：

- `oauth.accessToken`
- `oauth.refreshToken`
- `oauth.expiresAt`
- `oauth.devClientSecret`，仅开发模式可用，生产版不写入也不读取

Kisaki 官方 Bangumi 应用的 `client_secret` 永远不存入本机。

## Background Tasks

后台任务配置不存入 Bangumi extension storage。它属于主应用 `BackgroundTaskService`，存储 command id、args、schedule、enabled、history 等通用任务数据。

后台任务实例配置：

- `commandId`
- `args`
- `ownerExtensionId`
- `createdBy`: `user` 或 `extension`
- `enabled`
- `schedule`: `manual`、`onStartup`、`interval`、`daily`、`weekly`
- `failurePolicy`: `none`、`retry`、`pauseTask`
- `retryCount`
- `lastRun`
- `nextRun`
- `history`

Bangumi 设置面板中的自动化按钮直接调用后台任务 API 创建/删除 task 实例，例如：

- 启用/关闭启动时刷新 Bangumi token。
- 启用/关闭启动后同步自上次成功后变更过的游戏。
- 启用/关闭每日全量同步 Kisaki 状态和评分到 Bangumi。
- 启用/关闭每周导入我的 Bangumi 游戏收藏。
- 启用/关闭每周导入指定 Bangumi 目录。

主应用后台任务面板展示这些 task，并允许用户继续调整 schedule、args、enabled 状态和失败策略。
