# 06 UI TaskRun And Errors

Vnite importer 的 UI 由 settings panel 提供。它是操作型界面，不做营销页，也不在应用主界面注入额外页面。

## Settings Panel

Panel：

```ts
defineSettingsPanel({
  id: 'settings',
  title: 'Vnite 导入',
  size: 'lg',
  submitLabel: '保存默认选项'
})
```

Tabs：

```text
backup      备份包
fields      字段
completion  补全
preview     预览
advanced    高级
```

### 备份包

字段：

- `选择备份包` button，icon `FolderOpen`。
- 当前文件 status：文件名、大小、分析时间。
- `分析备份包` button，icon `Search`。
- 分析摘要 table：game、game-local、collection、附件、warning 数。

行为：

- 选择文件后立即保存 file grant 到 `analysis.current`。
- 分析时创建短 TaskRun 或 settings callback loading state。备份较大时应使用 TaskRun。
- 分析完成刷新 root。

### 字段

使用 checkbox / multi-select 表达字段组：

- 基础信息。
- 本地启动。
- 游玩记录。
- 分类与标签。
- 制作方与人员。
- 媒体。
- 存档。
- 回忆。

字段组旁展示分析出的覆盖数量，例如“封面 122/124”。不要展示冗长说明；详细 warning 放预览。

### 补全

字段：

- `补全缺失元数据` switch。
- `刮削配置` select，来自 `kisaki.scrapers.profiles.list({ mediaType: 'game' })`。
- `补全范围` radioGroup：`核心与媒体`、`全部可补全字段`、`自定义`。
- 自定义 surfaces multiSelect。

如果没有 game scraper profile：

- switch disabled。
- notice tone warning：提示可以先直接导入。

### 预览

展示 dry-run 结果：

- summary status nodes：新增、更新、跳过、warning。
- comparisonList：每组游戏显示来源名称、目标状态、命中原因、关键字段。
- diagnostics table：level、code、游戏、message。

预览 dialog 有两个动作：

- `重新预览`
- `开始导入`

### 高级

字段：

- conflict mode select：跳过现有、合并缺失字段、覆盖所选字段。
- keep last analysis switch。
- cleanup temp button。

默认 conflict mode：`mergeSelected`。

## Commands

注册 commands，方便后续从命令面板调用：

```ts
context.contributions.commands.register({
  id: 'vnite-importer.openSettings',
  title: '打开 Vnite 导入',
  run: async () => ({ openSettingsPanel: { id: 'settings' } })
})

context.contributions.commands.register({
  id: 'vnite-importer.importBackup',
  title: '导入 Vnite 备份包',
  run: async () => jobRunner.startImportFromCurrentSettings()
})
```

如果 command API 当前不支持打开 settings panel result，则只注册 `importBackup`，settings 入口依赖扩展管理界面。

## TaskRun

导入任务使用 extension-owned TaskRun：

```ts
const run = await kisaki.taskRuns.create({
  operation: 'vnite.import',
  title: '导入 Vnite 备份包',
  description: file.name,
  subject: { type: 'extension', id: 'builtin.vnite-importer' },
  controls: { cancelable: true, pausable: false },
  presentation: {
    notify: {
      enabled: true,
      title: '导入 Vnite 备份包',
      showProgress: true,
      showResult: true,
      closable: true
    }
  }
})
```

进度 phase：

| phase key     | label                  |
| ------------- | ---------------------- |
| `extracting`  | 正在解压备份包         |
| `reading`     | 正在读取 Vnite 数据    |
| `planning`    | 正在生成导入计划       |
| `attachments` | 正在准备媒体文件       |
| `writing`     | 正在写入 Kisaki 资料库 |
| `completion`  | 正在补全元数据         |
| `cleanup`     | 正在清理临时文件       |
| `finished`    | 导入完成               |

Counters：

```ts
{
  gamesTotal: number
  gamesCreated: number
  gamesUpdated: number
  gamesSkipped: number
  gamesFailed: number
  collectionsCreated: number
  collectionsUpdated: number
  attachmentsImported: number
  attachmentsFailed: number
  completionCompleted: number
  completionFailed: number
  warnings: number
}
```

TaskRun output：

```ts
interface VniteImportJobSummary {
  sourceFileName: string
  startedAt: number
  finishedAt: number
  directImport: LibraryGameImportResult
  completion?: VniteMetadataCompletionSummary
  diagnostics: readonly VniteImportDiagnostic[]
}
```

## Error Handling

错误分三层：

`fatal`

- 无法继续，TaskRun fail。
- 示例：zip 无法解压、PouchDB 无法打开、host import capability validation fail。

`recoverable`

- 当前 item 失败，整体继续。
- 示例：单个附件缺失、单个 memory 图片读取失败、单个游戏补全失败。

`info`

- 数据无法表达但不影响导入。
- 示例：Vnite collection sortBy 不支持、useMagpie 不支持。

用户消息：

- 使用中文。
- 避免暴露堆栈、绝对路径全集、账号、密码。
- 单个错误消息保持短句。

日志：

```ts
logger.warn('Vnite import item failed.', {
  code,
  sourceGameId,
  attachmentId,
  message
})
```

不要记录：

- Vnite `config-local.sync.officialConfig.auth.password`
- Vnite `config-local.network`
- 完整 PouchDB 文档
- 完整 HTML description
- 原始绝对路径全集
- attachment buffer

## Diagnostics Display

Diagnostic DTO：

```ts
interface VniteImportDiagnostic {
  level: 'info' | 'warning' | 'error'
  code: string
  message: string
  sourceGameId?: string
  sourceGameName?: string
  targetGameId?: string
}
```

UI table columns：

- 级别。
- 游戏。
- 问题。
- 处理结果。

`sourceGameId` 默认不直接展示，可在详情里显示。

## Path Safety

解压：

```ts
const target = path.resolve(extractRoot, entryName)
assertInside(target, extractRoot)
```

附件导出：

```ts
temp/vnite-import/<runId>/attachments/<sourceGameId>/<safeAttachmentName>
```

host import：

- 再次验证 `sourcePath` 位于当前 extension temp/data/path。
- 不接受任意用户路径。

## Cancellation

扩展所有长循环都调用：

```ts
await run.checkpoint()
```

取消后：

- 停止读取、导出附件或补全。
- 如果直接导入已完成，不回滚。
- summary 写明已完成和未完成数量。
- 清理 temp workspace。

## Accessibility And Copy

UI 文案使用：

- `备份包`
- `字段`
- `补全`
- `刮削配置`
- `导入计划`
- `预览`
- `跳过现有`
- `合并缺失字段`
- `覆盖所选字段`

避免在普通 UI 中使用：

- Manifest
- Release
- PouchDB
- LevelDB
- RPC

这些术语只出现在诊断详情或开发日志。
