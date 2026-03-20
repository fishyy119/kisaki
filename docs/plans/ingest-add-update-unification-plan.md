# Ingest Add/Update 一体化重构方案

## 目标

将当前分散在 `services/ingest` 与 `services/reconciler` 中的写入逻辑合并为单一 `ingest` 服务。

- `ingest` 成为唯一的 metadata 写入服务。
- `add` 负责新根实体创建。
- `update` 负责既有根实体的 metadata 同步。
- `graph`、`persist`、`assets` 成为 `ingest` 内部共享内核。
- 本次重构不考虑任何向后兼容，直接删除旧的 `reconciler` 服务、旧 IPC、旧 shared contract 与旧 renderer helper。

本次重构的核心不是“把 reconciler 挪个目录”，而是重新定义 `ingest` 的语义边界：
`ingest` 不再表示“仅新增导入”，而表示“外部事实进入本地库的所有写入流程”。

## 问题判断

当前架构混乱的根因不是服务数量，而是共享内核被错误地挂在了 `ingest` 私有目录下：

- `reconciler` 直接依赖 `ingest/transforms/*`
- `reconciler` 直接依赖 `ingest/persist/*`
- `reconciler` 的 plan 类型直接依赖 `@shared/ingest` 图模型
- asset flush 在 `ingest` 和 `reconciler` 中重复实现

这导致当前代码在概念上是“两套服务”，在实现上却是“一套半共享内核”，边界天然会继续塌陷。

## 最终状态

### 服务边界

- 只保留 `IngestService`
- 删除 `ReconcilerService`
- `ScannerService` 继续只依赖 `ingest`
- renderer 中所有 metadata update 入口统一改为 `ingest:update-*`
- renderer 中所有新增入口继续走 `ingest:add-*`

### 最终目录结构

```text
apps/desktop/src/main/services/ingest/
  service.ts
  index.ts
  add/
    index.ts
    common.ts
    game.ts
    person.ts
    company.ts
    character.ts
  update/
    index.ts
    common.ts
    game.ts
    person.ts
    company.ts
    character.ts
    incoming/
      index.ts
      game.ts
      person.ts
      company.ts
      character.ts
    current/
      index.ts
      game.ts
      person.ts
      company.ts
      character.ts
    plan/
      index.ts
      game.ts
      person.ts
      company.ts
      character.ts
    apply/
      index.ts
      game.ts
      person.ts
      company.ts
      character.ts
      relations.ts
    types.ts
    utils.ts
  graph/
    index.ts
    common.ts
    types.ts
    game.ts
    person.ts
    company.ts
    character.ts
  persist/
    index.ts
    types.ts
    game.ts
    person.ts
    company.ts
    character.ts
  assets/
    index.ts
    types.ts
    flush.ts
```

### 依赖规则

- `service.ts` 只负责 DI、实例装配、IPC 注册，不承载业务逻辑。
- `add/` 与 `update/` 是同级用例层，禁止互相 import。
- `graph/` 是纯构图层，只负责输入归一化与图构建，不访问 DB，不感知 IPC。
- `persist/` 是纯持久化层，只负责节点、关系、tag、external ID 的落库，不感知 renderer selection，也不感知 IPC。
- `assets/` 是唯一的事务后资源落地层，只保留一套 `PendingAssetTask` 和 flush 逻辑。
- `update/` 独占 `incoming -> current -> plan -> apply` pipeline，不把 selection/policy 逻辑下沉到 `persist/`。
- `@shared/ingest` 只暴露 IPC contract 与稳定结果类型，不再暴露内部 normalized graph。

## 命名与协议冻结

### 服务语义

- 保留服务 ID：`ingest`
- 删除服务 ID：`reconciler`

### IPC 命名

保留：

- `ingest:add-game-direct`
- `ingest:add-game-from-scraper`
- `ingest:add-person-from-scraper`
- `ingest:add-company-from-scraper`
- `ingest:add-character-from-scraper`

新增并替换旧 reconciler IPC：

- `ingest:update-game-from-scraper`
- `ingest:update-person-from-scraper`
- `ingest:update-company-from-scraper`
- `ingest:update-character-from-scraper`

直接删除：

- `reconciler:reconcile-game-from-scraper`
- `reconciler:reconcile-person-from-scraper`
- `reconciler:reconcile-company-from-scraper`
- `reconciler:reconcile-character-from-scraper`

### Shared contract 组织

```text
apps/desktop/src/shared/ingest/
  index.ts
  common.ts
  add/
    index.ts
    game.ts
    person.ts
    company.ts
    character.ts
  update/
    index.ts
    common.ts
    game.ts
    person.ts
    company.ts
    character.ts
```

冻结规则：

- `shared/ingest/common.ts` 只保留 warning、通用 result、共享输入类型。
- `shared/ingest/add/*` 只保留新增流程的 request/result/options。
- `shared/ingest/update/*` 只保留更新流程的 lookup/policy/selection/request。
- 删除 `apps/desktop/src/shared/reconciler.ts`。
- 删除 `@shared/ingest` 中一切仅供 main 内部使用的 normalized graph 类型。

## 目标服务 API

`IngestService` 在主进程内部暴露两组子能力：

```ts
ingest.add.game.fromScraper(...)
ingest.add.game.direct(...)
ingest.add.person.fromScraper(...)
ingest.add.company.fromScraper(...)
ingest.add.character.fromScraper(...)

ingest.update.game.fromScraper(...)
ingest.update.person.fromScraper(...)
ingest.update.company.fromScraper(...)
ingest.update.character.fromScraper(...)
```

这样可以保持单一 service，同时明确区分“新增”与“更新”两类用例。

## 流程设计

### Add 流程

#### Add from scraper

`validate input -> resolve existing root -> scrape -> build graph -> persist -> flush assets -> return result`

语义规则：

- `game` 继续支持按 `path` 优先判重，再按 `externalIds` 判重。
- `person`、`company`、`character` 继续按 `externalIds` 判重。
- 已命中既有实体时直接返回 add result，不进入 graph/persist。
- `graph/` 负责 bundle -> normalized graph。
- `persist/` 负责 graph -> DB。
- `assets/flush` 在事务提交后执行。

#### Add direct

`validate input -> resolve existing root -> build graph from seed -> persist -> flush assets -> return result`

语义规则：

- direct add 仅用于当前支持的 `game` 流程。
- direct add 与 scraper add 共用同一套 graph 类型和 persist 写库逻辑。

### Update 流程

`validate request -> normalize lookup/selection/policy -> scrape -> build incoming -> build relation graph if needed -> load current -> build plan -> apply -> flush assets`

语义规则：

- `update` 只处理既有根实体，`rootId` 必填。
- `selection` 只影响 `current` 读取与 `plan` 生成，不影响 scrape 覆盖范围。
- 仅在选中了 relation surfaces 时构建 relation graph。
- `update` 在 DB 复用层只按 `externalIds` 复用关联实体，不按名称命中现有实体。
- `replace` 表示“只有 incoming 可用时才替换”；incoming 为空一律 no-op。
- `assets/flush` 失败只记日志，不回滚已提交事务。

## 内部模型重构

### Graph 内部模型

当前 `@shared/ingest` 下的 `IngestGameGraph`、`IngestCharacterGraph` 等 normalized graph 类型从 shared 层移出，迁入：

```text
apps/desktop/src/main/services/ingest/graph/types.ts
```

原因：

- 这些类型只被 main 内部的 `graph/`、`persist/`、`update/apply` 使用
- renderer 和 IPC contract 不应该感知写入内部图模型
- 这可以显著缩小 `@shared/ingest` 的公开表面积，减少插件类型污染

### Asset 任务模型

当前 `PendingAssetTask` 与 flush 逻辑拆散在 `ingest/persist/types.ts` 与 `reconciler/utils.ts`，重构后统一为：

```text
apps/desktop/src/main/services/ingest/assets/types.ts
apps/desktop/src/main/services/ingest/assets/flush.ts
```

冻结规则：

- `PendingAssetTask` 只定义一次
- add 与 update 都返回统一的 pending asset tasks
- 所有事务后资源写入都统一走 `assets/flush`

## 现有模块迁移映射

### Main service 层

- `apps/desktop/src/main/services/ingest/handlers/*` -> `apps/desktop/src/main/services/ingest/add/*`
- `apps/desktop/src/main/services/ingest/transforms/*` -> `apps/desktop/src/main/services/ingest/graph/*`
- `apps/desktop/src/main/services/ingest/persist/*` -> 保留在 `apps/desktop/src/main/services/ingest/persist/*`
- `apps/desktop/src/main/services/reconciler/service.ts` -> 删除，能力并入 `apps/desktop/src/main/services/ingest/service.ts`
- `apps/desktop/src/main/services/reconciler/handlers/*` -> `apps/desktop/src/main/services/ingest/update/*`
- `apps/desktop/src/main/services/reconciler/incoming/*` -> `apps/desktop/src/main/services/ingest/update/incoming/*`
- `apps/desktop/src/main/services/reconciler/current/*` -> `apps/desktop/src/main/services/ingest/update/current/*`
- `apps/desktop/src/main/services/reconciler/plan/*` -> `apps/desktop/src/main/services/ingest/update/plan/*`
- `apps/desktop/src/main/services/reconciler/apply/*` -> `apps/desktop/src/main/services/ingest/update/apply/*`
- `apps/desktop/src/main/services/reconciler/types.ts` -> `apps/desktop/src/main/services/ingest/update/types.ts`
- `apps/desktop/src/main/services/reconciler/utils.ts` -> `apps/desktop/src/main/services/ingest/update/utils.ts`，其中 asset flush 相关内容迁入 `assets/`

### Shared contract 层

- `apps/desktop/src/shared/reconciler.ts` -> 删除
- `apps/desktop/src/shared/ingest/game.ts` 中 graph 类型定义 -> 移出 shared，保留 add/update IPC contract
- `apps/desktop/src/shared/ingest/person.ts`、`company.ts`、`character.ts` -> 拆分到 `add/` 与 `update/`
- `apps/desktop/src/shared/ipc.ts` 中 `reconciler:*` -> 改为 `ingest:update-*`

### Renderer 层

- 所有 metadata update dialog 从 `@shared/reconciler` 切到 `@shared/ingest/update`
- 所有 metadata update invoke 从 `reconciler:*` 切到 `ingest:update-*`
- `apps/desktop/src/renderer/src/utils/reconciler.ts` -> 重命名为 `apps/desktop/src/renderer/src/utils/ingest-update.ts`，或直接并入对应 dialog 层 helper

### Container / Bootstrap / Generated types

- `apps/desktop/src/main/index.ts` 删除 `ReconcilerService` 注册
- `apps/desktop/src/main/container/types.ts` 删除 `reconciler` registry 项
- `apps/desktop/plugin-types/*` 与 `packages/plugin-sdk/src/types/*` 统一通过 `pnpm build:plugin-tooling` 重新生成

## 分阶段实施计划

### Phase 1: 冻结命名与切线

目标：

- 确定 `ingest` 为唯一写入服务
- 确定 `add/update/graph/persist/assets` 为最终目录结构
- 确定 `reconciler:* -> ingest:update-*` 的 IPC 切换

产出：

- 新计划文档落地
- 不再向 `services/reconciler` 引入任何新代码
- 不再向 `@shared/reconciler` 引入任何新依赖

### Phase 2: 建立 ingest 新骨架

目标：

- 在不改变外部行为的前提下建立 `add/`、`update/`、`graph/`、`assets/`

动作：

- 新建 `apps/desktop/src/main/services/ingest/add/`
- 新建 `apps/desktop/src/main/services/ingest/update/`
- 新建 `apps/desktop/src/main/services/ingest/graph/`
- 新建 `apps/desktop/src/main/services/ingest/assets/`
- 调整 `apps/desktop/src/main/services/ingest/index.ts` 出口

完成标准：

- 新目录存在且可编译
- 旧代码尚可暂存，但新代码不再使用 `transforms` 这一命名

### Phase 3: 迁移 add 流程

目标：

- 将现有新增流程重命名并收口到 `add/ + graph/ + persist/ + assets/`

动作：

- 将 `handlers/*` 迁移到 `add/*`
- 将 `transforms/*` 迁移到 `graph/*`
- 将 `PendingAssetTask` 与 flush 从 `persist/types.ts` 中拆出
- 让 `IngestService` 通过 `this.add.*` 暴露新增能力
- 修正 `ScannerService` 对 ingest 的内部调用方式

完成标准：

- 不再存在 `services/ingest/handlers/`
- 不再存在 `services/ingest/transforms/`
- scanner 仍然只依赖 `ingest`

### Phase 4: 迁移 update 流程

目标：

- 将现有 `reconciler` 完整迁入 `ingest/update/`

动作：

- 迁移 `reconciler` 的 `incoming/current/plan/apply/types/utils`
- 将 `reconciler` 对 `ingest/transforms` 的依赖改为 `ingest/graph`
- 将 `reconciler` 对 `IngestPersistHandlers` 的依赖改为 `ingest/persist`
- 将 `reconciler` 的 asset flush 改为 `ingest/assets`
- 将 `IngestService` 通过 `this.update.*` 暴露更新能力

完成标准：

- `update` 能独立完成现有 reconcile pipeline
- `services/reconciler` 中不再承载任何唯一业务逻辑

### Phase 5: 切 shared contract 与 renderer

目标：

- 删除 `@shared/reconciler`，改用 `@shared/ingest/update`

动作：

- 新建 `apps/desktop/src/shared/ingest/update/*`
- 重构 `apps/desktop/src/shared/ingest/*` 出口
- 更新 `apps/desktop/src/shared/ipc.ts`
- 更新四类单体 metadata update dialog
- 更新四类 batch metadata update dialog
- 更新 renderer 本地 helper 与类型引用

完成标准：

- 代码库中不存在 `@shared/reconciler`
- 代码库中不存在 `reconciler:` IPC 调用

### Phase 6: 删除旧模块并收口入口

目标：

- 完成最终 cutover，删除旧服务与死代码

动作：

- 删除 `apps/desktop/src/main/services/reconciler/`
- 删除 `apps/desktop/src/shared/reconciler.ts`
- 从 `apps/desktop/src/main/index.ts` 删除 `ReconcilerService`
- 从 `apps/desktop/src/main/container/types.ts` 删除 `reconciler`
- 清理旧导出、旧 helper、旧注释与旧命名

完成标准：

- 代码库中不存在 `services/reconciler/`
- `IngestService` 成为唯一 metadata 写入服务

### Phase 7: 生成类型并完成验证

目标：

- 确保所有 contract、主进程装配与 renderer 调用一致

动作：

- 运行 `pnpm build:plugin-tooling`
- 运行 `pnpm typecheck`
- 运行 `pnpm lint`
- 手工验证 add / update / scanner 关键路径

完成标准：

- 类型生成无差异或仅有预期差异
- 类型检查通过
- lint 通过
- 手工冒烟通过

## 手工验证矩阵

### Add

- `game` direct add 可正常创建新实体
- `game` scraper add 可正常创建新实体
- `person` scraper add 可正常创建新实体
- `company` scraper add 可正常创建新实体
- `character` scraper add 可正常创建新实体
- `game` path 判重仍然有效
- `externalId` 判重仍然有效

### Update

- `game` 单体 metadata update 可正常执行
- `person` 单体 metadata update 可正常执行
- `company` 单体 metadata update 可正常执行
- `character` 单体 metadata update 可正常执行
- 四类 batch metadata update 可通过 renderer 本地循环正常执行
- `ifMissing` / `overwrite` 语义正确
- `merge` / `replace` 语义正确
- relation surfaces 未选中时不会构建和写入关系图

### Shared / IPC / Service

- `shared/ipc.ts` 中不存在 `reconciler:*`
- plugin type 生成结果中不存在 `reconciler:reconcile-*`
- `ServiceRegistry` 中不存在 `reconciler`
- 主进程启动时只注册 `IngestService` 作为 metadata 写入服务

## 最终清理标准

代码库完成重构后，应同时满足以下条件：

- 不存在 `apps/desktop/src/main/services/reconciler/`
- 不存在 `apps/desktop/src/shared/reconciler.ts`
- 不存在 `@shared/reconciler` import
- 不存在 `reconciler:` IPC channel
- 不存在 `services/ingest/handlers/`
- 不存在 `services/ingest/transforms/`
- 不存在重复的 asset flush 实现
- `@shared/ingest` 不再暴露仅供 main 使用的 graph 类型
- 所有新增流程统一位于 `ingest/add`
- 所有更新流程统一位于 `ingest/update`
- 所有 shared contract 统一归于 `@shared/ingest`

## 非目标

- 不重写 `ScraperService`
- 不改变 batch 仍由 renderer 本地编排这一原则
- 不为 update 新增 batch coordinator、batch IPC 或 batch progress event
- 不改变 scanner ingest mode 的产品语义
- 不扩展新的 metadata surface 或新的关系类型
- 不在本次重构中引入新的测试框架

## 执行结论

本方案的关键不是保留两套服务再“轻度解耦”，而是承认 `add` 与 `update` 本质上共享同一个写入域，并将其彻底收口到单一 `ingest` 服务下。

完成后，代码结构会从“服务边界虚分、内部实现偷用”转变为“单一服务、双用例层、共享内核明确”，这是当前仓库下最干净、最彻底、也最符合后续演进方向的重构方案。
