# 06 UI TaskRun And Errors

Vnite importer 的 UI 由 settings panel 提供。它是操作型 flow，不做营销页，不在应用主界面注入额外页面，也不把 tabs 当作步骤使用。

## Settings Panel Flow

Panel：

```ts
defineSettingsPanel({
  id: 'settings',
  title: 'Vnite 导入',
  size: 'lg'
})
```

`resolve()` 始终返回 `fields`，不返回 `tabs`。root footer submit 是唯一主路径按钮；secondary button 只用于“重新选择”“返回修改”“查看详情”“清理临时文件”等旁路动作。

Flow state：

```ts
type VniteImportStep = 'pickBackup' | 'config' | 'preview' | 'running' | 'done'
```

Root model：

```ts
interface VniteImportFlowModel {
  title?: string
  description?: string
  submit?: {
    label: string
    disabled?: boolean
    hidden?: boolean
  }
  fields: readonly SettingsPanelField[]
}
```

Footer submit labels：

| step         | submit label       | behavior                                                     |
| ------------ | ------------------ | ------------------------------------------------------------ |
| `pickBackup` | `下一步`           | 确认已保存 file grant 并进入配置                             |
| `config`     | `生成预览`         | 读取备份包、生成 graph 并调用 `kisaki.library.graph.preview` |
| `preview`    | `开始导入`         | 创建 TaskRun 并执行 graph apply                              |
| `running`    | `刷新状态`         | 展示运行状态，不允许重复创建导入任务                         |
| `done`       | `导入另一个备份包` | 重置 flow 到 `pickBackup`                                    |

## Step: Pick Backup

Fields：

- file status node：显示当前备份包文件名和大小。
- file button：选择或更换从 Vnite 导出的数据库备份 zip。

File button：

```ts
const grant = await kisaki.files.pickFile({
  title: '选择 Vnite 备份包',
  filters: [{ name: 'Vnite 备份包', extensions: ['zip'] }],
  copyTo: 'temp',
  maxSizeBytes: 2 * 1024 * 1024 * 1024
})
```

成功选择后：

- 保存 `grantId`、`name`、`sizeBytes`、`path`。
- 留在 `pickBackup`，用户通过主按钮进入配置。

取消选择后：

- 留在 `pickBackup`。
- 不显示失败提示。

Submit：

- 校验已选择备份包。
- 进入 `config`。

## Step: Configure Import

Fields 是一个紧凑配置面，不展示分析摘要、字段覆盖或分布表：

- 字段选择 summary。
- `编辑字段` button，打开 fields dialog。
- `补全缺失元数据` switch。
- `刮削配置` select，来自 `kisaki.scrapers.profiles.list({ mediaType: 'game' })`。
- `补全范围` radioGroup：`核心与媒体`、`全部可补全字段`、`自定义`。
- 自定义 surfaces multiSelect，仅在 custom 时显示。
- conflict mode select：跳过现有、合并缺失字段、覆盖所选字段。
- strict attachment mode switch，默认关闭。

没有 game scraper profile 时：

- `补全缺失元数据` disabled。
- notice tone warning：提示可以先直接导入。

Fields dialog：

- 使用 checkbox / multi-select 表达字段组。
- 基础信息、本地启动、游玩记录、分类与标签、制作方与人员、媒体、存档、回忆。

Submit：

- 解压并读取备份包。
- 构建 `LibraryGraphInput`。
- 调 `kisaki.library.graph.preview(graph)`。
- 保存 preview result。
- 进入 `preview`。

## Step: Preview Graph

Fields：

- summary status nodes：新增、更新、跳过、error、warning。
- 写入计划 table。
- 更新计划 comparisonList。
- diagnostics button：打开诊断表。
- secondary button：`返回修改`，回到 `config`。
- secondary button：`重新预览`，重新执行 graph preview。

Submit：

- 创建 extension-owned TaskRun。
- 进入 `running`。
- 后台执行正式导入。

## Step: Running

Fields：

- status node：当前 TaskRun 状态。
- table 或 comparisonList：实时 counters。
- notice：导入运行中，取消请到任务中心处理。

Submit：

- hidden。
- 禁止重复创建导入任务。

状态刷新：

- settings panel 通过 TaskRun snapshot 或 extension storage 中的 active run id 刷新。
- 运行完成后自动进入 `done`，或由用户手动刷新。

## Step: Done

Fields：

- summary status nodes：新增、更新、跳过、补全成功、补全失败、warning。
- diagnostics table。
- secondary button：`查看导入结果`，如果未来命令/路由支持，可打开资料库筛选。
- secondary button：`导出诊断摘要`，后续可选，不是第一版必需。

Submit：

- `导入另一个备份包`。
- 释放当前 grant。
- 清理 flow state。
- 回到 `pickBackup`。

## Commands

注册 command，方便后续从命令面板调用：

```ts
context.contributions.commands.register({
  id: 'vnite-importer.importBackup',
  title: '导入 Vnite 备份包',
  run: async () => jobRunner.startImportFromCurrentSettings()
})
```

不要求命令打开 settings panel。若未来 command result 支持打开指定 settings panel，可新增 `vnite-importer.openSettings`，但不把它作为第一版依赖。

## TaskRun

导入任务使用 extension-owned TaskRun：

```ts
const run = await kisaki.taskRuns.create({
  operation: 'vnite.import',
  title: '导入 Vnite 备份包',
  description: grant.name,
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

| phase key       | label                  |
| --------------- | ---------------------- |
| `extracting`    | 正在解压备份包         |
| `reading`       | 正在读取 Vnite 数据    |
| `buildingGraph` | 正在构建资料库图       |
| `attachments`   | 正在准备媒体文件       |
| `writing`       | 正在写入 Kisaki 资料库 |
| `completion`    | 正在补全元数据         |
| `cleanup`       | 正在清理临时文件       |
| `finished`      | 导入完成               |

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
  fileName: string
  startedAt: number
  finishedAt: number
  graphApply: LibraryGraphResult
  completion?: VniteMetadataCompletionSummary
  diagnostics: readonly VniteImportDiagnostic[]
}
```

## Error Handling

错误分三层：

`fatal`

- 无法继续，TaskRun fail。
- 示例：zip 无法解压、PouchDB 无法打开、host graph validation fail。

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
  itemKey,
  vniteGameId,
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
  itemKey?: string
  vniteGameId?: string
  vniteGameName?: string
  targetGameId?: string
}
```

UI table columns：

- 级别。
- 游戏。
- 问题。
- 处理结果。

`vniteGameId` 默认不直接展示，可在详情里显示。

## Path Safety

解压：

```ts
const target = path.resolve(extractRoot, entryName)
assertInside(target, extractRoot)
```

附件导出：

```ts
temp/vnite-import/<runId>/attachments/<vniteGameId>/<safeAttachmentName>
```

host graph apply：

- 再次验证 attachment `path` 和 note `coverPath` 位于当前 extension temp/data/path。
- 不接受任意用户路径。

## Cancellation

扩展所有长循环都调用：

```ts
await run.checkpoint()
```

取消后：

- 停止读取、导出附件或补全。
- 如果 graph apply 已完成部分 item，不回滚。
- summary 写明已完成和未完成数量。
- 清理 temp workspace。

## Accessibility And Copy

UI 文案使用：

- `备份包`
- `字段`
- `补全`
- `刮削配置`
- `资料库图`
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
