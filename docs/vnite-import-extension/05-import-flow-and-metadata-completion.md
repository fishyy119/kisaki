# 05 Import Flow And Metadata Completion

Vnite 导入分为分析、预览、直接导入、元数据补全和摘要五个阶段。

## 总流程

```text
1. 用户打开 Vnite 导入 settings panel
2. 用户选择备份 zip
3. 扩展复制 zip 到受控 temp file grant
4. 扩展解压并读取 PouchDB
5. 扩展生成分析摘要和 dry-run 导入计划
6. 用户选择字段、冲突策略、是否补全、刮削配置
7. 扩展创建 TaskRun
8. 扩展导出需要迁移的附件到 temp
9. 扩展调用 kisaki.library.imports.applyGamePlan
10. 宿主事务写入 Kisaki
11. 如启用补全，扩展按导入结果调用 kisaki.ingest.game.update.fromScraper
12. 扩展完成 TaskRun，输出摘要
13. 扩展清理 run workspace
```

## 分析阶段

输入：

- `OpenedFile.path`

输出：

- `VniteBackupAnalysisSummary`
- `VniteBackupSnapshot`

步骤：

1. 校验 zip 大小、扩展名和存在性。
2. 解压到 `temp/vnite-import/<analysisId>/extract`.
3. 查找备份根目录。
4. 确认 `game/`、`game-local/`、`game-collection/` 存在。
5. 用 PouchDB 读取三个数据库。
6. 规范化文档。
7. 统计字段覆盖、附件覆盖、状态分布、可导入数量。
8. 生成 diagnostics。

分析阶段不读取 `config-local` 文档内容。

## 预览阶段

输入：

- `VniteBackupSnapshot`
- 用户字段选择
- 冲突策略
- 当前 Kisaki 资料库匹配结果

输出：

- dry-run `LibraryGameImportResult`
- preview rows

dry-run 调用：

```ts
await kisaki.library.imports.applyGamePlan({
  source,
  options: {
    conflictMode,
    dryRun: true
  },
  games,
  collections
})
```

预览要显示：

- 将新增、更新、跳过、失败的游戏数量。
- 命中现有游戏的原因：external id 或 path。
- 字段选择摘要。
- 附件数量。
- 合集数量和成员关系数量。
- warning 摘要。

## 导入阶段

正式导入前重新构建 plan，不复用过期 dry-run plan。原因：

- 用户可能改了字段。
- 当前资料库可能变化。
- temp attachment 文件可能已清理。

导入步骤：

1. TaskRun phase `reading`: 重新读取 snapshot 或复用仍有效 snapshot。
2. TaskRun phase `planning`: 生成导入计划。
3. TaskRun phase `attachments`: 导出 PouchDB attachments 到 temp。
4. TaskRun phase `writing`: 调用 host import capability。
5. TaskRun phase `completion`: 可选 ingest 补全。
6. TaskRun phase `cleanup`: 删除 workspace。

取消点：

- zip 解压前后。
- 每个 PouchDB 数据库读取后。
- 每批 attachment 导出后。
- host import capability 调用前。
- 每个 metadata completion 游戏后。

如果取消发生在 host import capability 调用中，宿主应尽力遵循 AbortSignal；若 transaction 已提交，结果按 committed 返回，TaskRun summary 标明“导入已部分完成”。

## Host Import Algorithm

`applyGamePlan` 伪代码：

```ts
function applyGamePlan(plan, runtime) {
  validatePlan(plan)
  validateScopedPaths(plan, runtime)

  const normalized = normalizePlan(plan)
  const matches = findMatchesByExternalIdAndPath(normalized)

  if (plan.options.dryRun) {
    return createDryRunResult(normalized, matches)
  }

  const txResult = db.transaction((tx) => {
    const gameMap = new Map()

    for (const item of normalized.games) {
      const match = matches.get(item.sourceGameId)
      const result = upsertGame(tx, item, match, plan.options)
      gameMap.set(item.sourceGameId, result.gameId)
      upsertExternalIds(tx, result.gameId, item.match.externalIds)
      upsertTagsAndRelations(tx, result.gameId, item.relations?.tags)
      upsertCompaniesAndRelations(tx, result.gameId, item.relations?.companies)
      upsertPersonsAndRelations(tx, result.gameId, item.relations?.persons)
      upsertSessions(tx, result.gameId, item.sessions)
      upsertNotes(tx, result.gameId, item.notes)
      upsertSaveBackupMetadata(tx, result.gameId, item.attachments)
    }

    upsertCollections(tx, normalized.collections, gameMap)
    return { gameMap, rowResults }
  })

  const attachmentWarnings = persistAttachments(txResult, normalized)
  return createCommittedResult(txResult, attachmentWarnings)
}
```

事务内写：

- game rows
- external id rows
- tag rows and game_tag_links
- company/person rows and links
- game_sessions
- game_notes rows
- collection rows and collection_game_links
- saveBackups JSON metadata

事务外写：

- binary attachments copied by `DbService.attachment`

附件失败不删除已导入游戏，返回 warning。原因是 Vnite 备份里媒体价值高但附件失败不应阻断核心用户数据迁移。

## Metadata Completion

补全使用 Kisaki ingest，不在 Vnite importer 内实现任何远程 scraper 逻辑。

### Profile Selection

```ts
const profiles = await kisaki.scrapers.profiles.list({ mediaType: 'game' })
```

规则：

- 用户启用补全时必须选择一个 profile。
- 如果 profile 被删除或不可用，正式导入前给出错误，用户可关闭补全继续导入。
- profile 只用于补全，不影响直接导入字段。

### Lookup Construction

对每个导入成功的游戏：

```ts
const lookup = {
  name: imported.name || imported.originalName || sourceGameId,
  knownIds: imported.externalIds.filter((id) => id.source !== 'vnite')
}
```

ID 来源优先级：

1. `steam`
2. `vndb`
3. `igdb`
4. `ymgal`

不强制排序给 host，但扩展构建 lookup 时按该顺序输出，方便日志和诊断稳定。

### Surface Selection

用户可以选择补全范围 preset：

`missingCoreAndMedia`

```ts
;[
  'name',
  'originalName',
  'releaseDate',
  'description',
  'relatedSites',
  'externalIds',
  'covers',
  'backdrops',
  'logos',
  'icons'
]
```

`missingAll`

```ts
;[
  'name',
  'originalName',
  'releaseDate',
  'description',
  'relatedSites',
  'externalIds',
  'tags',
  'person',
  'company',
  'character',
  'covers',
  'backdrops',
  'logos',
  'icons'
]
```

`custom`

- UI 用 multi-select 展示 `GAME_UPDATE_SURFACES`。

默认 policy：

```ts
{
  singularUpdate: 'ifMissing',
  collectionUpdate: 'merge'
}
```

高级覆盖模式可在后续加入，但第一版不提供“补全时覆盖 Vnite 导入字段”的默认入口。

### Completion Runner

伪代码：

```ts
for (const item of importedGames) {
  await job.checkpoint()
  if (item.status !== 'created' && item.status !== 'updated') continue
  if (!item.gameId) continue

  try {
    await kisaki.ingest.game.update.fromScraper(
      {
        rootId: item.gameId,
        profileId,
        lookup: createLookup(item),
        selection: { surfaces },
        policy
      },
      { taskRun: false }
    )
    counters.completed += 1
  } catch (error) {
    diagnostics.push(toCompletionWarning(error, item))
    counters.completionFailed += 1
  }
}
```

并发：

- 第一版使用顺序执行，最简单也最稳。
- 后续可以加 `concurrency=2`，但必须确认 scraper service/profile 的速率限制和 provider 状态安全。

失败策略：

- 单个游戏补全失败不回滚直接导入。
- 如果 scraper profile 缺失，补全阶段整体跳过并 warning。
- 如果用户取消，停止后续补全，保留已完成的直接导入。

## Existing Match Rules

匹配顺序：

1. `source='vnite'` external id。
2. 用户选择 external IDs 时，用 `steam/vndb/igdb/ymgal` external id。
3. 用户选择 local gameDirPath 时，用 `games.gameDirPath`。
4. 不使用 name 自动合并。名称相同只显示 warning，需要用户自己处理。

原因：

- Vnite 备份中存在视觉小说和本地化标题，name 冲突和翻译差异都很常见。
- 自动按 name 合并容易破坏现有资料库。

## Idempotency

重复导入同一备份：

- 已导入游戏命中 `vnite` external id。
- `skipExisting` 不重复创建、不重复写入 notes/sessions/attachments。
- `mergeSelected` 不重复创建关系；sessions 按 `sourceSessionId` 或 startedAt/endedAt 去重。
- memories notes 按 `sourceNoteId` 去重。
- collections 按 `sourceCollectionId` + `source='vnite'` provenance 或 collection name 匹配。

如果当前 Kisaki 没有 collection external id 表，collection provenance 可存入 import manager 内部映射表。若不新增表，则使用 collection name 匹配，且 warning 提示合集名称冲突风险。

## Cleanup

清理对象：

- copied zip grant
- extracted PouchDB workspace
- exported attachment temp files

清理时机：

- 成功、失败、取消后都执行 best-effort cleanup。
- 如果 cleanup 失败，只记录 warning，不改变导入结果。
- `settings.cleanup.keepLastAnalysis=true` 时可保留轻量 analysis summary，不保留解压数据和附件文件。
