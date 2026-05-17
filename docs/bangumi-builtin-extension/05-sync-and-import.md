# 05 Sync And Import

## 公共规则

- 所有同步和导入只面向游戏。
- 外部身份统一使用 `{ source: "bangumi", id: String(subjectId) }`。
- 所有 Bangumi 读取和写入经过 `BangumiClient`。
- 所有本地游戏创建经过 `kisaki.ingest.games.addFromScraper`。
- 所有本地字段 patch 只写用户明确启用的字段。
- 所有长流程走 command + `JobRunner`，支持取消、实时 progress 和摘要；持久历史只来自主应用 task 执行记录。

## 自动同步

订阅事件：

- `library.game.created`
- `library.game.updated`

处理条件：

- `autoSyncEnabled = true`。
- created 事件只有 `syncOnCreate = true` 时处理。
- updated 事件只处理 `changes[].facet` 包含 `status`、`score` 或 `identity` 的事件。
- 本地游戏必须有 Bangumi external id；否则按 `unmappedStrategy` 跳过、通知或尝试 resolve。

流程：

1. 事件进入 `SyncSubscription`。
2. 按 `gameId` debounce。
3. 如果在 suppress window 内且 fingerprint 匹配，跳过。
4. 优先从 event changes 的 `after` 读取 status/score/externalIds。
5. 缺少必要值时调用 `kisaki.library.games.get(gameId)`。
6. 根据 settings 计算 Bangumi collection payload。
7. 空 payload 跳过。
8. 计算 fingerprint。
9. fingerprint 与上次成功同步一致则跳过。
10. 调用 `BangumiClient.upsertMyCollection(subjectId, payload)`。
11. 写入 sync state 和 command output；如果由 task 触发，运行记录由主应用 BackgroundTaskService 保存。

Fingerprint 输入：

- `gameId`
- `subjectId`
- status sync enabled + mapped type
- score sync enabled + mapped rate
- clear remote score strategy
- payload version

不要把 event source 作为防循环条件；当前 public host event 没有 source 字段。

## 状态同步

默认 mapping 见 [01-scope-and-api-facts.md](01-scope-and-api-facts.md)。

同步规则：

- status disabled 时不写 `type`。
- status 映射为 `skip` 时不写 `type`。
- `notStarted` 默认写 Bangumi `1`。
- `partial` 和 `inProgress` 默认写 Bangumi `3`。
- `multiple` 和 `completed` 默认写 Bangumi `2`。
- `shelved` 默认写 Bangumi `4`。

## 评分同步

同步规则：

- score disabled 时不写 `rate`。
- `score` 为 1-10 时写同值。
- `score = null` 默认不写 `rate`。
- 用户启用 `clearRemoteScoreWhenEmpty` 时，`score = null` 写 `rate = 0`。
- 本地非整数分数如未来出现，写入前必须按设置定义的策略处理；第一版只接受整数 1-10。

## 手动全量同步

Command:

```text
bangumi.sync.full
```

输入：

- dry run: true/false。
- scope: 全部、有 Bangumi ID、指定合集、指定状态、评分非空。
- conflict policy: `overwriteRemote`、`fillRemoteMissing`、`skipExistingRemote`。
- status/score override: 可临时覆盖 settings 开关。

流程：

1. 根据 query 调用 `kisaki.library.games.list` 分批读取本地游戏。
2. 为每个游戏解析 Bangumi external id。
3. dry run 时可按需读取远端 collection 判断将新增/修改/跳过。
4. execute 时复用 `SyncEngine`。
5. 每个 subject 独立失败，不中断整批，除非认证失效或用户取消。
6. 输出 summary。

输出分类：

- `synced`
- `wouldSync`
- `skippedNoBangumiId`
- `skippedByMapping`
- `skippedNoChange`
- `failedAuth`
- `failedValidation`
- `failedNetwork`
- `failedUnknown`

## 用户收藏导入

Command:

```text
bangumi.import.my-collections
```

输入：

- 当前登录账号，来自 `/v0/me`。
- game scraper profile id。
- Bangumi 收藏类型过滤：想玩、玩过、在玩、搁置、抛弃。
- target collection strategy: 不加入合集、加入现有合集、按收藏类型创建/使用合集。
- field mapping: status、score、tags、comment metadata、private metadata。
- conflict policy: `skip`、`fillMissing`、`overwriteSelected`。
- dry run。

拉取：

1. 对每个选中 type 调用 `GET /v0/users/{username}/collections?subject_type=4&type=<type>&limit=50&offset=<n>`。
2. 分页直到返回不足一页或达到 total。
3. 每条记录以 `subject_id` 作为主身份。
4. 不依赖 `updated_at` 做增量或冲突判断。

导入：

1. 为每条收藏创建 lookup：

   ```ts
   {
     name: subjectName,
     knownIds: [{ source: 'bangumi', id: String(subjectId) }]
   }
   ```

2. 调用 `kisaki.ingest.games.addFromScraper(profileId, lookup, { targetCollectionId })`。
3. 如果 result 表示本地已有 external id，进入字段 patch。
4. 根据 field mapping 调用 `kisaki.library.games.update(gameId, patch)`。
5. tag 导入时先 list/create tag，再创建 `game-tag` relation。
6. 目标合集通过 `targetCollectionId` 或 `collection-game` relation 建立。
7. comment/private 默认不写核心字段；如启用，仅保存到扩展 metadata 摘要，等待未来 note/metadata capability。

dry run 不调用 ingest，不 patch library，只生成计划：

- 已有游戏。
- 将通过 profile 创建。
- 缺少 profile。
- Bangumi 数据缺字段。
- mapping 后无本地写入。

## Bangumi 目录导入

Command:

```text
bangumi.import.index
```

输入：

- Bangumi index ID 或 URL。
- game scraper profile id。
- type filter 固定游戏 `type=4`，第一版不暴露关闭。
- target collection strategy: 不加入合集、加入现有合集、按目录标题创建合集。
- 是否保存目录来源 metadata。
- conflict policy。
- dry run。

解析：

- 支持纯数字 ID。
- 支持 `https://bgm.tv/index/<id>`。
- 支持 `https://bangumi.tv/index/<id>`。
- 非法输入直接在 settings panel 显示 validation error。

流程：

1. `GET /v0/indices/{index_id}` 读取目录标题、描述和诊断信息。
2. `GET /v0/indices/{index_id}/subjects?type=4&limit=50&offset=<n>` 分页拉取游戏条目。
3. 每个条目的 `id` 作为 Bangumi subject ID。
4. 使用指定 profile 调用 ingest。
5. 按目标合集策略建立 collection membership。
6. 目录条目的 comment 默认不写游戏描述；如启用，仅作为扩展 metadata 摘要。

## Import Planner

两个 importer 共用 `ImportPlanner`：

```ts
type PlannedImportAction =
  | { kind: 'create'; subjectId: string; name: string }
  | { kind: 'update'; subjectId: string; gameId: string; fields: string[] }
  | { kind: 'skip'; subjectId: string; reason: string }
  | { kind: 'error'; subjectId?: string; message: string }
```

planner 不执行写入，只产出可展示、可测试、可复用的计划。execute 阶段按计划逐项执行，并在执行前重新校验 profile、auth 和取消信号。

## 并发与取消

- Bangumi API 请求受 `BangumiClient` limiter 控制。
- ingest item 可以并行，但默认并发不超过 4。
- command `event.signal` 贯穿 importer、client、limiter、sleep 和 retry。
- 用户取消后停止新 item，正在执行的网络/ingest 尽量中断；summary 标记 `cancelled`。
- 单条失败不影响整批；认证失败、profile 缺失、用户取消属于批次级停止条件。
