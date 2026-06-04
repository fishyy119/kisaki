# 05 Import Flow And Metadata Completion

Vnite 导入分为分析、graph preview、graph apply、元数据补全和摘要五个阶段。

## 总流程

```text
1. 用户打开 Vnite 导入 settings panel
2. 用户通过 footer submit 选择备份 zip
3. 宿主复制 zip 到受控 temp file grant
4. 扩展解压并读取 PouchDB
5. 扩展生成分析摘要
6. 用户选择字段、冲突策略、是否补全、刮削配置
7. 扩展构建 LibraryGraphInput
8. 扩展调用 kisaki.library.graph.preview
9. 用户确认后扩展创建 TaskRun
10. 扩展重新构建 LibraryGraphInput 并导出附件到 temp
11. 扩展调用 kisaki.library.graph.apply
12. 宿主按 item-level 写入 Kisaki
13. 如启用补全，扩展按 graph apply 结果调用 kisaki.ingest.game.update.fromScraper
14. 扩展完成 TaskRun，输出摘要
15. 扩展清理 run workspace 和 file grant
```

## 分析阶段

输入：

- `ExtensionFileGrant.path`

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

## Graph Preview 阶段

输入：

- `VniteBackupSnapshot`
- 用户字段选择
- 冲突策略
- 是否启用 strict attachment mode

输出：

- `LibraryGraphResult`，`mode='preview'`
- preview rows

preview 调用：

```ts
const graph = buildLibraryGraph({
  snapshot,
  fieldSelection,
  conflictMode,
  strictAttachments
})

const preview = await kisaki.library.graph.preview(graph)
```

`buildLibraryGraph` 必须为所有 node 生成单次 graph 内唯一的 key。Vnite importer 使用 `vnite:<kind>:...` 前缀，便于 result 和 diagnostics 对应回源数据；宿主不持久化这些 key，也不使用它们做跨次导入匹配。

预览要显示：

- 将新增、更新、跳过、失败的游戏数量。
- 命中现有游戏的原因，从 diagnostics 中读取，例如 external id 或 path。
- 字段选择摘要。
- 附件数量。
- 合集数量和成员关系数量。
- warning 摘要。

## Graph Apply 阶段

正式导入前重新构建 graph，不复用过期 preview graph。原因：

- 用户可能改了字段。
- 当前资料库可能变化。
- temp attachment 文件可能已清理。
- preview result 不是写入授权，只是用户可读的计划摘要。

导入步骤：

1. TaskRun phase `reading`: 重新读取 snapshot 或复用仍有效 snapshot。
2. TaskRun phase `buildingGraph`: 生成 `LibraryGraphInput`。
3. TaskRun phase `attachments`: 导出 PouchDB attachments 到 temp。
4. TaskRun phase `writing`: 调用 `kisaki.library.graph.apply`。
5. TaskRun phase `completion`: 可选 ingest 补全。
6. TaskRun phase `cleanup`: 删除 workspace 和 file grant。

取消点：

- zip 解压前后。
- 每个 PouchDB 数据库读取后。
- 每批 attachment 导出后。
- host graph apply 调用前。
- 每个 metadata completion 游戏后。

如果取消发生在 host graph apply 调用中，宿主应尽力遵循 AbortSignal。Graph API 不承诺整包 all-or-nothing；若部分 item 已提交，结果按 committed 返回，TaskRun summary 标明“导入已部分完成”。

## Host Graph Apply Algorithm

`library.graph.apply` 伪代码：

```ts
function applyGraph(input, runtime, mode) {
  validateGraph(input)
  validateScopedPaths(input, runtime)

  const graph = normalizeGraph(input)
  const matches = matchGraphEntities(graph)

  if (mode === 'preview') {
    return createPreviewResult(graph, matches)
  }

  const results = []

  for (const group of createApplyGroups(graph, matches)) {
    const groupResult = db.transaction((tx) => {
      const entityMap = new Map()

      upsertMediaNodes(tx, group.media, group.matches, input.options, entityMap)
      upsertExternalIds(tx, group.media, entityMap)
      upsertEntityNodes(tx, group.entities, entityMap)
      applyRelationshipEdges(tx, group.edges, entityMap)

      return createCommittedGroupResult(group, entityMap)
    })

    const attachmentWarnings = persistAttachments(groupResult, graph)
    results.push(mergeAttachmentDiagnostics(groupResult, attachmentWarnings))
  }

  return createApplyResult(graph, results)
}
```

事务内写：

- media rows
- external id rows
- tag rows and media-tag links
- company/person rows and media relation links
- game_sessions
- game_notes rows
- collection rows and collection-media links
- saveBackups JSON metadata

事务外写：

- binary attachments copied by `DbService.attachment`

附件失败不删除已导入游戏，返回 warning。原因是 Vnite 备份里媒体价值高，但附件失败不应阻断核心用户数据迁移。用户开启 strict attachment mode 时，宿主可把相关 media item 标记为 failed。

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

对每个导入成功的 game media node：

```ts
const lookup = {
  name: sourceGame.input.name || sourceGame.input.originalName || vniteGameId,
  knownIds: (sourceGame.input.externalIds ?? []).filter((id) => id.source !== 'vnite')
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
for (const item of importedGameNodes) {
  await job.checkpoint()
  if (item.action !== 'create' && item.action !== 'update') continue
  if (!item.entityId) continue

  try {
    await kisaki.ingest.game.update.fromScraper(
      {
        rootId: item.entityId,
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

1. Media node 先按 `input.externalIds` 匹配，包括 `source='vnite'`、`steam`、`vndb`、`igdb`、`ymgal`。
2. Media node 再按 `input.gameDirPath` 匹配。
3. Tag 按 name 匹配。
4. Collection 按 name 匹配。
5. Person/company/character 只按 external ids 匹配；没有 external ids 时创建新实体。
6. Note 按 owner media + name 匹配。
7. Session 按 owner media + startedAt + endedAt 匹配。
8. Edges 按 from/to/role/slot/order 语义去重。
9. Media 不使用 name 自动合并。

原因：

- Vnite 备份中存在视觉小说和本地化标题，name 冲突和翻译差异都很常见。
- 自动按 name 合并 media、person、company 或 character 容易破坏现有资料库。

## Idempotency

重复导入同一备份：

- 每个导入游戏命中 `vnite` external id，或用户选择的其他 external id / local path。
- `skipExisting` 不重复创建、不重复写入 notes/sessions/attachments。
- `mergeSelected` 不重复创建关系。
- memories notes 按 owner media + note name 去重。
- sessions 按 owner media + startedAt + endedAt 去重。
- collections 按 name 匹配。
- collection-media、media-tag、media-company、media-person 等 edges 按 from/to/role/slot 去重。

Graph node key 不参与跨次导入匹配。External id 是用户可见来源事实，用于 media matching 和诊断；其他实体按自身自然唯一性或 owner-scoped 规则去重。

## Cleanup

清理对象：

- copied zip grant
- extracted PouchDB workspace
- exported attachment temp files

清理时机：

- 成功、失败、取消后都执行 best-effort cleanup。
- 如果 cleanup 失败，只记录 warning，不改变导入结果。
- `settings.cleanup.keepLastAnalysis=true` 时可保留轻量 analysis summary，不保留解压数据和附件文件。
