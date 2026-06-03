# 02 Extension API And Host Changes

Vnite 导入需要新增宿主能力。扩展 API 尚未上线，本设计直接定义目标 API，不保留兼容别名。

## API 原则

- 公共契约先于实现，类型放在 `packages/extension-api/src/capabilities/**`。
- 扩展只提交结构化 DTO，不导入 app 内部 Drizzle schema、ServiceContainer 或 Electron API。
- 宿主负责事务、去重、附件写入、FTS、事件和数据库触发器。
- 长任务统一使用 `kisaki.taskRuns` 或 app-owned TaskRun。
- 大二进制不通过 RPC 传输。扩展把文件写到扩展临时目录，再传受限绝对路径。
- API 名称使用当前扩展系统规则：capability method strings 使用 `capabilities.<capability>.<operation>`。

## 新增 `kisaki.files`

当前 settings panel 没有文件选择节点，runtime capability 也只有 `openExternal`。Vnite 导入需要用户选择 zip。新增 host-owned files capability：

```ts
export interface FileDialogFilter {
  name: string
  extensions: readonly string[]
}

export interface OpenFileInput {
  title?: string
  filters?: readonly FileDialogFilter[]
  copyTo?: 'temp' | 'data'
  maxSizeBytes?: number
}

export interface OpenedFile {
  id: string
  name: string
  extension: string
  sizeBytes: number
  path: string
  originalPathLabel: string
  createdAt: number
}

export interface FilesCapability {
  openFile(input?: OpenFileInput): Promise<OpenedFile | null>
  release(fileId: string): Promise<void>
}
```

行为：

- `openFile` 由主进程打开系统文件选择器。
- 选中文件复制到 `userData/extensions/data/<extensionId>/temp/files/<fileId>/<basename>`。
- 返回的 `path` 必须位于扩展 `dataPath` 或 `tempPath` 内。
- `originalPathLabel` 只用于 UI 展示 basename 或经过脱敏的路径片段，不用于日志。
- `release` 删除该 file grant 目录；扩展停用时宿主清理过期 temp grants。

RPC：

```ts
'capabilities.files.openFile'
'capabilities.files.release'
```

主进程实现位置：

```text
packages/extension-api/src/capabilities/files.ts
packages/extension-api/src/rpc/capabilities.ts
apps/desktop/src/main/services/extension/capabilities/files.ts
apps/desktop/src/main/services/extension/capabilities/gateway.ts
apps/desktop/src/main/services/extension/runtime/host/sdk-bridge/kisaki-api.ts
packages/extension-sdk/src/index.ts
```

## 新增 `kisaki.library.imports.applyGamePlan`

细粒度 `kisaki.library.games.create`、`tags.create`、`relations.create` 可用于小操作，但不适合作为数据库导入主路径：它们不是一个事务，不能统一处理附件、sessions、notes、冲突策略和 provenance。新增通用 game library import capability。

```ts
export type LibraryGameImportConflictMode = 'skipExisting' | 'mergeSelected' | 'overwriteSelected'

export interface LibraryGameImportSource {
  source: 'vnite' | string
  label: string
  runId: string
}

export interface LibraryGameImportOptions {
  conflictMode: LibraryGameImportConflictMode
  dryRun?: boolean
}

export interface LibraryGameImportPlan {
  source: LibraryGameImportSource
  options: LibraryGameImportOptions
  games: readonly LibraryGameImportItem[]
  collections: readonly LibraryCollectionImportItem[]
}

export interface LibraryGameImportItem {
  sourceGameId: string
  match: LibraryGameImportMatch
  fields: LibraryGameImportGameFields
  relations?: LibraryGameImportRelations
  sessions?: readonly LibraryGameSessionImportItem[]
  notes?: readonly LibraryGameNoteImportItem[]
  attachments?: readonly LibraryGameAttachmentImportItem[]
  diagnostics?: readonly LibraryImportDiagnostic[]
}

export interface LibraryGameImportMatch {
  externalIds: readonly ExternalId[]
  gameDirPath?: string
}
```

`LibraryGameImportGameFields` 是经过字段选择后的 Kisaki game patch/create 数据，支持 import-only audit fields：

```ts
export interface LibraryGameImportGameFields extends LibraryGameCreateInput {
  sourceCreatedAt?: number
  sourceUpdatedAt?: number
}
```

`sourceCreatedAt` 默认写入 `games.createdAt`。`sourceUpdatedAt` 只在明确存在时写入 `games.updatedAt`，否则由宿主使用当前时间。普通 `LibraryGameCreateInput` 不需要暴露 audit 字段。

关系和附属数据：

```ts
export interface LibraryGameImportRelations {
  tags?: readonly LibraryTagImportItem[]
  companies?: readonly LibraryGameCompanyImportItem[]
  persons?: readonly LibraryGamePersonImportItem[]
}

export interface LibraryTagImportItem {
  name: string
  note?: string
  isNsfw?: boolean
  order?: number
}

export interface LibraryGameCompanyImportItem {
  name: string
  type: LibraryGameCompanyRole
  order?: number
}

export interface LibraryGamePersonImportItem {
  name: string
  type: LibraryGamePersonRole
  order?: number
  note?: string
}

export interface LibraryGameSessionImportItem {
  sourceSessionId: string
  startedAt: number
  endedAt: number
}

export interface LibraryGameNoteImportItem {
  sourceNoteId: string
  name: string
  content?: string
  coverPath?: string
  createdAt?: number
  order?: number
}

export interface LibraryGameAttachmentImportItem {
  slot: 'cover' | 'backdrop' | 'logo' | 'icon' | 'description-inline' | 'save-backup'
  sourcePath: string
  fileName?: string
  contentType?: string
  replace?: boolean
  saveBackup?: {
    backupAt: number
    note: string
    locked: boolean
  }
}

export interface LibraryCollectionImportItem {
  sourceCollectionId: string
  name: string
  description?: string
  order?: number
  isNsfw?: boolean
  gameSourceIds: readonly string[]
}
```

结果：

```ts
export interface LibraryGameImportResult {
  source: LibraryGameImportSource
  dryRun: boolean
  startedAt: number
  finishedAt: number
  games: readonly LibraryGameImportItemResult[]
  collections: readonly LibraryCollectionImportItemResult[]
  counters: Record<string, number>
  diagnostics: readonly LibraryImportDiagnostic[]
}

export interface LibraryGameImportItemResult {
  sourceGameId: string
  gameId?: string
  status: 'created' | 'updated' | 'skipped' | 'failed'
  existingReason?: 'externalId' | 'path'
  diagnostics?: readonly LibraryImportDiagnostic[]
}

export interface LibraryImportDiagnostic {
  level: 'info' | 'warning' | 'error'
  code: string
  message: string
  sourceGameId?: string
  sourceCollectionId?: string
}
```

RPC：

```ts
'capabilities.library.imports.applyGamePlan'
```

宿主行为：

- 验证所有 `sourcePath` 位于当前扩展的 `extensionPath`、`dataPath` 或 `tempPath`。
- 以 `source=vnite` external id 和 path 查重。
- 在一个 SQLite transaction 中写入 games、external ids、tags、collections、relations、sessions、notes 和 save backup metadata。
- 附件文件复制通过 `DbService.attachment` 完成；附件失败不回滚核心数据，而是返回 warning，除非调用方设置严格模式。
- 写入后触发既有 DB trigger、FTS 同步和 library events。
- `dryRun` 只做验证、匹配和计划结果，不写数据库、不复制附件。

主进程实现位置：

```text
packages/extension-api/src/capabilities/library/imports.ts
packages/extension-api/src/capabilities/library/index.ts
packages/extension-api/src/rpc/capabilities.ts
apps/desktop/src/main/services/extension/capabilities/library/imports/
apps/desktop/src/main/services/extension/capabilities/library/provider.ts
```

内部拆分建议：

```text
imports/
  manager.ts        # public entry, ExtensionLibraryImportManager
  validation.ts     # host boundary validation
  matching.ts       # external id/path lookup
  plan.ts           # normalized write plan
  apply.ts          # Drizzle transaction
  attachments.ts    # temp path validation and DbService.attachment calls
  diagnostics.ts
  types.ts
```

## 新增 game notes 与 sessions 的公共模型

`applyGamePlan` 可以先满足 Vnite 导入，但 notes 和 sessions 也是自然的 library 子域。为避免之后再补公共契约，同步新增只读/写入 DTO：

```ts
export interface LibraryGameSession {
  id: string
  gameId: string
  startedAt: number
  endedAt: number
  createdAt: number
  updatedAt: number
}

export interface LibraryGameNote {
  id: string
  gameId: string
  name: string
  content?: string
  coverFile?: string
  orderInGame: number
  createdAt: number
  updatedAt: number
}
```

这些 DTO 可先由 import capability 使用，不必立即暴露完整 `kisaki.library.gameNotes.*` 和 `kisaki.library.gameSessions.*` CRUD。若实现中发现 Bangumi 或其他扩展也需要独立操作，再单独提升为 namespace。

## 扩展 `kisaki.ingest.game`

当前 extension API 只暴露：

```ts
kisaki.ingest.game.add.fromScraper(profileId, lookup, options)
```

Vnite 导入后需要对已存在的游戏做补全。新增：

```ts
export interface IngestGameUpdateFromScraperOptions {
  taskRun?: boolean
}

export interface IngestGameUpdateCapability {
  fromScraper(
    request: GameUpdateRequest,
    options?: IngestGameUpdateFromScraperOptions
  ): Promise<IngestUpdateResult>
}

export interface IngestGameCapability {
  add: IngestGameAddCapability
  update: IngestGameUpdateCapability
}
```

RPC：

```ts
'capabilities.ingest.game.update.fromScraper'
```

宿主适配：

- 转发到 `IngestService.update.game.updateFromScraper` 或 `updateFromScraperWithTaskRun`。
- extension initiator 使用 `TaskRunInitiator { type: 'extension' }`。
- 保留 `GameUpdateRequest` 的 surfaces 和 policy。

Vnite importer 使用：

```ts
await kisaki.ingest.game.update.fromScraper(
  {
    rootId: gameId,
    profileId,
    lookup,
    selection: { surfaces },
    policy: {
      singularUpdate: 'ifMissing',
      collectionUpdate: 'merge'
    }
  },
  { taskRun: false }
)
```

导入扩展自身已经创建一个顶层 TaskRun，因此单个游戏补全默认 `taskRun: false`，由扩展汇总进度和结果。

## Scraper profile 选择

现有 API 已满足配置选择：

```ts
const profiles = await kisaki.scrapers.profiles.list({ mediaType: 'game' })
```

UI 默认选择当前第一个 game profile。若没有 game profile：

- “补全元数据”开关禁用。
- 可以继续执行直接导入。
- 预览和提交时给出 warning。

## SDK 聚合变更

`KisakiApi` 新增：

```ts
export interface KisakiApi {
  files: FilesCapability
  library: LibraryCapability
  ingest: IngestCapability
  // existing namespaces...
}
```

`packages/extension-sdk/src/index.ts` 和 host bridge 都要新增 `files` getter。`createScopeCapturingKisakiApi` 也必须转发该 namespace。

## 设置面板交互

不新增 file input node。Vnite importer 使用 settings panel `button` 节点触发 `kisaki.files.openFile`：

```ts
settings.button({
  id: 'select-backup',
  label: '选择备份包',
  icon: 'FolderOpen',
  onClick: async (event) => {
    const file = await kisaki.files.openFile({
      title: '选择 Vnite 备份包',
      filters: [{ name: 'Vnite 备份包', extensions: ['zip'] }],
      copyTo: 'temp',
      maxSizeBytes: 2 * 1024 * 1024 * 1024
    })
    // store file grant id/path in extension storage draft state
  }
})
```

## 安全与权限

- 只允许读取用户显式选择的 zip 副本。
- 解压必须防 zip slip：每个 entry 的 resolved path 必须位于 run workspace。
- 扩展导入附件时只传扩展 temp/data 内的路径。
- 导入日志不记录原始绝对路径、同步账号、密码、完整文档、完整 HTML description 或完整错误堆栈。
- 诊断结果可以包含 basename、Vnite game id、Kisaki game id 和字段名。

## 需要更新的检查

```powershell
pnpm --filter @kisaki/extension-api typecheck
pnpm --filter @kisaki/extension-api lint
pnpm build:extension-tooling
pnpm --filter kisaki typecheck
pnpm --filter kisaki lint
```

新增 capability 后，搜索旧命名不应出现：

```powershell
rg -n "backgroundTasks|capabilities\\.files\\.open|library\\.bulk" packages apps extensions docs --glob "!docs/vnite-import-extension/**"
```
