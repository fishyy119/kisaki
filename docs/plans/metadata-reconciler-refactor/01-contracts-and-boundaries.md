# 协议与职责边界

## 服务职责边界

### Renderer：单体更新

- 选择 scraper profile。
- 执行 search。
- 让用户选择目标结果。
- 让用户选择 `surfaces`。
- 让用户选择 reconcile policy。
- 基于用户选择构造精确 lookup。
- 向 main 发送一次 reconcile 请求。
- 迁移完成后不再直接调用 `scraper:scrape-*`。
- 迁移完成后不再自行组装 metadata patch payload。

### Renderer：批量更新

- 选择 profile。
- 选择 `surfaces`。
- 选择 reconcile policy。
- 选择 batch lookup 选项。
- 在 renderer 读取当前根实体摘要。
- 在 renderer 本地循环每个 root。
- 对每个 root 组装 lookup。
- 对每个 root 调用同一套单体 reconcile IPC。
- 在 renderer 本地维护进度、成功数、失败数和最终摘要。
- 不新增 main 侧 batch coordinator。
- 不新增 batch IPC、batch progress event 或 batch result contract。
- 迁移完成后不再在 renderer 内部循环执行 `search -> scrape -> update`。

### Main：单体 reconcile

- 校验请求。
- 归一化 lookup，并将可选的 search-provider 选中结果折叠进本次 scrape 输入。
- 调用 `ScraperService` 现有 `scrape` 入口获取 scraper bundle。
- 在 `services/reconciler/incoming` 中构建 incoming model，并推导 availability。
- 加载当前根实体状态，以及本次所选 surface 所需的最小关系图。
- 生成 reconcile plan。
- 在一个事务中应用数据库变更。
- 在事务提交后执行 asset flush。
- 仅返回标准 success / error。

### Main：ScraperService

- 保持现有 search / scrape bundle 输出职责。
- 对所选 profile 当前启用的 provider 内容执行 scrape，并返回现有 `Scraped*Bundle | null`。
- 不感知 reconciler 的 incoming / availability / plan 类型。
- 本次重构不为 reconciler 单独新增 scraper 专用 API。

### Main：IngestService

- add 流程保持原样。
- 不参与本次 reconciler 架构改造。

## 共享协议

### 策略

```ts
export interface ReconcilePolicy {
  singularUpdate: 'ifMissing' | 'overwrite'
  collectionUpdate: 'merge' | 'replace'
}
```

补充说明：

- `singularUpdate` 控制所有单值 surface，包括核心单值项与媒体。
- `collectionUpdate` 控制所有集合型 surface，包括 `relatedSites`、`tags`、`externalIds` 与关系集合。
- `character` reconcile 显式暴露 `person` surface，对应 `characterPerson`。
- `game` reconcile 里的 nested `characterPerson` 不作为独立 surface 暴露；
  只在选择 `character` 时跟随维护。

### 选择模型

```ts
export interface ReconcileSurfaceDefinition<TKey extends string = string> {
  key: TKey
  group: 'core' | 'media' | 'relation'
  cardinality: 'singular' | 'collection'
}

export interface ReconcileSelection<TSurface extends string> {
  surfaces: TSurface[]
}
```

### 单体请求

```ts
export interface ReconcileLookup {
  name: string
  knownIds: ExternalId[]
  searchProviderId?: string
  searchProviderItemId?: string
}

export interface ReconcileRequest<TSurface extends string> {
  rootId: string
  profileId: string
  lookup: ReconcileLookup
  selection: ReconcileSelection<TSurface>
  policy: ReconcilePolicy
}
```

补充说明：

- `knownIds` 仍然是跨 provider 的主定位输入。
- `searchProviderId + searchProviderItemId` 只在 renderer 已明确选中 search 结果时传递。
- main 在真正调用 `ScraperService.scrape()` 前，将该选中结果折叠为对应 provider 的 known ID，
  以避免“用户选中了一条结果，但 scrape 又退回名字搜索命中另一条”的偏移。

### 单体响应

- 单体 reconcile IPC 只返回标准 success / error。
- 不额外设计 `ReconcileResult`、warning payload 或 no-op payload。
- 是否发生实际写入、是否内部 no-op、是否出现非致命 flush 日志，都不作为公共协议暴露给 renderer。

### Batch 约束

- 不设计 `ReconcileBatchRequest`、`ReconcileBatchResult` 或 batch failure / warning 聚合结构。
- batch 的本地进度状态只存在于 renderer，不进入 shared contract。

## IPC

## 单体

- `reconciler:reconcile-game-from-scraper`
- `reconciler:reconcile-character-from-scraper`
- `reconciler:reconcile-person-from-scraper`
- `reconciler:reconcile-company-from-scraper`

## Batch

- 不新增 `reconciler:batch-*` IPC。
- 不新增 `reconciler:batch-progress`。

## 实体选择面

## `game`

- `core`: `name`、`originalName`、`releaseDate`、`description`、`relatedSites`、`externalIds`、`tags`
- `relation`: `person`、`company`、`character`
- `media`: `covers`、`backdrops`、`logos`、`icons`

## `character`

- `core`: `name`、`originalName`、`birthDate`、`gender`、`age`、`bloodType`、`height`、`weight`、`bust`、`waist`、`hips`、`cup`、`description`、`relatedSites`、`externalIds`、`tags`
- `relation`: `person`
- `media`: `photos`

## `person`

- `core`: `name`、`originalName`、`birthDate`、`deathDate`、`gender`、`description`、`relatedSites`、`externalIds`、`tags`
- `relation`: 无
- `media`: `photos`

## `company`

- `core`: `name`、`originalName`、`foundedDate`、`description`、`relatedSites`、`externalIds`、`tags`
- `relation`: 无
- `media`: `logos`

## Incoming 构造与 Availability

`incoming` 和 `availability` 由 `services/reconciler/incoming` 基于 `Scraped*Bundle` 推导。

```ts
interface ReconcileIncomingBundle<TCore, TRelationFacts, TMediaCandidates> {
  core: Partial<TCore>
  relationFacts: Partial<TRelationFacts>
  mediaCandidates: Partial<TMediaCandidates>
}

interface ReconcileIncomingAvailability<TSurface extends string> {
  surfaces: Set<TSurface>
}

interface ReconcileIncomingBuildResult<
  TSurface extends string,
  TCore,
  TRelationFacts,
  TMediaCandidates
> {
  incoming: ReconcileIncomingBundle<TCore, TRelationFacts, TMediaCandidates>
  availability: ReconcileIncomingAvailability<TSurface>
}
```

## 目标目录结构

```text
apps/desktop/src/main/services/
  reconciler/
    handlers/
    incoming/
    current/
    plan/
    apply/
    service.ts
    types.ts
    index.ts

apps/desktop/src/shared/
  reconciler.ts
```
