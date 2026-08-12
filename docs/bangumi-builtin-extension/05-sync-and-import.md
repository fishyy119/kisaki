# 05 Sync And Import

> 历史设计文档：文中的 `ExtensionTaskRun*` 类型已在 extension-api 中更名为 `TaskRun*`。现状以 `.claude/skills/kisaki/references/extension-system.md` 为准。

## 公共规则

- 所有同步和导入都必须带 `BangumiMediaScope`。
- 只允许 `book`、`game`、`anime`、`music`。
- 外部身份统一使用 `{ source: 'bangumi', id: String(subjectId) }`。
- 所有 Bangumi 读取和写入经过 `BangumiClient`。
- 所有本地库读取和写入经过 `LocalMediaAdapter`。
- 当前只有 `game` 有 local adapter；`book` / `anime` / `music` 不写本地库。
- 导入不得修改任何已有条目的资料元数据，包括 name、originalName、description、releaseDate、assets、externalSites 和 externalIds。
- 导入默认只创建缺失条目；只有单次 command args 显式开启 `patchExisting` 时，才按 Bangumi subject ID 匹配并更新已有本地条目的用户态字段。
- status、score、tag 和目标本地合集属于用户态写入；新建条目按本次 args 写入，已有条目只在 `patchExisting=true` 时写入。
- 导入配置是单次 command args，不写入 `settings.v1`；导入类 automation 需要持久配置时由 automation args 保存。
- 所有长流程走 command + scoped TaskRun wrapper，支持取消、实时 progress 和摘要；持久历史只来自主应用 TaskRun。

## Local Adapter 能力矩阵

| Scope   | 远端收藏读取 | 目录读取 | 本地自动同步 | 本地导入执行 | Scraper provider |
| ------- | ------------ | -------- | ------------ | ------------ | ---------------- |
| `book`  | yes          | yes      | no           | no           | no               |
| `game`  | yes          | yes      | yes          | yes          | yes              |
| `anime` | yes          | yes      | no           | no           | no               |
| `music` | yes          | yes      | no           | no           | no               |

规则：

- `book` / `anime` / `music` 可以生成远端读取结果、预览诊断和 unsupported summary。
- UI 默认不展示 book/anime/music 的本地写入执行按钮。
- job 层必须再次校验 adapter 能力，不能只依赖 UI。

## 自动同步

自动同步只对有 `supportsAutoSync=true` 的 local adapter 启用。当前只有 `game`。

game adapter 订阅事件：

- `game.created`
- `game.updated`

处理条件：

- `settings.media.game.localSyncEnabled = true`。
- `settings.game.autoSync.enabled = true`。
- created 事件只有 `settings.game.autoSync.syncOnCreate = true` 时处理。
- updated 事件只处理 `changes[].facet` 包含 `status`、`score` 或 `identity` 的事件。
- 本地游戏必须有 Bangumi external id；没有 Bangumi external id 时固定跳过。

流程：

1. adapter 把 host event 转成 `LocalMediaChangeEvent`。
2. 事件进入 `SyncSubscription`。
3. 按 `{ scope, localId }` debounce。
4. 如果在 suppress window 内，按 suppress reason 跳过。
5. 优先从 event changes 的 `after` 读取 status/score/externalIds。
6. 缺少必要值时调用 adapter `getLocalItem(localId)`。
7. 根据 scope settings 和 adapter mapping 计算 Bangumi collection payload。
8. 空 payload 跳过。
9. 计算 fingerprint。
10. fingerprint 与上次成功同步一致则跳过。
11. 调用 `BangumiClient.upsertMyCollection(ref, payload)`。当目标收藏类型为 `1` 时，payload 必须包含 `rate=0` 清除远端评分。
12. 写入 sync state；如果本次 job 创建了 TaskRun，同步摘要写入该 TaskRun output。由 automation 触发时，command invocation 记录由主应用 AutomationService 保存，TaskRun 不回写 automation history。

Fingerprint 输入：

- `scope`
- `localId`
- `subjectId`
- play status sync enabled + mapped type
- score sync enabled + mapped rate
- clear remote score strategy
- payload version

不要把 event source 作为防循环条件；当前 public host event 没有 source 字段。

## Suppress 规则

- `SyncEngine` 写入本地用户态字段前后维护 fingerprint suppress，避免本扩展触发的本地变更再次回写 Bangumi。
- `ImportExecutor` 对每个 `addFromScraper` 或 patch existing 涉及的 `{ scope, localId }` 写入 import suppress，覆盖 command 运行期和至少一个 debounce window。
- import suppress 适用于 created 和 updated 事件，防止导入新条目、写入用户态字段或 ingest 创建 external id 后，被自动同步立即回写到 Bangumi。
- import suppress 只跳过短期事件；窗口结束后用户手动修改状态或评分仍可按自动同步规则处理。

## 状态同步

当前只有 game adapter 提供本地 status mapping。默认 mapping 见 [01-scope-and-api-facts.md](01-scope-and-api-facts.md)。

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
- Kisaki 本地 `score` 是 0-100 整数，显示为 0-10 一位小数；写 Bangumi 前转换为 1-10 整数 `rate`。
- Bangumi `type=1` 收藏不能保留评分。目标 `type=1` 时写 `rate=0` 清除远端评分；`type=2..5` 可以正常写入正向 `rate`。
- `score = null` 默认不写 `rate`；目标 `type=1` 时例外，必须写 `rate=0`。
- 用户启用 `clearRemoteScoreWhenEmpty` 时，`score = null` 写 `rate = 0`。
- 本地一位小数评分会四舍五入为 Bangumi 整数 `rate`。

## 手动全量同步

Command:

```text
bangumi.sync.full
```

输入：

- `scope`: 当前只允许 `game` execute。
- 同步对象固定为带 Bangumi ID 的本地条目；settings UI 不提供范围配置。
- `updateExisting`: 同步始终会为远端缺失的条目创建 Bangumi 收藏；该开关只控制是否更新远端已有收藏。
- play status/score override: 可临时覆盖 settings 开关。

流程：

1. 从 `MediaRegistry` 获取 local adapter；没有 adapter 时返回 `local_media_unsupported`。
2. 调用 adapter `listLocalItems` 分批读取本地条目，并跳过没有 Bangumi external id 的条目。
3. 为每个条目解析 `BangumiSubjectRef`。
4. `SyncEngine.collectItem()` 读取远端 collection，判断将新增、修改或跳过。
5. preview 只展示 collect 结果；execute 只对 collect 出的待同步项调用 `SyncEngine.applyItem()`。
6. 每个 subject 独立失败，不中断整批，除非认证失效或用户取消。
7. 输出 summary。

输出分类：

- `synced`
- `wouldSync`
- `skippedNoBangumiId`
- `skippedByMapping`
- `skippedNoChange`
- `skippedUnsupportedScope`
- `failedAuth`
- `failedValidation`
- `failedNetwork`
- `failedUnknown`

## 用户收藏导入

Command:

```text
bangumi.import.collections
```

输入：

- `scope`: `book`、`game`、`anime`、`music`。
- 当前登录账号，来自 `/v0/me`。
- Bangumi 收藏类型过滤。
- `game` execute 需要 game scraper profile id。
- target collection: 不加入合集、加入用户选择的现有本地合集；默认不加入合集。
- field mapping: status、score、tags，单次选择，默认全部关闭。
- patch existing: true/false，默认 false。
- settings 预览不进入 command args，不创建 TaskRun。

拉取：

1. 对每个选中 type 调用 `GET /v0/users/{username}/collections?subject_type=<scope.subjectType>&type=<type>&limit=50&offset=<n>`。
2. 分页直到返回不足一页或达到 total。
3. 每条记录以 `subject_id` 作为主身份。
4. 不依赖 `updated_at` 判断是否需要改写本地用户态字段。

导入：

1. `CollectionReader` 返回 media-scoped remote item。
2. `ImportPlanner` 按 subject ID 与 local adapter 的索引匹配。
3. 如果 scope 没有 local adapter，预览输出 remote-only 计划；execute 返回 unsupported summary。
4. 如果本地已有同 subject ID 且 `patchExisting=false`，记录为已存在并跳过。
5. 如果本地已有同 subject ID 且 `patchExisting=true`，只根据本次 args 补写 status、score、tags 和目标本地合集。
6. 如果本地不存在同 subject ID，调用 adapter `addFromScraper(profileId, lookup)` 创建或定位条目。
7. 对返回的 `localId` 立即写入 import suppress。
8. 如果 result 表示本次新建条目，且用户态字段导入开启，根据 field mapping 写入用户态字段。
9. tag 写入只追加不删除。
10. target collection 不是 `none` 时建立 membership。
11. 导入流程不得写资料元数据。新增条目的资料元数据只来自 ingest 使用的 scraper profile。

## Bangumi 目录导入

Command:

```text
bangumi.import.index
```

输入：

- `scope`: `book`、`game`、`anime`、`music`。
- Bangumi index ID 或 URL。
- `game` execute 需要 game scraper profile id。
- type filter 来自 scope。
- target collection: 不加入合集、加入用户选择的现有本地合集、按 Bangumi 目录名自动创建或复用本地静态合集。
- patch existing: true/false，默认 false。
- settings 预览不进入 command args，不创建 TaskRun。

解析：

- 支持纯数字 ID。
- 支持 `https://bgm.tv/index/<id>`。
- 支持 `https://bangumi.tv/index/<id>`。
- 非法输入直接在 settings panel 显示 validation error。

流程：

1. `GET /v0/indices/{index_id}` 读取目录标题、描述和诊断信息。
2. `GET /v0/indices/{index_id}/subjects?type=<scope.subjectType>&limit=50&offset=<n>` 分页拉取条目。
3. 每个条目的 `id` 作为 Bangumi subject ID。
4. 如果 scope 没有 local adapter，预览输出 remote-only 计划；execute 返回 unsupported summary。
5. 如果 target collection 是 `byIndexTitle`，用目录标题精确查找同名本地静态合集；找不到时预览展示“将创建”，execute 在首次需要写入 membership 时创建。
6. 导入前分页读取本地条目，建立 Bangumi subject ID -> local item 的索引。
7. 如果本地已有同 subject ID 且 `patchExisting=false`，记录为已存在并跳过。
8. 如果本地已有同 subject ID 且 `patchExisting=true` 且选择了目标本地合集，通过 adapter 建立 membership。
9. 如果本地不存在同 subject ID，使用指定 profile 调用 adapter ingest。
10. 对每个 ingest 返回的 `localId` 立即写入 import suppress。
11. target collection 不是 `none` 时，为本次新建条目建立 collection membership。
12. 目录导入不得把目录标题、描述或条目附加文本写入本地条目资料元数据；目录标题只可作为 `byIndexTitle` 目标合集名称。

## Import Planner

两个 importer 共用 `ImportPlanner`：

```ts
type PlannedImportAction =
  | { kind: 'create'; scope: BangumiMediaScope; subjectId: string; name: string; fields: string[] }
  | {
      kind: 'patch'
      scope: BangumiMediaScope
      subjectId: string
      localId: string
      fields: string[]
    }
  | { kind: 'skip'; scope: BangumiMediaScope; subjectId: string; reason: string }
  | { kind: 'unsupported'; scope: BangumiMediaScope; subjectId?: string; reason: string }
  | { kind: 'error'; scope: BangumiMediaScope; subjectId?: string; message: string }
```

planner 不执行写入，只产出可展示、可测试、可复用的计划。runner 的 collect 阶段读取远端、匹配本地、过滤已存在和无变化项，生成实际 operations；preview 只渲染 operations，execute 只执行 operations，并在执行前重新校验 adapter、profile、auth 和取消信号。

## 并发与取消

- Bangumi API 请求受 `BangumiClient` limiter 控制。
- 本地 ingest item 可以并行，但默认并发不超过 4。
- `ExtensionTaskRunHandle.signal` 贯穿 importer、client、limiter、sleep 和 retry。
- 用户取消后停止新 item，正在执行的网络/ingest 尽量中断；TaskRun final status 标记 `cancelled`。
- 单条失败不影响整批；认证失败、profile 缺失、unsupported scope、用户取消属于批次级停止条件。
