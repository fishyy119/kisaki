# 实施阶段

## Phase 0：冻结并整理文档

目标：

- 冻结规则、边界和语义。
- 将超长计划拆成聚焦的专题文档。

完成条件：

- 总览和专题文件已就位。
- renderer 改造范围被明确写出。
- batch 保持 renderer 编排的方向已经明确写出。
- 关联实体匹配规则已经明确区分 scraper merge 与 DB reuse。

## Phase 1：基础设施铺设

目标：

- 建立新的 shared contract、单体 reconcile IPC、reconciler 骨架，以及 bundle -> incoming 边界。

工作项：

- 新增 `apps/desktop/src/shared/reconciler.ts`
- 新增单体 reconcile IPC 类型
- 新增 `services/reconciler` 骨架并完成 container 注册
- 在 `services/reconciler/incoming` 中建立 `Scraped*Bundle -> incoming` 转换骨架

约束：

- 此阶段不删除旧 updater contract，也不删除旧 dialog。
- 此阶段不设计 batch IPC 或 batch progress event。
- 在新流程未完整落地前，始终保证分支可编译。

完成条件：

- 新 shared contract 可以通过编译。
- Reconciler incoming 模块能够消费四类实体的现有 scraper bundle。
- `ReconcilerService` 已注册，即使内部实现仍然不完整。

## Phase 2：`person` 和 `company` 单体 reconcile

目标：

- 先落地最小可用的纵向切片。

工作项：

- 实现 `person` 单体 reconcile
- 实现 `company` 单体 reconcile
- 迁移 `person` 和 `company` 的单体 dialog

覆盖范围：

- core surfaces
- tags
- external IDs
- media surfaces

完成条件：

- `person` 和 `company` 的单体 dialog 已改为调用 `reconciler`
- 这两个单体 dialog 不再使用旧 updater

## Phase 3：`character` 单体 reconcile

目标：

- 落地第一条带关系同步的 reconcile 流。

工作项：

- 实现 `character` 单体 reconcile
- 实现 `characterPerson`
- 将 `character` 单体 dialog 迁移为显式暴露 `person` surface 的 UI

完成条件：

- `character` 单体 dialog 已使用 `reconciler`
- `characterPerson` 已通过显式 `person` surface 接通

## Phase 4：`game` 单体 reconcile

目标：

- 最后落地耦合度最高、范围最大的单体流程。

工作项：

- 实现 `game` 单体 reconcile
- 实现 `gamePerson`
- 实现 `gameCompany`
- 实现 `gameCharacter`
- 实现 nested `characterPerson`
- 将 `game` 单体 dialog 迁移为完整的 relation-aware UI，并让 nested `characterPerson` 跟随 `gameCharacter`

完成条件：

- `game` 单体 dialog 已使用 `reconciler`
- nested `characterPerson` 已纳入 `game` reconcile 主流程

## Phase 5：Batch Dialog 迁移

目标：

- 保持 batch 在 renderer，本地复用单体 reconcile IPC。

工作项：

- 迁移四类 batch dialog
- 将旧的 `search -> scrape -> update` 替换为 renderer 本地 `search/lookup -> reconcile`
- 在 renderer 中维护本地进度状态
- 删除 batch 中对 `scraper:scrape-*` 和 `metadata-updater:update-*` 的直接依赖

完成条件：

- batch dialog 不再直接调用 `scraper:scrape-*`
- batch dialog 不再直接调用 `metadata-updater:update-*`
- batch dialog 只复用单体 `reconciler:reconcile-*-from-scraper`
- 代码库中不存在 batch reconcile IPC 或 batch progress event

## Phase 6：Cutover 和清理

目标：

- 在所有 dialog 迁移完成后，统一移除旧 updater 栈。

工作项：

- 删除 `metadata-updater` service 和 handlers
- 删除旧 updater shared contract
- 删除旧 updater IPC 声明
- 删除 renderer updater helper
- 删除 container、main bootstrap 和导出中的旧引用

完成条件：

- 代码库中不再存在 `metadata-updater`
- 所有 metadata update 入口都统一走单体 `reconciler`

## Phase 7：最终验证

目标：

- 在不补测试的前提下完成最低限度的收尾验证。

工作项：

- `typecheck`
- 当运行时代码改动面较大时执行 `lint`
- 重建 plugin types
- 在实施过程中按需做聚焦的手工 smoke 验证

备注：

- 此阶段不要求新增自动化测试，因为当前项目尚未建立测试框架。
