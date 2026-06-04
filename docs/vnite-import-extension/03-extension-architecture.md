# 03 Extension Architecture

内置扩展名：`builtin.vnite-importer`。

目标定位：工具型 integration extension。它不注册 scraper provider，不提供自动后台同步，只提供手动 Vnite 备份导入流程。

## 目标目录

```text
extensions/vnite-importer/
  manifest.json
  package.json
  tsconfig.json
  tsdown.config.ts
  src/
    index.ts
    shared/
      constants.ts
      errors.ts
      result.ts
      ids.ts
      time.ts
      path.ts
    config/
      defaults.ts
      schema.ts
      store.ts
    backup/
      archive.ts
      workspace.ts
      pouch.ts
      reader.ts
      analyzer.ts
      types.ts
      validation.ts
    vnite/
      models.ts
      defaults.ts
      attachments.ts
      fields.ts
      normalization.ts
      statistics.ts
    mapping/
      dates.ts
      external-ids.ts
      launch.ts
      media.ts
      people.ts
      status.ts
      tags.ts
      graph.ts
      diagnostics.ts
    import/
      options.ts
      builder.ts
      executor.ts
      summary.ts
    completion/
      lookup.ts
      selection.ts
      runner.ts
      summary.ts
    jobs/
      context.ts
      commands.ts
      import-runner.ts
      preview-runner.ts
    ui/
      settings/
        index.ts
        panel.ts
        dialogs.ts
        flow.ts
        runtime.ts
        ids.ts
        resources.ts
        fields-dialog.ts
        advanced-dialog.ts
        preview-view.ts
        options.ts
```

命名遵循项目约定：文件名使用职责名，`index.ts` 只做入口或显式 re-export，不创建 `import/import.ts`、`reader/reader.ts` 这类重复段名。

## Manifest

```json
{
  "$schema": "./node_modules/@kisaki3/extension-api/schemas/extension-manifest.schema.json",
  "id": "builtin.vnite-importer",
  "name": "Vnite 导入",
  "version": "0.0.1",
  "categories": ["tool", "integration"],
  "entry": "./dist/index.mjs",
  "description": "Import games and user data from Vnite database backups.",
  "author": "Kisaki",
  "keywords": ["vnite", "import", "backup", "game"],
  "engines": {
    "kisaki": "=0.0.1"
  }
}
```

## Dependencies

运行依赖：

```json
{
  "dependencies": {
    "@kisaki3/extension-sdk": "workspace:*",
    "pouchdb": "^9.0.0",
    "extract-zip": "^2.0.1",
    "sanitize-filename": "^1.6.3"
  }
}
```

开发依赖：

```json
{
  "devDependencies": {
    "@kisaki3/extension-api": "workspace:*",
    "@kisaki3/extension-cli": "workspace:*",
    "@types/node": "^22.19.1",
    "@types/pouchdb": "^6.4.2",
    "tsdown": "^0.19.0",
    "typescript": "^5.9.3"
  }
}
```

注意：

- PouchDB 读取 LevelDB 目录是核心能力，必须在 packaged built-in extension 中做 smoke test。
- `extract-zip` 只用于扩展临时目录，解压前后都要做 path confinement。
- 不依赖 Electron、Drizzle 或 app 内部别名。

## Activation Composition

`src/index.ts` 只做装配：

1. 创建 `SettingsStore`。
2. 创建 `BackupWorkspaceManager`。
3. 创建 `VniteBackupReader` 和 `VniteBackupAnalyzer`。
4. 创建 `VniteGraphBuilder`。
5. 创建 `VniteImportExecutor`。
6. 创建 `MetadataCompletionRunner`。
7. 创建 `VniteImportJobRunner`。
8. 注册 commands。
9. 注册 settings panel。
10. 把所有 registrations 放入 `context.subscriptions`。

业务流程不写在 `activate` 中。

## 数据流

```text
settings panel
  -> kisaki.files.pickFile
  -> BackupWorkspaceManager
  -> VniteBackupReader
  -> VniteBackupAnalyzer
  -> VniteGraphBuilder
  -> kisaki.library.graph.preview/apply
  -> MetadataCompletionRunner
  -> kisaki.ingest.game.update.fromScraper
  -> TaskRun summary
```

## 模块职责

### backup

`backup/archive.ts`

- 校验 zip 扩展名、大小和存在性。
- 解压到 run workspace。
- 防 zip slip。
- 查找真实备份根目录。兼容两种形态：
  - zip 内直接包含 `game/`、`game-local/`。
  - zip 内先包含 `vnite-database-YYYYMMDD/`，其下再包含数据库目录。

`backup/workspace.ts`

- 创建 `context.storage` 或 `context.runtime` 可访问的 temp workspace。
- 路径形如 `temp/vnite-import/<runId>/`.
- run 结束后清理解压目录和附件导出目录。

`backup/pouch.ts`

- 封装 PouchDB 打开、读取和关闭。
- 提供 `readAllDocs(dbName)`、`getAttachment(dbName, docId, attachmentId)`。
- 所有 PouchDB error 转为 `VniteImportError`。

`backup/reader.ts`

- 读取 `game`、`game-local`、`game-collection`。
- 不读取 `config-local` 文档内容。
- 输出 `VniteBackupSnapshot`。

`backup/analyzer.ts`

- 统计游戏数、附件数、状态分布、字段覆盖、可导入字段。
- 生成 preview diagnostics。

### vnite

`vnite/models.ts`

- 本地复制 Vnite 必要模型，不从 `tmp/vnite-main` import。
- 类型必须宽容：真实数据可缺字段、可多字段。

`vnite/normalization.ts`

- 将 unknown 文档规范化为 `NormalizedVniteGame`。
- 缺失字段用 Vnite 默认值补齐。
- 移除 `_rev`。
- 保留 `_id`。

`vnite/attachments.ts`

- 定义 attachment id 分类。
- 将 PouchDB attachment 输出为 extension temp file。

### mapping

纯函数层，不访问 Kisaki API：

- 日期字符串 -> timestamp / partial date。
- Vnite play status -> Kisaki status。
- Vnite external id -> Kisaki `ExternalId[]`。
- Vnite launcher -> Kisaki launcher fields。
- Vnite metadata arrays -> tags、companies、persons。
- Vnite media attachments -> graph attachment nodes and media-attachment edges。
- Vnite memory -> graph note nodes and media-note edges。
- Vnite collection -> graph collection nodes and collection-media edges。

### import

`import/builder.ts`

- 接收 `VniteBackupSnapshot` 和用户字段选择。
- 生成 `LibraryGraphInput`。
- 为每个 node 分配单次 graph 内唯一的 key，用于 edges、result 和 diagnostics 对应源数据。
- 每个游戏总是写入 `vnite` external id。
- 为每个无法表达字段生成 warning。

`import/executor.ts`

- 调用 `kisaki.library.graph.preview` 或 `kisaki.library.graph.apply`。
- 不直接循环调用细粒度 library CRUD。
- 将宿主返回结果转换成 extension summary。

### completion

`completion/lookup.ts`

- 为每个导入成功的游戏生成 `IngestUpdateLookup`。
- 优先使用 `steam`、`vndb`、`igdb`、`ymgal` external ids。
- 不把 `vnite` external id 交给 scraper。
- 名称优先级：`name` -> `originalName` -> Vnite `_id`。

`completion/selection.ts`

- 根据用户补全选项生成 `GameUpdateSurface[]`。
- 默认补全 core、relations、media 中用户未导入或导入为空的部分。
- policy 默认 `ifMissing + merge`。

`completion/runner.ts`

- 顺序或小并发执行补全。
- 每个游戏失败只记 warning，不中断整个导入，除非用户开启严格模式。
- 通过顶层 TaskRun 汇报进度。

### jobs

`jobs/context.ts`

- 与 Bangumi 扩展的 job context 类似，封装 TaskRun handle、counters、diagnostics、取消 checkpoint。

`jobs/preview-runner.ts`

- 分析备份包并生成 graph preview。

`jobs/import-runner.ts`

- 执行正式导入和可选补全。

### ui/settings

settings panel 是唯一 UI 入口，标题为 `Vnite 导入`。

主要 surface：

- 备份包选择。
- 分析结果。
- 字段选择。
- 补全选项。
- 预览差异。
- 开始导入。

UI 是 flow，不是 tabbed navigation。`ui/settings/flow.ts` 只负责 step state 和 submit label 计算；字段、预览和高级配置分别由对应 view/dialog builder 生成。

## Storage Schema

非敏感 settings 存 `settings.v1`：

```ts
interface VniteImporterSettingsV1 {
  version: 1
  defaults: {
    fieldSelection: VniteImportFieldSelection
    conflictMode: 'skipExisting' | 'mergeSelected' | 'overwriteSelected'
    completeMetadata: boolean
    completionSurfacePreset: 'missingCoreAndMedia' | 'missingAll' | 'custom'
    scraperProfileId?: string
  }
  cleanup: {
    keepLastAnalysis: boolean
  }
}
```

临时分析状态存 `analysis.current`：

```ts
interface VniteImportAnalysisState {
  version: 1
  file?: {
    grantId: string
    name: string
    sizeBytes: number
    path: string
  }
  snapshot?: VniteBackupAnalysisSummary
  createdAt: number
}
```

不存：

- Vnite config-local 内容。
- 原始 game 文档全集。
- 原始 attachment buffer。
- 用户原始绝对路径全集。

## Error Model

统一错误类型：

```ts
type VniteImportErrorCode =
  | 'backup_not_selected'
  | 'backup_not_found'
  | 'backup_too_large'
  | 'backup_extract_failed'
  | 'backup_invalid_layout'
  | 'pouch_open_failed'
  | 'pouch_read_failed'
  | 'attachment_missing'
  | 'attachment_export_failed'
  | 'invalid_vnite_doc'
  | 'library_graph_invalid'
  | 'host_graph_failed'
  | 'scraper_profile_missing'
  | 'metadata_completion_failed'
  | 'job_cancelled'
```

对用户显示中文消息；日志仅记录 code、message、dbName、docId、attachmentId、计数和 basename。

## 依赖方向

```text
ui -> jobs -> import/completion
jobs -> backup/analyzer/import/executor
import -> mapping/vnite/shared
completion -> mapping/shared
backup -> shared
mapping -> vnite/shared
shared -> no Kisaki SDK dependency
```

规则：

- `backup` 不调用 `kisaki.library` 或 `kisaki.ingest`。
- `mapping` 是纯函数。
- `ui` 不拼导入 DTO，只读取 settings values 并调用 job runner。
- `jobs` 是 TaskRun 编排，不承载字段映射细节。
- `completion` 不重新读取 zip，只使用导入结果和 normalized snapshot。
