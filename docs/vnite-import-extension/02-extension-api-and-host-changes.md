# 02 Extension API And Host Changes

Vnite 导入需要新增宿主能力。扩展 API 尚未上线，本设计直接定义目标 API，不保留兼容别名。

## API 原则

- 公共契约先于实现，类型放在 `packages/extension-api/src/capabilities/**`。
- 公共 API 必须是通用平台能力，不包含某个内置扩展的专名、枚举或分支。
- 扩展只提交结构化 DTO，不导入 app 内部 Drizzle schema、ServiceContainer 或 Electron API。
- 宿主负责校验、匹配、附件落盘、FTS、事件和数据库触发器。
- Graph 写入不承诺整包 all-or-nothing。宿主可以在内部使用事务或 savepoint，但 API 语义是 item-level apply 和 item-level diagnostics。
- 长任务统一使用 `kisaki.taskRuns` 或 app-owned TaskRun。
- 大二进制不通过 RPC 传输。扩展把文件写到扩展临时目录，再传受限绝对路径。
- API 名称使用当前扩展系统规则：capability method strings 使用 `capabilities.<capability>.<operation>`。

## 新增 `kisaki.files`

Vnite 导入需要用户选择 zip。这个能力的语义不是“打开文件”，而是“让用户选择文件，并授予扩展一个受控文件 grant”。因此命名使用 `pickFile` 和 `releaseGrant`。

```ts
export interface FilePickerFilter {
  name: string
  extensions: readonly string[]
}

export interface PickFileInput {
  title?: string
  filters?: readonly FilePickerFilter[]
  copyTo?: 'temp' | 'data'
  maxSizeBytes?: number
}

export interface ExtensionFileGrant {
  grantId: string
  name: string
  extension: string
  sizeBytes: number
  path: string
  originalPathLabel: string
  createdAt: number
}

export interface FilesCapability {
  pickFile(input?: PickFileInput): Promise<ExtensionFileGrant | null>
  releaseGrant(grantId: string): Promise<void>
}
```

行为：

- `pickFile` 由主进程打开系统文件选择器。
- 选中文件复制到 `userData/extensions/data/<extensionId>/temp/file-grants/<grantId>/<basename>`。
- 返回的 `path` 必须位于当前扩展的 `dataPath` 或 `tempPath` 内。
- `originalPathLabel` 只用于 UI 展示 basename 或经过脱敏的路径片段，不用于日志和持久化导入数据。
- `releaseGrant` 删除该 grant 目录；扩展停用时宿主清理过期 temp grants。
- 未来需要多选或目录选择时新增 `pickFiles`、`pickDirectory`，不重载 `pickFile` 的返回形状。

RPC：

```ts
'capabilities.files.pickFile'
'capabilities.files.releaseGrant'
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

## 新增 `kisaki.library.graph`

细粒度 `kisaki.library.games.create`、`tags.create`、`relations.create` 适合小操作，不适合作为 Vnite 这种迁移主路径。Vnite 输入天然是 graph：media、collection、tag、company、person、note、session、attachment 和它们之间的边需要一起解析。

目标 API 是媒体资料库通用 graph capability，而不是 game-only import API：

```ts
export interface LibraryGraphCapability {
  preview(input: LibraryGraphInput): Promise<LibraryGraphResult>
  apply(input: LibraryGraphInput): Promise<LibraryGraphResult>
}
```

SDK shape：

```ts
export interface LibraryCapability {
  graph: LibraryGraphCapability
  // existing capabilities...
}
```

RPC：

```ts
'capabilities.library.graph.preview'
'capabilities.library.graph.apply'
```

### Graph Input

```ts
export interface LibraryGraphInput {
  requestId?: string
  options?: LibraryGraphOptions
  nodes: LibraryGraphNodes
  edges?: readonly LibraryGraphEdge[]
  diagnostics?: readonly LibraryGraphDiagnostic[]
}

export interface LibraryGraphOptions {
  conflictMode?: LibraryGraphConflictMode
  strictAttachments?: boolean
}

export type LibraryGraphConflictMode = 'skipExisting' | 'mergeSelected' | 'overwriteSelected'

export interface LibraryGraphNodes {
  media?: readonly LibraryGraphMediaNode[]
  collections?: readonly LibraryGraphCollectionNode[]
  tags?: readonly LibraryGraphTagNode[]
  companies?: readonly LibraryGraphCompanyNode[]
  people?: readonly LibraryGraphPersonNode[]
  notes?: readonly LibraryGraphNoteNode[]
  sessions?: readonly LibraryGraphSessionNode[]
  attachments?: readonly LibraryGraphAttachmentNode[]
}
```

Graph node key 只在单次 graph input 内作为引用和诊断 key 使用：

- edges 用它引用 nodes。
- result 和 diagnostics 用它对应回扩展提交的 source item。
- 宿主不持久化 node key，不把它作为跨次导入的身份。
- 扩展可以使用可读的 key，例如 `vnite:game:<gameId>`，但幂等匹配必须来自实体自己的自然规则。

### Media Nodes

Graph API 路径保持媒体无关，具体媒体类型在 node 上表达。第一版只实现 `mediaType: 'game'`，后续可通过 discriminated union 加入 book、movie、anime 等类型，不改 method name。

```ts
export type LibraryMediaType = 'game'

export type LibraryGraphMediaNode = LibraryGraphGameNode

export interface LibraryGraphNodeBase {
  key: string
}

export interface LibraryGraphGameNode extends LibraryGraphNodeBase {
  kind: 'media'
  mediaType: 'game'
  input: LibraryGameCreateInput
}
```

`input.externalIds` 是要写入资料库的普通 external id，同时参与匹配。Vnite importer 总是提交 `{ source: 'vnite', id: vniteGame._id }`，但公共 API 不定义 `vnite` 专属 union。

Graph 不定义 graph-only game input shape。能作为公共创建语义的内容应直接放进对应 `CreateInput`；不能作为普通创建语义的内容不应借 graph 绕进去。

### Entity Nodes

```ts
export interface LibraryGraphCollectionNode extends LibraryGraphNodeBase {
  kind: 'collection'
  input: LibraryCollectionCreateInput
}

export interface LibraryGraphTagNode extends LibraryGraphNodeBase {
  kind: 'tag'
  input: LibraryTagCreateInput
}

export interface LibraryGraphCompanyNode extends LibraryGraphNodeBase {
  kind: 'company'
  input: LibraryCompanyCreateInput
}

export interface LibraryGraphPersonNode extends LibraryGraphNodeBase {
  kind: 'person'
  input: LibraryPersonCreateInput
}

export interface LibraryGraphNoteNode extends LibraryGraphNodeBase {
  kind: 'note'
  input: LibraryGameNoteCreateInput
}

export interface LibraryGraphSessionNode extends LibraryGraphNodeBase {
  kind: 'session'
  input: LibraryGameSessionCreateInput
}

export interface LibraryGraphAttachmentNode extends LibraryGraphNodeBase {
  kind: 'attachment'
  path: string
  fileName?: string
  contentType?: string
}
```

Notes 和 sessions 先支持 game owner。后续如果其他媒体也支持对应子域，新增 media-specific edge validation，不改变 `library.graph` 方法。

### Create Input 职责

`CreateInput` 表达创建一个主实体本身需要的输入。它不是纯数据库表字段，但也不是任意附加 graph：

- 可包含主表直接字段，例如 `name`、`description`、`status`。
- 可包含主表 JSON 字段，例如 `relatedSites`、`saveBackups`。
- 可包含紧耦合身份信息，例如 `externalIds`。它虽然落在附加表，但语义上属于实体身份。
- 不包含 sessions、notes、tags、collections、companies、people、attachments。
- 不包含 relation/link metadata。

这些附加对象和关系由 graph nodes 与 graph edges 表达。因此 `LibraryGameCreateInput` 不新增 `sessions`；game sessions 使用 `LibraryGraphSessionNode` 和 `media-session` edge。

### Create Input 时间字段

有业务语义的创建时间字段直接内联到对应 create input。它们用于迁移外部系统的添加时间或用户内容创建时间，不新增公共 audit input base：

```ts
export interface LibraryGameCreateInput extends LibraryRankedEntityInputBase {
  createdAt?: number
  updatedAt?: number
  // existing game fields...
}

export interface LibraryPersonCreateInput extends LibraryRankedEntityInputBase {
  createdAt?: number
  updatedAt?: number
  // existing person fields...
}

export interface LibraryCompanyCreateInput extends LibraryRankedEntityInputBase {
  createdAt?: number
  updatedAt?: number
  // existing company fields...
}

export interface LibraryCharacterCreateInput extends LibraryRankedEntityInputBase {
  createdAt?: number
  updatedAt?: number
  // existing character fields...
}

export interface LibraryCollectionCreateInput extends LibraryEntityInputBase {
  createdAt?: number
  updatedAt?: number
  // existing collection fields...
}

export interface LibraryTagCreateInput extends LibraryEntityInputBase {
  createdAt?: number
  updatedAt?: number
  // existing tag fields...
}
```

规则：

- `createdAt` 表达实体在外部系统中的添加时间；缺省时由宿主使用当前时间。
- `updatedAt` 只在明确迁移外部更新时间时写入；缺省时由宿主使用当前时间。
- 宿主校验 timestamp 为有限、非负、合理范围内的毫秒时间戳。
- patch 类型不继承这些字段；普通更新不开放审计时间修改。
- `LibraryRelationCreateInput` 不加。关系/link 的时间不是用户主要关心的迁移事实。
- `LibraryGameSessionCreateInput` 不加。session 的业务时间是 `startedAt` / `endedAt`。

### Edges

```ts
export interface LibraryGraphNodeRef {
  kind: LibraryGraphNodeKind
  key: string
}

export type LibraryGraphNodeKind =
  | 'media'
  | 'collection'
  | 'tag'
  | 'company'
  | 'person'
  | 'note'
  | 'session'
  | 'attachment'

export type LibraryGraphEdge =
  | LibraryGraphCollectionMediaEdge
  | LibraryGraphMediaTagEdge
  | LibraryGraphMediaCompanyEdge
  | LibraryGraphMediaPersonEdge
  | LibraryGraphMediaNoteEdge
  | LibraryGraphMediaSessionEdge
  | LibraryGraphMediaAttachmentEdge

export interface LibraryGraphCollectionMediaEdge {
  kind: 'collection-media'
  from: LibraryGraphNodeRef
  to: LibraryGraphNodeRef
  order?: number
}

export interface LibraryGraphMediaTagEdge {
  kind: 'media-tag'
  from: LibraryGraphNodeRef
  to: LibraryGraphNodeRef
  order?: number
}

export interface LibraryGraphMediaCompanyEdge {
  kind: 'media-company'
  from: LibraryGraphNodeRef
  to: LibraryGraphNodeRef
  role: LibraryGameCompanyRole
  order?: number
}

export interface LibraryGraphMediaPersonEdge {
  kind: 'media-person'
  from: LibraryGraphNodeRef
  to: LibraryGraphNodeRef
  role: LibraryGamePersonRole
  order?: number
  note?: string
}

export interface LibraryGraphMediaNoteEdge {
  kind: 'media-note'
  from: LibraryGraphNodeRef
  to: LibraryGraphNodeRef
}

export interface LibraryGraphMediaSessionEdge {
  kind: 'media-session'
  from: LibraryGraphNodeRef
  to: LibraryGraphNodeRef
}

export interface LibraryGraphMediaAttachmentEdge {
  kind: 'media-attachment'
  from: LibraryGraphNodeRef
  to: LibraryGraphNodeRef
  slot: 'cover' | 'backdrop' | 'logo' | 'icon' | 'description-inline' | 'save-backup'
  replace?: boolean
  saveBackup?: {
    backupAt: number
    note: string
    locked: boolean
  }
}
```

Edges must reference nodes in the same graph input. The host validates kind compatibility, media type compatibility, duplicate edges, and edge-specific constraints.

### Result

```ts
export interface LibraryGraphResult {
  requestId?: string
  mode: 'preview' | 'apply'
  startedAt: number
  finishedAt: number
  nodes: readonly LibraryGraphNodeResult[]
  edges: readonly LibraryGraphEdgeResult[]
  counters: Record<string, number>
  diagnostics: readonly LibraryGraphDiagnostic[]
}

export interface LibraryGraphNodeResult {
  key: string
  kind: LibraryGraphNodeKind
  mediaType?: LibraryMediaType
  entityId?: string
  action: 'create' | 'update' | 'skip' | 'fail'
  diagnostics?: readonly LibraryGraphDiagnostic[]
}

export interface LibraryGraphEdgeResult {
  kind: LibraryGraphEdge['kind']
  fromKey: string
  toKey: string
  action: 'create' | 'update' | 'skip' | 'fail'
  diagnostics?: readonly LibraryGraphDiagnostic[]
}

export interface LibraryGraphDiagnostic {
  level: 'info' | 'warning' | 'error'
  code: string
  message: string
  nodeKey?: string
  edgeKind?: LibraryGraphEdge['kind']
}
```

`preview` 返回将要执行的 action，不写数据库、不复制附件。`apply` 会重新校验和匹配，不信任旧 preview result。

### Host Behavior

- 验证所有 attachment `path` 和 note cover path 位于当前扩展的 `extensionPath`、`dataPath` 或 `tempPath`。
- 构建 node map 和 edge map，拒绝孤儿 edge、重复 key、重复不可合并 edge。
- 匹配使用实体自然规则：
  - media: `input.externalIds`，然后 `input.gameDirPath`。第一版不按 name 自动合并 media。
  - tag: `input.name`。
  - collection: `input.name`。
  - person/company/character: 只按 `input.externalIds`。没有 external ids 时创建新实体。
  - note: owner media + `input.name`。
  - session: owner media + `input.startedAt` + `input.endedAt`。
- 附件文件复制通过 `DbService.attachment` 完成；附件失败不回滚已完成 item，而是返回 warning，除非调用方设置 `strictAttachments`。
- 写入后触发既有 DB trigger、FTS 同步和 library events。
- Graph apply 可按 media node 分组提交。API 不保证整个 graph 失败时回滚此前成功的 item。

主进程实现位置：

```text
packages/extension-api/src/capabilities/library/graph.ts
packages/extension-api/src/capabilities/library/index.ts
packages/extension-api/src/rpc/capabilities.ts
apps/desktop/src/main/services/extension/capabilities/library/graph/
apps/desktop/src/main/services/extension/capabilities/library/provider.ts
```

内部拆分建议：

```text
graph/
  manager.ts        # public entry, ExtensionLibraryGraphManager
  validation.ts     # host boundary validation
  matching.ts       # entity natural matching
  normalization.ts  # graph normalization and dedupe
  apply.ts          # item-level writes
  attachments.ts    # temp path validation and DbService.attachment calls
  diagnostics.ts
  types.ts
```

## 新增 game notes 与 sessions 的公共模型

`library.graph` 第一版需要写入 game notes 和 sessions。为避免 graph DTO 依赖 app 内部 schema，同步新增公共只读/写入 DTO：

```ts
export interface LibraryGameSession {
  id: string
  gameId: string
  startedAt: number
  endedAt: number
  createdAt: number
  updatedAt: number
}

export interface LibraryGameSessionCreateInput {
  startedAt: number
  endedAt: number
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

export interface LibraryGameNoteCreateInput {
  name: string
  content?: string
  coverPath?: string
  createdAt?: number
  updatedAt?: number
  order?: number
}
```

这些 DTO 可先由 graph capability 使用，不必立即暴露完整 `kisaki.library.gameNotes.*` 和 `kisaki.library.gameSessions.*` CRUD。若实现中发现 Bangumi 或其他扩展也需要独立操作，再单独提升为独立 capability。

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
    input: IngestGameUpdateFromScraperInput,
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
- 保留 `IngestGameUpdateFromScraperInput` 的 surfaces 和 policy。

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

## Scraper Profile 选择

现有 API 已满足配置选择：

```ts
const profiles = await kisaki.scrapers.profiles.list({ mediaType: 'game' })
```

UI 默认选择当前第一个 game profile。若没有 game profile：

- “补全元数据”开关禁用。
- 可以继续执行直接导入。
- 预览和提交时给出 warning。

## Settings Panel Submit Controls

Vnite importer 需要把 settings panel 当作 flow 使用。目标 contract 直接用 `submit` 对象描述 footer primary action，让 label、disabled 和 hidden 状态由同一个语义结构承载：

```ts
export interface SettingsPanelSubmitControl {
  label: string
  disabled?: boolean
  hidden?: boolean
}

export interface SettingsPanelRootModelBase {
  title?: string
  description?: string
  submit?: SettingsPanelSubmitControl
}

export interface SettingsPanelDialogModel {
  title?: string
  description?: string
  submit?: SettingsPanelSubmitControl
  // existing fields...
}
```

settings panel 的 root submit 是 flow 的唯一主动作。secondary button 只承载辅助动作，例如重新选择备份包、返回修改、打开高级选项或查看诊断明细。

## SDK 聚合变更

`KisakiApi` 新增：

```ts
export interface KisakiApi {
  files: FilesCapability
  library: LibraryCapability
  ingest: IngestCapability
  // existing capabilities...
}
```

`packages/extension-sdk/src/index.ts` 和 host bridge 都要新增 `files` getter。`createScopeCapturingKisakiApi` 也必须转发该 capability。

## 设置面板交互

不新增 file input node。Vnite importer 在 flow 的 `pickBackup` step 中通过 root `submit` 触发 `kisaki.files.pickFile`：

```ts
async submit(event) {
  const step = readStep(event.values)

  if (step === 'pickBackup') {
    const grant = await kisaki.files.pickFile({
      title: '选择 Vnite 备份包',
      filters: [{ name: 'Vnite 备份包', extensions: ['zip'] }],
      copyTo: 'temp',
      maxSizeBytes: 2 * 1024 * 1024 * 1024
    })

    if (!grant) {
      return event.refresh('root')
    }

    await runtime.flowStore.setFileGrant(grant)
    await runtime.flowStore.setStep('analyzeBackup')
    return event.success({ refresh: 'root' })
  }
}
```

Secondary buttons 只做非主路径动作，例如“重新选择”“清理临时文件”“查看诊断详情”。主流程推进统一由 footer submit 完成。

## 安全与权限

- 只允许读取用户显式选择的 zip grant。
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

新增 capability 后，应按废弃命名清单搜索旧 API、旧 DTO 和旧 item id 字段；结果不应出现在正式实现中。

```powershell
rg -n "<deprecated-extension-import-api-patterns>" packages apps extensions docs
```
