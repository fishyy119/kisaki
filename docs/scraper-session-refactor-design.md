# Scraper Session Refactor Design

## 1. 背景

当前 scraper 已经具备几项正确的基础形态：

- 按 `game / person / company / character` 分 handler、provider、merge、types。
- 配置层通过 `searchProviderId + slotConfigs` 描述抓取行为。
- merge 逻辑按 media 独立实现，且已经承载了大量 media-specific 语义。
- shared 层已经沉淀了 `slot`、`bundle`、`search result`、`lookup` 等跨层契约。

这套形态要保留。问题不在 media 分层，而在执行模型仍然是“宿主按 slot 驱动 provider 的一组独立方法”。

当前执行链路大致是：

1. handler 读取 profile。
2. handler 用 `searchProviderId` 做首轮 `search/resolve`。
3. handler 针对每个 slot，按 `slotConfigs[slot].providers` 顺序逐个调用 provider 的 `getInfo/getTags/getCharacters/...`。
4. merge 基于 slot 结果合并 bundle。

`resolve` 层已经有 promise cache，但缓存边界只到“provider 搜索结果”。一旦进入 slot 拉取阶段，provider 之间、slot 之间仍然互相隔离，导致同一 provider 在一次 invocation 内被重复请求。

## 2. 现状问题

### 2.1 重复请求发生在 provider 内部而不是 handler 外部

当前 `resolve` 只解决“同一 provider 的多次 search”。它不能解决：

- `info` 和 `tags` 都依赖同一详情接口，但会分别请求。
- `persons` 和 `companies` 依赖同一关系接口，但会分别请求。
- `covers`、`backdrops`、`icons` 都依赖同一资源对象，但会分别请求。

在现有内置 provider 中，这类情况已经非常明显：

- `BangumiProvider`
  - `getInfo` 与 `getTags` 都会读取 `subject`。
  - `getPersons` 与 `getCompanies` 都会读取 `subjectPersons` 和 person detail。
  - `getCovers`、`getBackdrops`、`getIcons` 都会再次读取 subject 或 relation image。
- `VNDBProvider`
  - `getInfo`、`getTags`、`getCovers`、`getBackdrops` 都围绕 `getVnById` 的不同字段集展开。
  - `getPersons`、`getCharacters`、`getCompanies` 之间也存在 staff、schema、entity detail 级别的共享空间。

也就是说，真正知道“哪些请求可以合并、哪些数据可以复用”的是 provider 本身，不是 handler。

### 2.2 `first` 和 `enrich` 的执行思路割裂

当前行为虽然正确，但执行模型分成两种心智：

- `first`：按 slot 顺序、按 provider 顺序，找到第一个有效结果就停。
- `enrich`：按 slot 并发跑全部 provider，再交给 merge 去补齐。

结果是：

- handler 里有大量按 slot 分支的控制逻辑。
- provider 复用机会取决于 slot 循环方式，而不是 provider 自己的资源布局。
- `getProviderImages` 这样的单槽辅助路径又重复了一套 resolve + fetch 逻辑。

### 2.3 handler 知道太多 provider 细节

当前 handler 需要了解：

- provider 是否支持某个 slot。
- 调哪个具体方法。
- 什么数据算“有效”。
- 什么时机可以短路。

这让 handler 既像 orchestrator，又像 provider adapter，职责过重。

### 2.4 `common.ts` 已经承载了过多不同层次的职责

当前 `handlers/common.ts` 同时负责：

- provider contract 校验。
- profile slot config 清洗。
- provider entry 排序。
- slot 有效性校验。
- resolve cache。

这些职责已经足够拆成独立模块，否则后续继续引入 planner / executor / state 时会进一步膨胀。

## 3. 重构目标

### 3.1 必须达成

- 保留当前按 media 拆分的 scraper 结构与类型体系。
- 保留配置层的 `searchProviderId + slotConfigs`。
- 保留 `merge` 按 media-specific 逻辑执行。
- 解决同一 provider 因多个 slot 被重复请求的问题。
- 统一 `first / enrich` 的执行模型。
- 让 provider 能在内部复用上游请求与缓存结果。
- 让 `scrape` 与 `getProviderImages` 共享同一套 resolve / session / payload 执行路径。

### 3.2 明确不做

- 不做旧 provider 接口兼容层。
- 不保留 `getInfo/getTags/getCharacters/...` 直连式执行模型。
- 不为旧插件提供双协议过渡。
- 不把 merge 抽成通用框架。
- 不引入跨 invocation 的全局抓取缓存。

本次重构默认是一次性切换，仓库内所有内置 provider 与插件接入点同步迁移。

## 4. 设计原则

### 4.1 保留 media 边界，重构执行边界

需要重构的是“宿主如何调 provider”，不是“如何统一 game/person/company/character 的业务差异”。

因此：

- `handler.ts` 继续按 media 分开。
- `provider.ts` 继续按 media 提供强类型接口。
- `merge.ts` 继续按 media 保持纯函数化合并。
- 只把通用执行基础设施下沉到 `handlers/common/`。

### 4.2 宿主负责编排，provider 负责资源拓扑

宿主知道：

- profile 配置。
- slot 顺序与策略。
- provider 注册表。
- 一次 invocation 的生命周期。

provider 知道：

- 如何把 lookup 解析成站内目标。
- 哪些 slot 共享同一上游资源。
- 哪些请求必须串行，哪些可以并行。
- 哪些数据需要局部缓存、Promise 去重或局部索引。

### 4.3 `first` 和 `enrich` 只应影响“结果闭包”，不应改变底层取数原语

统一后的底层取数原语只有一个：

- `resolve provider target`
- `open provider session`
- `session.get(slots)`

`first` 和 `enrich` 的区别只体现在：

- planner 如何安排 first wave 和 enrich wave。
- executor 在拿到结果后是否关闭某个 slot。
- merge 如何应用策略。

### 4.4 Session 是 provider 内部复用的唯一入口

session 的核心作用不是“包装旧方法”，而是：

- 让一次 invocation 内同一 provider、同一 target 的资源请求天然聚合。
- 让 provider 能以资源组为单位管理缓存，而不是被 slot API 切碎。
- 让宿主不再关心 provider 内部到底是 subject、detail、schema、relation 还是 compound request。

## 5. 目标目录结构

```text
apps/desktop/src/main/services/scraper/
  service.ts
  index.ts
  types.ts
  handlers/
    common/
      planner.ts
      executor.ts
      resolve.ts
      registry.ts
      state.ts
    game/
      handler.ts
      merge.ts
      types.ts
      provider.ts
      providers/
    person/
      handler.ts
      merge.ts
      types.ts
      provider.ts
      providers/
    company/
      handler.ts
      merge.ts
      types.ts
      provider.ts
      providers/
    character/
      handler.ts
      merge.ts
      types.ts
      provider.ts
      providers/
apps/desktop/src/shared/scraper/
  slot.ts
  bundle.ts
  game.ts
  person.ts
  company.ts
  character.ts
  index.ts
```

说明：

- `service.ts / index.ts / shared/scraper/*` 继续保留当前位置与职责。
- `handlers/common.ts` 将完全拆分并删除。
- 每个 media 继续维护自己的 `handler / merge / types / provider / providers`。

## 6. 目标架构总览

新的执行链路如下：

1. media handler 作为入口，负责 profile 读取、校验、调用 common 基础设施。
2. planner 根据 `slotConfigs` 生成统一执行计划。
3. resolve 根据 lookup 与 provider，把实体解析为 provider target。
4. state 管理一次 invocation 内的 resolve cache、session cache、payload cache。
5. executor 按计划执行 first wave，再补齐 enrich wave，收集 media-specific result。
6. merge 用 media-specific 逻辑产出最终 bundle。

抽象关系如下：

- `handler`
  - media facade
  - profile 校验
  - 构建 invocation context
  - 调用 planner / executor / merge
- `planner`
  - 只理解 slot config、provider 顺序、策略和 locale
  - 不触发网络请求
- `resolve`
  - 只负责把 `ScraperLookup` 变成 provider target
  - 使用 state 做 promise cache
- `executor`
  - 只做执行，不做 merge
  - 统一 first / enrich 两阶段
- `state`
  - invocation-scoped 缓存容器
  - 管理 session 生命周期与 payload 复用
- `provider session`
  - provider 内部的资源组缓存与请求编排
- `merge`
  - 纯函数
  - 不触碰 registry、resolve、session、network

## 7. 核心类型设计

### 7.1 保留的 shared 契约

下面这些 shared 契约继续保留，不改变职责：

- `ScraperLookup`
- `ScraperCapability`
- `Game/Person/Company/CharacterSearchResult`
- `Scraped*Bundle`
- `slot.ts` 中的 slot config、strategy、utility

配置层仍然以：

- `searchProviderId`
- `slotConfigs[slot].providers`
- `slotConfigs[slot].strategy`
- `slotConfigs[slot].unmatchedEntityPolicy`

作为唯一行为配置源。

### 7.2 新的 provider 基础契约

每个 media 继续有自己的 provider 接口，但统一遵循新的模型：

```ts
interface BaseResolvedTarget {
  cacheKey: string
  resolveName?: string
}

interface BaseSessionGetResult<TSlot extends string, TPayload> {
  slot: TSlot
  data: TPayload
}

interface BaseScraperSession<TSlot extends string, TResultMap> {
  get(slots: readonly TSlot[]): Promise<Partial<TResultMap>>
  dispose?(): Promise<void>
}
```

以 game 为例，目标接口形态如下：

```ts
interface GameResolvedTarget extends BaseResolvedTarget {
  id: string
}

interface GameSessionResultMap {
  info: GameInfo
  tags: Tag[]
  characters: ScrapedGameCharacterFact[]
  persons: ScrapedGamePersonFact[]
  companies: ScrapedGameCompanyFact[]
  covers: string[]
  backdrops: string[]
  logos: string[]
  icons: string[]
}

interface GameScraperSession extends BaseScraperSession<GameScraperSlot, GameSessionResultMap> {}

interface GameScraperProvider {
  readonly id: string
  readonly name: string
  readonly capabilities: readonly ScraperCapability[]

  search(query: string, locale?: Locale): Promise<GameSearchResult[]>
  resolve(lookup: ScraperLookup, locale: Locale): Promise<GameResolvedTarget | null>
  openSession(target: GameResolvedTarget, locale: Locale): Promise<GameScraperSession>
}
```

其他 media 也保持相同形态，但：

- `ResolvedTarget` 是各自的强类型。
- `SessionResultMap` 是各自 slot 到 payload 的强类型映射。
- `Session` 只暴露该 media 的合法 slots。

### 7.3 `resolve` 返回 target，而不是仅返回 provider ID

当前 resolve 只产出 `{ id, originalName }` 一类最小结果。新模型下 `resolve` 必须返回可作为 session 输入的 provider target。

`target` 是宿主不可解构的半透明对象，但必须包含：

- `cacheKey`
  - 供 state 复用同一 provider target 的 session。
- `resolveName`
  - 可选。
  - 用于把 search provider 的 canonical/original name 继续传给其他 provider resolve。

其余字段完全由 media provider 自己定义，例如：

- `id`
- `subjectType`
- `resourceHint`
- `canonicalLocale`
- `seedPayload`

这使 provider 可以把“resolve 阶段已经拿到的信息”带进 session，而不是再丢失一次。

### 7.4 `session.get(slots)` 返回 slot payload map

`session.get(slots)` 的责任是：

- 接收一个 slot 集合。
- 按 provider 内部最优方式完成取数。
- 返回本次请求里已成功得到的 slot payload。

约束：

- 可以返回 `Partial<ResultMap>`，表示部分 slot 无结果或失败。
- 不负责决定 `first` 或 `enrich`。
- 不负责 merge。
- 可以为了满足一个 slot，顺手缓存更多资源，但不必把未请求 slot 主动返回给宿主。

建议语义：

- `session.get(['info', 'tags'])` 与先后调用 `get(['info'])`、`get(['tags'])` 应当得到一致结果。
- 同一 session 内重复请求同一 slot，必须复用已有 promise 或已有 payload。
- provider 应尽量按资源组缓存，而不是按 slot 缓存。

### 7.5 统一的 provider services contract

provider 不应该直接依赖 handler 内部实现。宿主只注入稳定的基础能力。

建议引入：

```ts
interface ScraperProviderDeps {
  network: NetworkService
  log: typeof log
  helper: {
    lookup: {
      findKnownId(lookup: ScraperLookup, providerId: string): string | undefined
    }
    date: {
      parsePartialDate(input: string | null | undefined): PartialDate | undefined
    }
    text: {
      normalizeDescription(value: string | null | undefined): string | undefined
    }
  }
}
```

原则：

- 只注入稳定、通用、基础设施级依赖。
- 不把 profile、slot strategy、merge helper 这类宿主策略塞进 provider。
- locale 通过 `search / resolve / openSession` 的参数传入，不通过 services 隐式读取。

内置 provider 统一改为：

```ts
constructor(deps: ScraperProviderDeps) {}
```

而不是继续按 provider 自己决定注入参数形态。

## 8. common 层模块职责

### 8.1 `registry.ts`

职责：

- provider 注册与卸载。
- provider contract 校验。
- provider info 查询。
- slot capability 与方法一致性校验。

不负责：

- profile 读取。
- resolve cache。
- session 生命周期。
- merge。

建议导出能力：

- `createProviderRegistry<TProvider>()`
- `assertProviderContract(...)`
- `getProvider(...)`
- `hasRegisteredProvider(...)`
- `listProviders(...)`

### 8.2 `state.ts`

`state` 代表一次 scrape invocation 的运行态。

必须管理三层缓存：

1. `resolve cache`
   - key: `providerId + normalized lookup + locale`
   - value: `Promise<ResolvedTarget | null>`
2. `session cache`
   - key: `providerId + target.cacheKey + locale`
   - value: `Promise<Session>`
3. `payload cache`
   - key: `providerId + target.cacheKey + slot + locale`
   - value: `Promise<Payload | null>`

说明：

- `resolve cache` 防止同一 provider 被重复 search / resolve。
- `session cache` 防止同一 provider target 被重复 `openSession`。
- `payload cache` 防止 executor 的不同阶段、不同调用路径重复请求同一 slot。

即使 provider session 自己也会缓存资源，宿主仍然需要 payload cache，原因是：

- `scrape` 与 `getProviderImages` 未来应共用同一执行器能力。
- executor 可能在 first wave 与 enrich wave 之间再次请求同一 slot。
- payload cache 可以把宿主级“某 slot 是否已经拿过”表达清楚，而不是把所有语义都压给 provider。

建议同时提供：

- `collect(result)`
- `getCollectedResults()`
- `dispose()`

`dispose()` 负责调用所有 session 的 `dispose?()`，保证 invocation 结束时无遗留资源。

### 8.3 `resolve.ts`

职责：

- 把 `ScraperLookup` 解析成 provider target。
- 优先消费 `knownIds`。
- 以 `searchProviderId` 的 resolve 结果补全 canonical `resolveName`。
- 通过 state 共享 resolve promise。

建议职责边界：

- provider 自己实现 `resolve`。
- common/resolve 负责 orchestration，不负责 provider-specific search 细节。

推荐流程：

1. 先 resolve `searchProviderId`。
2. 如果得到 `target.resolveName`，则生成 `canonicalLookup`。
3. 其他 provider 都用 `canonicalLookup` resolve。
4. resolve 结果只进入 state，不直接触发 slot fetch。

### 8.4 `planner.ts`

planner 的输入：

- validated profile
- media slots
- provider registry

planner 的输出：

- first wave 计划
- enrich wave 计划
- 每个 slot 的 provider 顺序与 locale

planner 只做静态计划，不碰网络，也不读取 state。

建议产物形态：

```ts
interface PlannedSlotEntry<TSlot extends string> {
  slot: TSlot
  providerId: string
  priority: number
  locale: Locale
  strategy: SlotStrategy
}

interface PlannedProviderTask<TSlot extends string> {
  providerId: string
  slots: readonly TSlot[]
  entries: readonly PlannedSlotEntry<TSlot>[]
}

interface PlannedWaveStep<TSlot extends string> {
  rank: number
  tasks: readonly PlannedProviderTask<TSlot>[]
}

interface ScraperExecutionPlan<TSlot extends string> {
  firstWave: readonly PlannedWaveStep<TSlot>[]
  enrichWave: readonly PlannedWaveStep<TSlot>[]
}
```

核心思想不是“按 slot 调 provider”，而是“按执行阶段把同一 provider 的 slot 需求折叠成 provider task”。

举例：

- profile 中 `info/tags/covers` 都先走 `bangumi`
- `characters/persons` 都先走 `vndb`

则 first wave 可直接规划为同一 rank 内的 provider tasks：

- `bangumi -> [info, tags, covers]`
- `vndb -> [characters, persons]`

而不是五次独立 slot 调用。

### 8.5 `executor.ts`

executor 是新的核心执行器。

职责：

- 执行 first wave。
- 在 first wave 完成后补齐 enrich wave。
- 校验 slot payload 有效性。
- 收集 media-specific result 供 merge 使用。

它不负责：

- provider 注册。
- profile DB 读写。
- merge。

建议执行算法：

1. 创建 invocation state。
2. resolve `searchProviderId`，产出 canonical lookup。
3. planner 生成 `ExecutionPlan`。
4. 执行 first wave：
   - 按 `rank` 遍历 wave step。
   - 每个 step 内的 provider tasks 可以并行执行。
   - 对每个 provider task：
     - resolve target
     - open/reuse session
     - 从 payload cache 中找缺失 slots
     - 对缺失 slots 调 `session.get(missingSlots)`
     - 将返回结果写入 payload cache
     - 校验有效性
     - 对 `first` slot 在首个有效结果后关闭
     - 对 `enrich` slot 收集结果但不关闭
5. 执行 enrich wave：
   - 继续按 `rank` 处理 wave step
   - 对仍需补齐的 enrich provider task 重复同样流程
6. 输出 collected results。
7. 最后 `dispose state`。

这里的统一点在于：

- first wave 与 enrich wave 使用同一个 `runProviderTask` 原语。
- 差异只在“slot 是否已关闭”以及“某个 provider task 是否仍需执行”。

## 9. media 层职责划分

### 9.1 `handler.ts`

每个 media handler 保留为公开入口，负责：

- profile 读取与 `ensureProfileValid`。
- 调用 planner / executor / merge。
- 暴露 `search`、`scrape`、`getProviderImages`、provider registry facade。

需要删除的旧职责：

- `switch(slot)` 手动调用 `provider.getInfo/getTags/...`
- 直接持有 slot-by-slot fetch 分支
- 手动实现 first/enrich 分支执行模型

新的 handler 应该变成轻量 orchestrator：

```ts
async scrape(profileId, lookup) {
  const profile = await this.loadAndValidateProfile(profileId)
  const plan = buildExecutionPlan(profile, this.registry)
  const results = await executePlan({
    plan,
    lookup,
    profile,
    registry: this.registry,
    media: 'game'
  })
  return mergeGameScraperBundle(results, profile)
}
```

### 9.2 `provider.ts`

每个 media 继续维护自己的强类型 provider 契约。

职责：

- 定义 `ResolvedTarget`
- 定义 `SessionResultMap`
- 定义 `Session`
- 定义 `Provider`

不要把这些类型推回 shared 层。它们属于 main process provider runtime contract，不需要 renderer 依赖。

### 9.3 `types.ts`

每个 media 的 `types.ts` 继续保留，但内容应改成：

- internal result union
- `ResolvedTarget`、`SessionResultMap` 辅助类型
- image slot alias
- executor 与 merge 之间的数据桥接类型

建议将基础 `SlotResult` 扩展为：

```ts
type SlotResult<S extends string, D> = {
  slot: S
  providerId: string
  priority: number
  data: D
}
```

增加 `providerId` 的原因：

- 调试日志更清晰。
- merge 之外的诊断与测试更容易断言来源。
- 后续如果做 provider 级 trace，不需要再改类型。

### 9.4 `merge.ts`

merge 保持纯函数，不参与本次抽象上移。

唯一需要确保的是：

- merge 输入仍然是标准化的 slot result 列表。
- `first / enrich / unmatchedEntityPolicy` 语义继续只由 profile 决定。
- merge 不接触 provider session 或 invocation state。

## 10. 统一执行模型

### 10.1 搜索与抓取分离

`search(query)` 的语义不变：

- 仍由 `searchProviderId` 指向的 provider 提供 UI 搜索候选。
- search 结果仍会写入 provider 自身 `externalIds`。

`scrape(lookup)` 的语义变为：

- 先 resolve，再 session 化抓取，再 merge。

`search` 负责“给用户选对象”，`resolve` 负责“给执行器拿目标”。

### 10.2 first wave

first wave 的目标不是“只跑 first slots”，而是：

- 用最小必要 provider task 建立首批有效结果。
- 尽早满足 `first` slots。
- 同时顺带收集这些 provider 已经能提供的 enrich 结果。

first wave 仍然必须遵守 slot provider priority：

- executor 以 planner 生成的 `rank` 为顺序推进。
- 同一 `rank` 内可并行。
- 只有当前 rank 完成后，才进入下一个 rank。

因此 first wave 中，一个 provider task 可能同时服务：

- `info(first)`
- `tags(enrich)`
- `covers(first)`

只要它们都来自同一 provider 且同一阶段需要，就应合并成一次 session 交互。

### 10.3 enrich wave

enrich wave 只做一件事：

- 对 first wave 之后仍需补齐的 enrich provider task 继续取数。

它不再是另一套执行模型，只是同一执行器的第二阶段。

### 10.4 为什么这能统一 `first / enrich`

统一后的规则很简单：

- planner 决定“什么时候需要哪个 provider 的哪些 slots”。
- executor 永远只做“resolve -> session.get -> validate -> collect”。
- slot state 决定“这个结果是否还能继续接收后续 provider”。

这样：

- `first` 只是一种更早关闭的 slot state。
- `enrich` 只是一种始终接受追加结果的 slot state。

## 11. provider session 设计细则

### 11.1 Session 生命周期

session 生命周期严格限定在单次 invocation 内：

- `scrape` 调用开始时创建 state。
- 首次需要某 provider target 时才 `openSession`。
- invocation 结束时统一 `dispose`。

不允许：

- handler 级持久 session。
- 跨 profile 共享 session。
- 跨 invocation 共享 session。

### 11.2 Session 内部缓存粒度

session 应按“资源组”缓存，而不是按 slot 缓存。

示例：

- Bangumi game session
  - `subject`
  - `subjectPersons`
  - `subjectCharacters`
  - `personDetails`
  - `characterDetails`
- VNDB game session
  - `vnCore`
  - `vnRelations`
  - `schema`
  - `staffMap`
  - `producerMap`
  - `traitMap`

理由：

- slot 是宿主语义，不是 provider 资源语义。
- 资源组缓存可以自然承载“同源数据供多个 slot 使用”。
- 当 provider 以后新增 slot 时，不需要重建整个缓存模型。

### 11.3 Session 的 Promise 去重要求

session 中每个资源组都应缓存 promise，而不是缓存 resolved value 后再拼并发锁。

推荐写法：

```ts
private subjectTask?: Promise<BangumiSubject>

private getSubject(): Promise<BangumiSubject> {
  if (!this.subjectTask) {
    this.subjectTask = this.client.getSubjectById(this.target.id)
  }
  return this.subjectTask
}
```

这样可以天然保证：

- 并发 slot 请求只打一次上游。
- 后续 slot 重复读取时不再触发第二次网络请求。

### 11.4 Session 允许分层缓存

provider session 可以同时维护：

- 原始 API payload cache
- 转换后的 normalized payload cache
- 局部索引 map

示例：

- 原始 payload：`subject`, `personDetail`, `schema`
- 转换后 payload：`tags`, `persons`, `companies`
- 局部索引：`staffMap`, `traitMap`, `producerRelationMap`

只要外部接口仍然是 `get(slots)`，内部实现可以自由组织。

## 12. `getProviderImages` 的处理方式

当前 `getProviderImages` 基本上是独立复制了一套：

- resolve
- provider capability 判断
- provider image method 调用

重构后不应再保留第二套执行链。

建议处理为：

1. media handler 构造一个只包含单 image slot、单 provider 的临时 execution request。
2. 复用相同的 resolve/state/session/executor。
3. 直接读取结果列表并按 media-specific image merge 返回。

这样能保证：

- 单槽图片抓取与完整 scrape 共享同一 session 模型。
- 任何 provider 的图片资源复用逻辑只写一次。
- 后续如果图片 slot 也要支持 enrich/first 混合，不需要再开新分支。

## 13. profile 与配置语义

### 13.1 保留的配置模型

以下语义保持不变：

- `searchProviderId` 指定 UI 搜索入口 provider。
- `slotConfigs[slot].providers` 指定该 slot 的 provider 优先级。
- `slotConfigs[slot].strategy` 指定 `first / enrich`。
- relation collection 的 `unmatchedEntityPolicy` 继续只影响 merge。

### 13.2 planner 对配置的解释规则

planner 必须遵循以下规则：

- 只处理当前 media 的 slots。
- 只保留已注册且 capability 合法的 provider。
- provider entry 仍按 `priority` 归一化后排序。
- slot fetch locale 优先级仍为：
  - `entry.locale`
  - `profile.defaultLocale`
  - `i18n current locale`

### 13.3 `searchProviderId` 的特殊地位

即使某个 slot 完全不使用 `searchProviderId`，它仍然在执行模型中有特殊作用：

- 它是 UI 搜索入口。
- 它是 canonical resolve name 的首要来源。
- 它是最早被 resolve 的 provider。

这层语义需要保留，不应被 planner 当作普通 slot provider 对待。

## 14. 重构后的文件职责细化

### 14.1 `apps/desktop/src/main/services/scraper/service.ts`

保留职责：

- service 生命周期。
- builtin provider 注册。
- IPC handler 暴露。

需要调整：

- 初始化时构造统一 `ScraperProviderDeps`。
- provider 注册改为交给各 media registry。
- service 不关心 session、plan、state 细节。

### 14.2 `apps/desktop/src/main/services/scraper/types.ts`

建议保留为 main-only 通用内部类型容器，可承载：

- 通用 `SlotResult`
- 通用 `ExecutionContext`
- 通用 `CollectedResults`

shared renderer 不应依赖这里的 runtime 执行细节。

### 14.3 `apps/desktop/src/shared/scraper/*`

只保留真正跨层共享的纯类型与 helper：

- slot config
- bundle
- search result
- provider info
- lookup

不要把 session、executor plan、state 等运行时实现细节放进 shared。

## 15. 实施计划

本次重构不考虑向后兼容，但实现上仍建议按下面顺序推进，便于控制复杂度。

### 阶段 1：拆 common 基础设施

目标：

- 删除 `handlers/common.ts` 的单文件堆叠。
- 先把现有职责拆入 `registry.ts / resolve.ts / state.ts / planner.ts / executor.ts` 的目标位置。

任务：

- 抽离 provider contract 校验到 `registry.ts`。
- 抽离 slot config 清洗与 provider entry 过滤逻辑。
- 抽离 resolve cache 到 `state.ts + resolve.ts`。
- 先保留旧 handler 行为，但让新文件骨架就位。

完成标志：

- `common.ts` 不再新增职责。
- 新 common 目录具备最小可编译骨架。

### 阶段 2：重定义 media provider 契约

目标：

- 在 `game/person/company/character/provider.ts` 中切换到 `search + resolve + openSession + session.get`。

任务：

- 为每个 media 定义 `ResolvedTarget`。
- 为每个 media 定义 `SessionResultMap`。
- 为每个 media 定义 `Session` 接口。
- 更新 contract validation，要求 `search / resolve / openSession` 为必选。

完成标志：

- 仓库中不再存在新的 `getInfo/getTags/...` provider contract。
- 所有内置 provider 编译错误暴露出来，进入迁移阶段。

### 阶段 3：先迁移 game 执行链

优先 game，因为它的 slot 最多、共享资源最复杂、最能验证模型。

任务：

- 重写 `game/handler.ts`，改为 planner + executor + merge。
- 重写 `game/types.ts`，补齐 session 与 result 类型。
- 迁移 Bangumi / VNDB / IGDB / Ymgal provider。
- 用 game 的 `getProviderImages` 验证单槽执行路径复用。

完成标志：

- game scrape 全量跑通。
- 同一 provider 在一次 game scrape 内不会因多个 slot 重复打同一资源组。

### 阶段 4：迁移 person / company / character

任务：

- 对三类 media 复用同一套 common 执行基础设施。
- 每个 handler 只保留 profile + merge + registry facade。
- 每个 media 独立定义自身 `SessionResultMap`。

完成标志：

- 四类 media 全部切到统一执行模型。
- 旧 slot-by-slot fetch 代码全部删除。

### 阶段 5：收敛 service 与辅助接口

任务：

- 清理 `service.ts` 中对旧 provider 方法的隐式依赖。
- 把 `getProviderImages` 全部改造成基于统一执行器。
- 更新插件接入文档与 provider 示例。

完成标志：

- 外部 IPC 不变，内部只有一条执行链。

### 阶段 6：删除遗留

任务：

- 删除旧 fetch helper、旧 common 文件、旧 provider 方法实现。
- 清理不再需要的 `switch(slot)` 分支。

完成标志：

- 仓库内不存在旧执行模型残留。

## 16. 验收标准

满足以下条件即可认为重构完成：

- 四类 media handler 都基于 `planner + resolve + executor + merge`。
- provider 全部切到 `search + resolve + openSession + session.get`。
- `handlers/common.ts` 被拆分并删除。
- 同一 provider 在一次 invocation 内不会因多个 slot 重复请求同一资源组。
- `scrape` 与 `getProviderImages` 共用同一执行链。
- merge 仍然保持 media-specific 且不依赖 provider runtime。
- profile 配置模型不变。
- 不存在任何旧接口兼容代码。

## 17. 风险与控制

### 18.1 风险：common 层被抽成过度泛型

控制策略：

- common 只抽“执行基础设施”，不抽 merge 语义。
- media-specific 的 payload map、target、result union 全留在各自目录。

### 17.2 风险：session 与 payload cache 责任重叠

控制策略：

- 宿主 cache 表达“本 invocation 是否已请求过某 slot”。
- session cache 表达“provider 内部如何复用资源组”。
- 两层职责分开，不互相替代。

### 17.3 风险：provider 迁移成本高

控制策略：

- 接口一次切换，不做兼容层。
- 先以 game 为模板沉淀模式，再批量迁移其他 media。
- 每个 provider 都按“资源组缓存”重写，而不是机械把旧方法包一层 session。

### 17.4 风险：first wave 规划过于激进

控制策略：

- planner 只做静态折叠，不做复杂启发式优化。
- 首版优先保证正确性与复用，避免引入难解释的调度策略。

## 18. 最终结论

这次重构的本质不是“把几个方法改名”，而是把 scraper 的中心从“slot 驱动 provider 方法”切换为“plan 驱动 provider session”。

重构完成后：

- media 分层和强类型体系完整保留。
- 配置模型与 merge 语义完整保留。
- `first / enrich` 进入统一执行框架。
- provider 获得对自身资源拓扑、请求顺序、缓存边界的完整控制权。
- 同一 provider 因多个 slot 被重复请求的问题从架构层被消除。

这是一个值得一次性完成的 clean break，也与当前仓库处于早期阶段、允许彻底重构的状态完全一致。
