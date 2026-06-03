# 01 Source Facts

本文件记录设计依据。事实源包括 Vnite 源码、Kisaki 当前实现和 `tmp/vnite-database-20260603.zip` 真实备份包。

## Vnite 备份格式

Vnite 的 `backupDatabase(targetPath, exclude?)` 会：

1. 调用 `baseDBManager.closeAllDatabases()` 停止所有 PouchDB 操作。
2. 获取 `getDataPath()` 作为数据根目录。
3. 生成 `vnite-database-YYYYMMDD` 目录名。
4. 将整个数据根目录压缩到目标路径。
5. 重新初始化数据库并发出 `db:backup-completed` 事件。

对应源码：

- `tmp/vnite-main/src/main/features/database/services/backup.ts`
- `tmp/vnite-main/src/main/core/database/BaseDBManager.ts`

真实备份 zip 顶层不是 JSON 导出，而是 LevelDB-backed PouchDB 目录：

```text
config/
config-local/
game/
game-collection/
game-local/
plugin/
theme.css
theme.v4.css
```

`game`、`game-local`、`game-collection` 是导入扩展的核心数据源。`config`、`config-local`、`plugin`、主题 CSS 只用于诊断，不导入。

## PouchDB 数据库

Vnite `BaseDBManager.initAllDatabases()` 初始化以下数据库：

```text
game
game-collection
game-local
config
config-local
plugin
```

本地路径来自 `getDataPath(dbName)`，每个数据库是一个目录。扩展读取备份时必须先解压 zip，再用 `new PouchDB(<extracted>/<dbName>)` 打开目录。

读取规则：

- 使用 `allDocs({ include_docs: true, attachments: false })` 读取文档。
- 忽略 `_design/*` 文档。
- 不将 `_rev` 写入 Kisaki。
- 附件通过 `getAttachment(docId, attachmentId)` 单独读取。
- 每个 PouchDB 实例必须在读取后 `close()`。

## 真实备份统计

`tmp/vnite-database-20260603.zip` 抽样读取结果：

| 项目                  | 数量 |
| --------------------- | ---: |
| game docs             |  124 |
| game-local docs       |  124 |
| game-collection docs  |    5 |
| 有 gamePath 的游戏    |   95 |
| 仅有 markPath 的游戏  |   21 |
| 有 lastRunDate 的游戏 |   63 |
| 有 playTime 的游戏    |   63 |
| 有 timers 的游戏      |   62 |
| 有 score 的游戏       |   32 |
| 有 memoryList 的游戏  |    7 |
| 有 saveList 的游戏    |    2 |
| 有任意附件的游戏      |  124 |
| 附件总数              |  405 |
| 合集成员关系          |   20 |

状态分布：

| Vnite playStatus | 数量 |
| ---------------- | ---: |
| `unplayed`       |   58 |
| `playing`        |   40 |
| `finished`       |   23 |
| `multiple`       |    2 |
| `shelved`        |    1 |

启动模式分布：

| Vnite launcher.mode | 数量 |
| ------------------- | ---: |
| `file`              |  119 |
| `script`            |    2 |
| `url`               |    1 |
| 缺失                |    2 |

外部 ID 覆盖：

| 字段               | 数量 |
| ------------------ | ---: |
| `metadata.steamId` |   27 |
| `metadata.vndbId`  |   28 |
| `metadata.igdbId`  |    0 |
| `metadata.ymgalId` |   80 |

附件覆盖：

| Vnite attachment id         | 数量 | Kisaki 目标     |
| --------------------------- | ---: | --------------- |
| `images/cover.webp`         |  122 | game cover      |
| `images/background.webp`    |  123 | game backdrop   |
| `images/logo.webp`          |   47 | game logo       |
| `images/icon.webp`          |  103 | game icon       |
| `images/memories/<id>.webp` |   10 | game note cover |

真实备份中 `save.saveList` 存在，但没有对应 `saves/<id>.zip` 附件。实现时必须把“有存档记录但附件缺失”作为 warning，而不是失败。

## Vnite gameDoc

`tmp/vnite-main/src/types/models/game.ts` 定义 `gameDoc`：

```ts
interface gameDoc {
  _id: string
  metadata: {
    name: string
    originalName: string
    sortName: string
    releaseDate: string
    description: string
    developers: string[]
    publishers: string[]
    platforms: string[]
    genres: string[]
    tags: string[]
    relatedSites: { label: string; url: string }[]
    steamId: string
    vndbId: string
    igdbId: string
    ymgalId: string
    extra: { key: string; value: string[] }[]
  }
  record: {
    addDate: string
    lastRunDate: string
    score: number
    playTime: number
    playStatus: 'unplayed' | 'playing' | 'partial' | 'finished' | 'multiple' | 'shelved'
    hideFromRecentGames: boolean
    timers: { start: string; end: string }[]
    dailyPlayTimes: { date: string; playTime: number }[]
    storageSize: number
  }
  save: {
    saveList: Record<string, { _id: string; date: string; note: string; locked: boolean }>
    maxBackups: number
    autoRestoreSave: boolean
  }
  memory: {
    memoryList: Record<string, { _id: string; date: string; note: string }>
  }
  apperance: {
    logo: { position: { x: number; y: number }; size: number; visible: boolean }
    nsfw: boolean
  }
}
```

注意事项：

- `apperance` 在 Vnite 源码中拼写如此，导入代码必须兼容该字段名。
- `record.score` 使用 0-10 显示分值，缺失值为 `-1`。Kisaki 数据库存 0-100 整数，因此导入时用 `Math.round(score * 10)`。
- `record.playTime` 是毫秒。Kisaki `games.totalDuration` 和 `game_sessions` 也使用毫秒。
- `record.dailyPlayTimes` 在真实备份中为空；Kisaki 可以由 `game_sessions` 重新聚合，不需要单独落库。
- `metadata.description` 可能包含 HTML，甚至远程图片 URL。导入时保持原文，不在扩展里做不完整的 HTML 转换。

## Vnite gameLocalDoc

`game-local` 与 `game` 使用相同 `_id` 关联：

```ts
interface gameLocalDoc {
  _id: string
  path: {
    gamePath: string
    savePaths: string[]
    screenshotPath?: string
  }
  launcher: {
    mode: 'file' | 'url' | 'script'
    fileConfig: {
      path: string
      args: string[]
      monitorMode: 'file' | 'folder' | 'process'
      monitorPath: string
    }
    urlConfig: {
      url: string
      browserPath: string
      monitorMode: 'file' | 'folder' | 'process'
      monitorPath: string
    }
    scriptConfig: {
      workingDirectory: string
      command: string[]
      monitorMode: 'file' | 'folder' | 'process'
      monitorPath: string
    }
    useMagpie: boolean
  }
  utils: {
    markPath: string
    rootPath: string
  }
}
```

注意事项：

- 真实备份中 `fileConfig.workingDirectory` 存在，但类型定义中未声明。读取器必须宽容接受该字段。
- `path.gamePath` 为空时，可用 `utils.rootPath` 或 `utils.markPath` 作为 `gameDirPath`。
- Kisaki 当前只支持一个 `savePath`。Vnite `savePaths` 多值时，导入第一项，其他路径写入 warning；如果用户同时导入 notes，可生成一条迁移备注。
- `useMagpie`、`browserPath`、file args 和完整 script command 在 Kisaki 当前游戏表中无法完全表达，必须作为 warning 或迁移备注处理。

## Vnite gameCollectionDoc

`game-collection` 文档：

```ts
interface gameCollectionDoc {
  _id: string
  name: string
  sort: number
  sortBy:
    | 'metadata.name'
    | 'metadata.sortName'
    | 'metadata.releaseDate'
    | 'record.lastRunDate'
    | 'record.addDate'
    | 'record.playTime'
    | 'record.storageSize'
    | 'custom'
  sortOrder: 'asc' | 'desc'
  games: string[]
}
```

Kisaki 静态 collection 支持名称、描述、封面、排序值和成员关系，不支持把 Vnite `sortBy/sortOrder` 作为 collection 自身的持久排序规则。导入时：

- `name` -> `collections.name`
- `sort` -> `collections.order`
- `games[]` -> `collection_game_links`
- `sortBy/sortOrder` -> warning 或迁移备注

## Vnite 附件

Vnite 所有游戏媒体和存档都作为 PouchDB attachment 存在于 `game` 文档内：

```text
images/cover.webp
images/background.webp
images/icon.webp
images/logo.webp
images/wideCover.webp
images/memories/<memoryId>.webp
images/memories/inline/<imageId>.webp
images/description/<hash>.webp
saves/<saveId>.zip
```

Kisaki 附件由 `DbService.attachment` 管理，文件名保存在实体表字段中。导入扩展不能直接把文件复制进 attachment 目录，而应把 attachment 解出到扩展临时目录，再交给宿主导入 capability 保存。

## 不导入的数据

以下数据不进入 Kisaki：

- `config-local.sync.*`，可能含同步账号和密码。
- `config-local.network.proxy.*`。
- Vnite 插件配置和插件状态。
- Vnite 热键。
- Vnite 主题 CSS 和外观设置。
- 扫描器配置。Kisaki scanner 与 Vnite scanner 语义不同，后续应由用户在 Kisaki 中重新配置。
- `record.storageSize`。这是 Vnite 的缓存型统计，不应迁移为事实。
- `record.hideFromRecentGames`。Kisaki 当前无对应字段。
- `save.autoRestoreSave`。Kisaki 当前无对应字段。
- logo position/size/visible。Kisaki 当前只存 logo 文件，不存 Vnite 详情页布局参数。

## 设计影响

- Vnite 单个 gameDoc 不足以构成 Kisaki 完整游戏图谱。开发者、发行商和 extra 人员只能创建 name-only entity 与浅层关系。
- 真实备份中媒体附件覆盖高，直接迁移媒体价值较高。
- 真实备份中外部 ID 覆盖有偏向，`ymgalId` 明显多于 `steamId` 和 `vndbId`。补全 lookup 必须优先使用已有 knownIds，缺失时退回名称。
- 真实备份含敏感 config-local。分析器必须只统计安全数据库，默认不读取 config-local 文档内容。
