# 08 Media Scope Refactor

本文是 Phase 5.5 的执行清单。目标是把当前 phase5 的 game-centered 代码清理为 media-scoped 结构，同时保持 extension API 不变。

完成本文并通过验收搜索后，后续实施从 `07 Implementation Plan` 的 `Phase 6: 收藏导入` 继续。

## 不动的边界

这些模块和公共 contract 不在本轮修改范围：

- `packages/extension-api`
- `packages/extension-sdk`
- `apps/desktop/src/main/services/extension`
- SDK bridge、RPC method string、host contribution registry
- scraper provider contribution point；不新增 `book` / `anime` / `music` scraper contribution point
- library/ingest/background task public capability
- `kisaki.ingest.media.*`、`kisaki.library.media.*` 或 `library.media.*` event

Bangumi 扩展继续使用现有 API，不在扩展内 import 主程序私有模块。代码整洁性通过内部 adapter 达成，不通过修改宿主 contract 达成。所有 game-only 宿主 API 必须通过 `media/game` adapter 包装，通用层只能依赖扩展内部的 adapter interface。

## 支持范围

只支持：

- `book`: Bangumi `SubjectType=1`
- `game`: Bangumi `SubjectType=4`
- `anime`: Bangumi `SubjectType=2`
- `music`: Bangumi `SubjectType=3`

禁止：

- `real`
- `all`
- `unknown`
- 把 book/anime/music 写入 Kisaki games

## 文件迁移图

现有 phase5 文件大致迁移如下：

| 旧位置                               | 新位置                                                               |
| ------------------------------------ | -------------------------------------------------------------------- |
| `scraper/provider.ts`                | `media/game/scraper/provider.ts`                                     |
| `scraper/session.ts`                 | `media/game/scraper/session.ts`                                      |
| `scraper/format/*`                   | `media/game/scraper/format/*`                                        |
| `sync/mapping.ts`                    | `media/game/mapping.ts`                                              |
| `sync/engine.ts`                     | `sync/engine.ts`，去掉 game-specific 类型                            |
| `sync/subscription.ts`               | `sync/subscription.ts`，通过 adapter 订阅                            |
| `sync/queue.ts`                      | `sync/queue.ts`，`games` 改为 `items`                                |
| `jobs/runner.ts` 内 game import 逻辑 | `import/executor.ts` + `media/game/import.ts`                        |
| `ui/settings/shared/profiles.ts`     | `media/game` profile helper 或 `ui/settings/resources.ts` 调 adapter |
| `ui/settings/import/*`               | 保留 UI，args 加 `scope`，game-only 控件按 adapter 能力显示          |

## 新增核心文件

```text
extensions/bangumi/src/media/scopes.ts
extensions/bangumi/src/media/types.ts
extensions/bangumi/src/media/labels.ts
extensions/bangumi/src/media/registry.ts
extensions/bangumi/src/media/book/scope.ts
extensions/bangumi/src/media/game/adapter.ts
extensions/bangumi/src/media/game/mapping.ts
extensions/bangumi/src/media/anime/scope.ts
extensions/bangumi/src/media/music/scope.ts
extensions/bangumi/src/identity/subject-ref.ts
extensions/bangumi/src/import/collection-reader.ts
extensions/bangumi/src/import/index-reader.ts
extensions/bangumi/src/import/planner.ts
extensions/bangumi/src/import/executor.ts
```

## 命名规则

通用层使用：

- `scope`
- `subjectRef`
- `subjectId`
- `localId`
- `item`
- `collectionItem`
- `localAdapter`

game adapter 内允许使用：

- `game`
- `gameId`
- `LibraryGame`
- `game-tag`
- `collection-game`
- `library.game.*`

禁止在通用层使用 game 泛指所有媒体：

- `syncGame`
- `runChangedGamesSync`
- `gamesBySubjectId`
- `BangumiImportMyCollectionsArgs` 中无 scope 的形态
- `sync.queue.games`

## Adapter Interface

通用层依赖的最小 adapter：

```ts
interface LocalMediaAdapter {
  readonly scope: BangumiMediaScope
  readonly supportsAutoSync: boolean
  readonly supportsImportWrite: boolean
  listProfiles?(): Promise<readonly ScraperProfileSummary[]>
  subscribeLocalChanges?(listener: LocalMediaChangeListener): Promise<Disposable>
  listLocalItems(query: LocalMediaListQuery): Promise<readonly LocalMediaItem[]>
  getLocalItem(localId: string): Promise<LocalMediaItem | null>
  findBySubjectIds(subjectIds: readonly string[]): Promise<ReadonlyMap<string, LocalMediaItem>>
  addFromScraper(input: LocalMediaAddFromScraperInput): Promise<LocalMediaAddResult>
  patchUserFields(localId: string, patch: LocalMediaUserPatch): Promise<LocalMediaItem>
  ensureTag(localId: string, tagName: string): Promise<void>
  ensureInCollection(localId: string, target: LocalCollectionTarget): Promise<void>
}
```

`book` / `anime` / `music` 不实现这个 interface。它们只提供 descriptor：

```ts
interface RemoteOnlyMediaDescriptor {
  scope: 'book' | 'anime' | 'music'
  subjectType: 1 | 2 | 3
  label: string
  collectionLabels: Record<BangumiCollectionType, string>
}
```

## Command 重命名

无须向后兼容，直接替换：

| 旧 command                      | 新 command                   |
| ------------------------------- | ---------------------------- |
| `bangumi.sync.changed-games`    | `bangumi.sync.changed-items` |
| `bangumi.import.my-collections` | `bangumi.import.collections` |

保留：

- `bangumi.auth.refresh`
- `bangumi.sync.full`
- `bangumi.import.index`

所有 media-scoped command args 必须新增：

```ts
scope: 'book' | 'game' | 'anime' | 'music'
```

## Storage Key

应用未上线，无须为开发期旧数据设计迁移层；同时也不需要新增新 key。重构直接复用当前 key，原地写入新 schema：

| Key                   | 用途               |
| --------------------- | ------------------ |
| `settings.v1`         | 非敏感设置         |
| `auth.token`          | Bangumi token      |
| `auth.pendingSession` | OAuth pending flow |
| `auth.account`        | 账号快照           |
| `sync.state`          | 同步 fingerprint   |
| `sync.queue`          | 同步队列           |

`sync.queue` shape:

```ts
interface BangumiSyncQueueV1 {
  version: 1
  items: Record<string, SyncQueueItem>
}
```

queue key 建议：

```text
<scope>:<localId>
```

## UI 改造

设置页从“Bangumi 游戏集成”改为“Bangumi 集成”：

- Account tab 不分 scope。
- Sync tab 默认选中 game，只有 local-capable scope 显示同步配置。
- Import tab 的 dialog 带 scope selector。
- Automation tab 只展示 game 本地写入类 task。
- Advanced tab 显示四个 scope 的 subject type 和 local capability。

UI 不展示：

- 三次元
- 全部媒体
- book/anime/music 写入本地库按钮

## 验收搜索

这些命中必须只出现在 `media/game/**` 或文档说明中：

```powershell
rg -n "kisaki\.library\.games|kisaki\.ingest\.games|library\.game\.|game-tag|collection-game" extensions/bangumi/src
```

这些旧名字在代码中应无命中：

```powershell
rg -n "changed-games|syncGame|runChangedGamesSync|sync\.queue\.games" extensions/bangumi/src
```

这些 unsupported scope 不应作为支持项出现：

```powershell
rg -n "\breal\b|三次元" extensions/bangumi/src
```

这些 scope 必须存在：

```powershell
rg -n "book|game|anime|music" extensions/bangumi/src/media docs/bangumi-builtin-extension
```

## 验证命令

```powershell
pnpm build:extension-tooling
pnpm --filter @kisaki/builtin-bangumi typecheck
pnpm --filter @kisaki/builtin-bangumi build
pnpm --filter @kisaki/builtin-bangumi validate
pnpm --filter kisaki typecheck
```

## 完成判定

重构完成时应满足：

- extension API 未变。
- game 功能不退化。
- game-only 宿主 API 被关进 `media/game`。
- book/anime/music 进入 scope、client、UI、args、summary 模型。
- book/anime/music 不写本地库。
- 不新增额外 storage/secrets key。
- 所有验证命令通过。
