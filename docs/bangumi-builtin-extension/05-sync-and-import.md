# 05 Sync And Import

## 公共规则

- 所有同步和导入只面向游戏。
- 外部身份统一使用 `{ source: "bangumi", id: String(subjectId) }`。
- 所有 Bangumi 读取和写入经过 `BangumiClient`。
- 所有本地游戏创建经过 `kisaki.ingest.games.addFromScraper`。
- 导入不得修改已有游戏，包括资料元数据和用户态字段。
- status、score、tag 和 collection membership 属于用户态字段；只在单次导入命令显式启用对应字段且游戏由本次导入新建时才写入。
- 导入配置是单次 command args，不写入 `settings.v1`；导入类 background task 需要持久配置时由 task args 保存。
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
3. 如果在 suppress window 内，按 suppress reason 跳过。sync 写入产生的事件必须匹配 fingerprint；import/ingest 产生的事件按 `gameId` 短期跳过，不要求 fingerprint 匹配。
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

Suppress 规则：

- `SyncEngine` 写入本地 status/score 前后维护 fingerprint suppress，避免本扩展触发的本地变更再次写回 Bangumi。
- `CollectionImporter` 和 `IndexImporter` 对每个 `ingest.games.addFromScraper` 返回的 `gameId` 写入 import suppress，覆盖 command 运行期和至少一个 debounce window。
- import suppress 适用于 created 和 updated 事件，防止导入新游戏、写入新游戏用户态字段或 ingest 创建 external id 后，被自动同步立即回写到 Bangumi。
- import suppress 只跳过短期事件；窗口结束后用户手动修改游戏状态或评分仍可按自动同步规则处理。

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
- target collection strategy: 不加入合集、加入现有合集、按收藏类型创建/使用合集；默认不加入合集。
- field mapping: status、score、tags，单次选择，默认全部关闭。
- dry run。

拉取：

1. 对每个选中 type 调用 `GET /v0/users/{username}/collections?subject_type=4&type=<type>&limit=50&offset=<n>`。
2. 分页直到返回不足一页或达到 total。
3. 每条记录以 `subject_id` 作为主身份。
4. 不依赖 `updated_at` 判断是否需要改写本地用户态字段。

导入：

1. 为每条收藏创建 lookup：

   ```ts
   {
     name: subjectName,
     knownIds: [{ source: 'bangumi', id: String(subjectId) }]
   }
   ```

2. 调用 `kisaki.ingest.games.addFromScraper(profileId, lookup)` 创建或定位游戏。为避免误改已有游戏，Bangumi importer 不把 `targetCollectionId` 直接传给 ingest。
3. 对返回的 `gameId` 立即写入 import suppress。
4. 如果 result 表示本地已有游戏，记录为已存在并结束该条处理，不写 status、score、tag 或 collection membership。
5. 如果 result 表示本次新建游戏，且 status/score 导入开启，根据 field mapping 写入用户态字段。
6. 如果 result 表示本次新建游戏，且 tag 导入开启，使用 Bangumi 用户收藏上的自定义 tags，先 list/create tag，再创建 `game-tag` relation。
7. 如果 result 表示本次新建游戏，且 target collection strategy 不是 `none`，解析目标合集并通过 `collection-game` relation 建立 membership。
8. 导入流程不得写 name、originalName、description、releaseDate、assets、relatedSites、externalIds 等资料元数据。新增游戏的资料元数据只来自 `ingest.games.addFromScraper` 使用的 scraper profile。

dry run 不调用 ingest，不写 library，只生成计划：

- 已有游戏，且不会被修改。
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
- target collection strategy: 不加入合集、加入现有合集、按目录标题创建合集；默认不加入合集。
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
5. 对每个 ingest 返回的 `gameId` 立即写入 import suppress。
6. target collection strategy 不是 `none` 时，只为本次新建游戏建立 collection membership；已有游戏不写入合集关系。
7. 目录导入不得把目录标题、描述或条目附加文本写入游戏资料元数据。

## Import Planner

两个 importer 共用 `ImportPlanner`：

```ts
type PlannedImportAction =
  | { kind: 'create'; subjectId: string; name: string; fields: string[] }
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
