# 04 Import Model And Field Mapping

Vnite importer 的核心是把不完整、偏 PouchDB 文档的 Vnite 数据规范化为 Kisaki game import plan。所有映射都受用户字段选择控制，但用于幂等的 `vnite` external id 总是写入。

## 字段选择模型

```ts
export interface VniteImportFieldSelection {
  core: {
    name: boolean
    originalName: boolean
    sortName: boolean
    releaseDate: boolean
    description: boolean
    relatedSites: boolean
    externalIds: boolean
    nsfw: boolean
  }
  local: {
    launcher: boolean
    gameDirPath: boolean
    savePath: boolean
  }
  activity: {
    status: boolean
    score: boolean
    totalDuration: boolean
    lastActiveAt: boolean
    sessions: boolean
    createdAt: boolean
  }
  organization: {
    collections: boolean
    tags: boolean
    genresAsTags: boolean
    platformsAsTags: boolean
  }
  credits: {
    companies: boolean
    personsFromExtra: boolean
    unknownExtraAsNotes: boolean
  }
  media: {
    cover: boolean
    backdrop: boolean
    logo: boolean
    icon: boolean
    descriptionImages: boolean
  }
  saves: {
    saveBackups: boolean
    maxSaveBackups: boolean
  }
  memories: {
    notes: boolean
    noteImages: boolean
  }
}
```

默认开启：

- core 全部。
- local 的 `launcher`、`gameDirPath`、`savePath`。
- activity 的 `status`、`score`、`totalDuration`、`lastActiveAt`、`sessions`、`createdAt`。
- organization 的 `collections`、`tags`、`genresAsTags`。
- credits 的 `companies`。
- media 的 `cover`、`backdrop`、`logo`、`icon`。
- saves 的 `maxSaveBackups`。
- memories 的 `notes`、`noteImages`。

默认关闭：

- `platformsAsTags`，因为 `windows` 这类平台名对用户标签有污染风险。
- `personsFromExtra`，因为 Vnite extra 的来源和角色粒度不稳定。
- `unknownExtraAsNotes`，因为可能制造噪音。
- `descriptionImages`，因为 Vnite description image attachment 和 HTML 内联图片 URL 需要额外重写。
- `saveBackups`，除非附件实际存在。

## 基础幂等字段

每个导入游戏总是附加：

```ts
{ source: 'vnite', id: vniteGame._id }
```

该 external id：

- 不受用户字段选择影响。
- 不传给 scraper lookup。
- 用于重复导入查重。
- 在 UI 里可显示为“来源：Vnite”，但不作为普通元数据字段让用户关闭。

## Core 映射

| Vnite                     | Kisaki                              | 规则                                            |
| ------------------------- | ----------------------------------- | ----------------------------------------------- |
| `_id`                     | `game_external_ids(source='vnite')` | 总是写入                                        |
| `metadata.name`           | `games.name`                        | 空值时使用 originalName，再使用 `_id`           |
| `metadata.originalName`   | `games.originalName`                | 空字符串转 `null`                               |
| `metadata.sortName`       | `games.sortName`                    | 空字符串转 `null`                               |
| `metadata.releaseDate`    | `games.releaseDate`                 | `YYYY-MM-DD` -> PartialDate；无法解析则 warning |
| `metadata.description`    | `games.description`                 | 保留原文，空字符串转 `null`                     |
| `metadata.relatedSites[]` | `games.relatedSites`                | 去除空 label/url，URL 非法则 warning            |
| `metadata.steamId`        | external id `steam`                 | 空值跳过                                        |
| `metadata.vndbId`         | external id `vndb`                  | 保留 `v` 前缀                                   |
| `metadata.igdbId`         | external id `igdb`                  | 空值跳过                                        |
| `metadata.ymgalId`        | external id `ymgal`                 | 空值跳过                                        |
| `apperance.nsfw`          | `games.isNsfw`                      | Vnite 拼写保持兼容                              |

Score 映射：

```ts
function toKisakiScore(score: number): number | null {
  return Number.isFinite(score) && score >= 0 ? Math.round(score * 10) : null
}
```

## 状态映射

| Vnite `record.playStatus` | Kisaki `games.status` |
| ------------------------- | --------------------- |
| `unplayed`                | `notStarted`          |
| `playing`                 | `inProgress`          |
| `partial`                 | `partial`             |
| `finished`                | `completed`           |
| `multiple`                | `multiple`            |
| `shelved`                 | `shelved`             |

未知状态写入 `notStarted` 并产生 warning。

## 日期和时长

| Vnite                     | Kisaki                | 规则                                                               |
| ------------------------- | --------------------- | ------------------------------------------------------------------ |
| `record.addDate`          | `games.createdAt`     | 仅在 `activity.createdAt` 开启时写入 import-only `sourceCreatedAt` |
| `record.lastRunDate`      | `games.lastActiveAt`  | 空值转 `null`                                                      |
| `record.playTime`         | `games.totalDuration` | 毫秒，非负整数                                                     |
| `record.timers[]`         | `game_sessions`       | `start/end` 转 timestamp ms；`end <= start` 跳过并 warning         |
| `record.dailyPlayTimes[]` | 不导入                | Kisaki 可从 sessions 聚合                                          |

如果 `sessions` 开启但 `totalDuration` 关闭，宿主仍应根据导入 sessions 聚合 `games.totalDuration`，除非用户显式关闭“根据会话更新总时长”。第一版不提供该高级选项，保持 totalDuration 与 sessions 同步。

## 本地路径和启动配置

| Vnite                           | Kisaki               | 规则                                             |
| ------------------------------- | -------------------- | ------------------------------------------------ |
| `path.gamePath`                 | `games.launcherPath` | `launcher.mode=file` 时使用                      |
| `utils.rootPath`                | `games.gameDirPath`  | 优先级高于 markPath                              |
| `utils.markPath`                | `games.gameDirPath`  | rootPath 缺失时使用                              |
| `fileConfig.workingDirectory`   | `games.gameDirPath`  | rootPath/markPath 都缺失时使用                   |
| `fileConfig.monitorMode`        | `games.monitorMode`  | 同名映射                                         |
| `fileConfig.monitorPath`        | `games.monitorPath`  | 空时由 Kisaki fallback                           |
| `urlConfig.url`                 | `games.launcherPath` | `launcherMode=url`                               |
| `scriptConfig.command[]`        | `games.launcherPath` | `launcherMode=exec`，用 shell-escaped 字符串拼接 |
| `scriptConfig.workingDirectory` | `games.gameDirPath`  | 空时不写                                         |
| `path.savePaths[0]`             | `games.savePath`     | 多余 savePaths 进入 warning                      |

模式映射：

| Vnite    | Kisaki |
| -------- | ------ |
| `file`   | `file` |
| `url`    | `url`  |
| `script` | `exec` |

不可表达字段：

- `fileConfig.args`
- `urlConfig.browserPath`
- `launcher.useMagpie`
- 多 save paths
- screenshot path

如果 `unknownExtraAsNotes` 或 memories notes 开启，可以生成一条名为 `Vnite 迁移备注` 的 game note 汇总这些 warning。

## 标签和分类

Vnite 没有独立 tag id，只有字符串数组。Kisaki tag 按 name 全局唯一。

| Vnite                  | Kisaki                    | 默认 |
| ---------------------- | ------------------------- | ---- |
| `metadata.tags[]`      | `tags` + `game_tag_links` | 开启 |
| `metadata.genres[]`    | `tags` + `game_tag_links` | 开启 |
| `metadata.platforms[]` | `tags` + `game_tag_links` | 关闭 |

规则：

- 去除空字符串。
- 大小写和原文保持，不做翻译。
- 同一游戏内去重。
- `tags` 和 `genres` 重复时只保留一个关系。
- `platformsAsTags` 开启时 tag note 可标记来源为 `vnite.platform`，但第一版不要求在 UI 展示。

## 公司关系

| Vnite                   | Kisaki                                     |
| ----------------------- | ------------------------------------------ |
| `metadata.developers[]` | company + `game-company(type='developer')` |
| `metadata.publishers[]` | company + `game-company(type='publisher')` |

规则：

- 公司只创建 name-only entity。
- 同名公司复用现有 company。
- 同一游戏同一公司同一 type 去重。
- 补全阶段可用 scraper 将 name-only company 丰富为完整公司。

## 人员和 extra

Vnite `metadata.extra` 的 key 不稳定，默认不导入人员。用户开启 `personsFromExtra` 后按以下规则处理：

| Vnite extra key                         | Kisaki person role |
| --------------------------------------- | ------------------ |
| `director` / `Director`                 | `director`         |
| `scenario` / `Scenario Writer`          | `scenario`         |
| `illustration` / `Illustrator` / `原画` | `illustration`     |
| `music` / `Music`                       | `music`            |
| `voice` / `Voice`                       | `actor`            |

`engine` / `引擎` 默认映射为 tag，不映射为 person。未知 key：

- 如果 `unknownExtraAsNotes=false`，跳过并 warning。
- 如果 `unknownExtraAsNotes=true`，写入 `Vnite 额外信息` note。

## 媒体附件

| Vnite attachment                 | Kisaki attachment slot | 规则                         |
| -------------------------------- | ---------------------- | ---------------------------- |
| `images/cover.webp`              | `cover`                | 开启 `media.cover` 时导入    |
| `images/background.webp`         | `backdrop`             | 开启 `media.backdrop` 时导入 |
| `images/logo.webp`               | `logo`                 | 开启 `media.logo` 时导入     |
| `images/icon.webp`               | `icon`                 | 开启 `media.icon` 时导入     |
| `images/wideCover.webp`          | 无                     | warning                      |
| `images/description/<hash>.webp` | `description-inline`   | 第一版默认关闭               |

附件处理流程：

1. 通过 PouchDB `getAttachment` 读取 buffer。
2. 写入 `temp/vnite-import/<runId>/attachments/<gameId>/<safeName>.webp`。
3. 在 `LibraryGameAttachmentImportItem.sourcePath` 中传给宿主。
4. 宿主通过 `DbService.attachment` 保存，返回最终 fileName。

## 回忆记录

Vnite memory 映射为 Kisaki game note。

| Vnite                        | Kisaki                 |
| ---------------------------- | ---------------------- |
| `memory.memoryList[id].date` | `game_notes.createdAt` |
| `memory.memoryList[id].note` | `game_notes.content`   |
| `images/memories/<id>.webp`  | `game_notes.coverFile` |

note name：

```text
Vnite 回忆 YYYY-MM-DD HH:mm
```

如果没有 note 内容但有图片，仍创建 note。如果没有内容也没有图片，只产生 info diagnostic，不创建空 note。

## 存档记录

Kisaki `SaveBackup`：

```ts
interface SaveBackup {
  backupAt: number
  note: string
  locked: boolean
  saveFile: string
  sizeBytes?: number
}
```

映射：

| Vnite                      | Kisaki                                   |
| -------------------------- | ---------------------------------------- |
| `save.maxBackups`          | `games.maxSaveBackups`                   |
| `save.saveList[id].date`   | `saveBackups[].backupAt`                 |
| `save.saveList[id].note`   | `saveBackups[].note`                     |
| `save.saveList[id].locked` | `saveBackups[].locked`                   |
| `saves/<id>.zip`           | attachment file referenced by `saveFile` |

如果 `saveList` 有记录但 attachment 不存在：

- 不创建不可恢复的 `SaveBackup`。
- 返回 warning `vnite.save.attachmentMissing`。

## 合集

| Vnite                | Kisaki                      |
| -------------------- | --------------------------- |
| `gameCollection._id` | collection import source id |
| `name`               | `collections.name`          |
| `sort`               | `collections.order`         |
| `games[]`            | `collection_game_links`     |
| `sortBy/sortOrder`   | warning                     |

合集导入依赖 game source id 到 Kisaki game id 的映射。若某个 member game 未导入或失败，该 membership 跳过并 warning。

## 冲突策略

`skipExisting`

- external id 或 path 命中现有游戏时不更新游戏字段。
- 如果 `collections=true`，仍可把现有游戏加入导入的合集。
- 不写媒体、sessions、notes。

`mergeSelected`

- external id 或 path 命中现有游戏时，只写用户选择字段中当前为空的字段。
- collection/tag/relation 使用 merge。
- 媒体 slot 只在当前为空时写入。

`overwriteSelected`

- external id 或 path 命中现有游戏时，覆盖用户选择字段。
- collection/tag/relation merge，不删除用户现有关系。
- 媒体 slot 覆盖对应 slot。

第一版 UI 默认 `mergeSelected`。

## 诊断代码

常用 diagnostic code：

```text
vnite.doc.invalid
vnite.date.invalid
vnite.status.unknown
vnite.url.invalid
vnite.launch.argsUnsupported
vnite.launch.magpieUnsupported
vnite.save.multiplePaths
vnite.save.attachmentMissing
vnite.media.wideCoverUnsupported
vnite.collection.sortUnsupported
vnite.extra.unknownKey
vnite.attachment.exportFailed
kisaki.import.existingExternalId
kisaki.import.existingPath
kisaki.import.attachmentPersistFailed
```
