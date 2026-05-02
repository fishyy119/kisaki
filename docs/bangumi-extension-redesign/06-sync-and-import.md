# 06 Sync And Import

## 状态映射

Kisaki `LibraryGame.status` 到 Bangumi `SubjectCollectionType` 的默认映射：

| Kisaki status | 默认 Bangumi type | 说明           |
| ------------- | ----------------: | -------------- |
| `notStarted`  |                 1 | 想玩           |
| `inProgress`  |                 3 | 在玩           |
| `partial`     |                 3 | 在玩           |
| `completed`   |                 2 | 玩过           |
| `multiple`    |                 2 | 多周目视为玩过 |
| `shelved`     |                 4 | 搁置           |

所有映射都可配置为任一 Bangumi type 或“不同步”。Bangumi `type=5` 抛弃没有 Kisaki 的一一对应状态，导入默认映射到 `shelved`，也可配置为不导入状态。

## 评分映射

- Kisaki `score` 与 Bangumi `rate` 默认 1:1 映射。
- Bangumi `rate=0` 表示删除评分；默认不把 Kisaki 空评分同步为 0，除非用户启用“清除远端评分”。
- 导入评分时，Bangumi `rate=0` 默认映射为 Kisaki `score=null`。

## 自动同步

事件来源：

- `library.game.created`
- `library.game.updated`
- `library.game.deleted` 只记录本地解除绑定，不删除 Bangumi 收藏。

流程：

1. 监听由 DB event projector 聚合后的 `library.game.created` / `library.game.updated` event。
2. debounce 同一 `gameId`。
3. 对 `updated` event，遍历 `event.changes`，只处理 `facet` 为 `status`、`score` 或 `identity` 的 change；不包含则跳过。
4. 优先使用 change 的 `after` 值构造同步 fingerprint。
5. 若 event payload 缺少所需值，fallback 到 `kisaki.library.games.get(gameId)` 读取最新状态。
6. 检查是否存在 external id `{ source: "bangumi", id }`。
7. 计算 status/rating sync fingerprint。
8. 如果 fingerprint 与上次成功同步一致，则跳过。
9. 按开关生成 payload：只同步状态、只同步评分、或二者一起。
10. 调用 `POST /v0/users/-/collections/{subject_id}` 做 upsert。
11. 保存 sync state、last payload、last success/error。

可设置项：

- 启用自动同步。
- 自动同步状态。
- 自动同步评分。
- 创建新游戏时是否同步。
- 未绑定 Bangumi ID 时：跳过、提示、或用指定 Bangumi scraper profile 尝试 resolve。
- debounce 时间。
- 每个游戏失败重试次数。
- 同步错误是否桌面通知。

## 手动全量同步

入口在 Bangumi 设置面板：

- `预览全量同步`: 不写远端，只统计将新增/修改/跳过/失败的条目。
- `执行全量同步`: 按当前设置同步所有符合条件的本地游戏。
- 过滤：全部、有 Bangumi ID、指定合集、指定状态、评分非空。
- 冲突策略：Kisaki 覆盖 Bangumi、只填远端空值、跳过已有远端值。
- 输出：成功、跳过、无 Bangumi ID、认证错误、API 验证错误、网络错误。

手动全量同步也使用同一 `SyncEngine`，避免自动与手动逻辑分叉。

全量同步同时注册为 command，例如 `bangumi.sync.full`。设置面板按钮只是执行该 command；用户也可以在后台任务面板中把它配置为启动时执行、每日执行或固定间隔执行。

## 用户 Bangumi 数据库导入

入口：设置面板中的“导入我的 Bangumi 游戏收藏”。

输入：

- 当前登录账号，来自 `/v0/me`。
- 指定 game scraper profile。
- Bangumi 收藏类型过滤：想玩、玩过、在玩、搁置、抛弃，可多选。
- 目标合集：不加入合集、选择现有合集、按 Bangumi 收藏类型创建/使用合集。
- 字段映射开关：状态、评分、标签、评价、私有标记。
- 冲突策略：跳过本地已有、只补缺字段、按所选字段覆盖。
- dry run 开关。
- 可保存为后台任务；后台任务保存 command args，不复制导入实现。

拉取：

1. 调用 `GET /v0/users/{username}/collections?subject_type=4&type=<type>&limit=50&offset=<n>`。
2. 对每个选中 type 分页拉取，直到不足一页。
3. 每条记录以 `subject_id` 作为主身份。
4. 不依赖 `updated_at`。

导入：

1. 为每条 Bangumi 收藏生成 `ScraperLookup`：

   ```ts
   {
     name: collection.subject?.name_cn || collection.subject?.name || String(collection.subject_id),
     knownIds: [{ source: "bangumi", id: String(collection.subject_id) }]
   }
   ```

2. 通过新增 ingest capability 调用 `addGameFromScraper(profileId, lookup, options)`。
3. 如果本地已有 Bangumi external id，则进入更新/映射流程，不重复创建。
4. 根据用户选择 patch Kisaki 字段：
   - Bangumi `type` -> Kisaki `status`。
   - Bangumi `rate` -> Kisaki `score`。
   - Bangumi `tags` -> Kisaki tag。
   - Bangumi `comment` 可导入为 game note 或 extension metadata，默认关闭。
   - Bangumi `private` 仅作为 extension metadata，默认不影响 Kisaki 可见性。
5. 导入完成后保存 `lastImportAt`、`lastImportedSubjectIds`、错误摘要。

## Bangumi 目录导入

入口：设置面板中的“导入 Bangumi 目录”。

输入：

- Bangumi 目录 ID 或 URL。
- 指定 game scraper profile。
- 只导入游戏条目，默认启用 `type=4`。
- 目标合集：不加入合集、选择现有合集、按目录标题创建新合集。
- 是否保存目录来源 metadata。
- 冲突策略与用户数据库导入一致。
- Bangumi API 速率使用 Bangumi provider client 设置；导入调度保持并行。
- 可保存为后台任务；后台任务保存目录 ID、scraper profile、目标合集等 command args。

拉取：

1. 调用 `GET /v0/indices/{index_id}` 获取目录标题、描述、NSFW 标记。
2. 调用 `GET /v0/indices/{index_id}/subjects?type=4&limit=50&offset=<n>` 分页获取条目。
3. 每个 `IndexSubject.id` 作为 Bangumi subject ID。

导入：

- 使用指定 scraper profile，`knownIds=[{ source: "bangumi", id }]`。
- 如果选择目标合集，导入成功后建立 `collection-game` 关系。
- 目录条目的 `comment` 默认不写入游戏描述，可选保存为 note 或 extension metadata。
