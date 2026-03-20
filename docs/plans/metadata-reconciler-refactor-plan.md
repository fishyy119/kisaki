# Metadata Reconciler 重构方案

## 目标

将 metadata update 重构为主进程优先的 `services/reconciler` 单体流程。

- `ingest` 只负责新实体创建和 add-from-scraper。
- `reconciler` 只负责既有根实体的单体 metadata sync。
- batch 继续留在 renderer 编排，不把批处理决策迁入 main。
- 最终状态不保留 `metadata-updater`、旧 updater IPC，也不保留 renderer 侧 metadata patch 组装逻辑。
- 为了保证分阶段实施期间分支可编译，实施阶段允许旧实现与新实现短暂并存。
  这只是阶段性过渡，不代表最终会保留兼容层。
- 完整完成不考虑任何向后兼容，保持干净清晰。

## 目标状态

1. Renderer 单体流程负责收集输入、执行 search、让用户选择目标结果，并发起一次 reconcile 请求。
2. Main 单体 reconcile pipeline 固定为 `scrape bundle -> incoming -> current -> plan -> apply -> post-commit asset flush`。
3. Batch dialog 继续由 renderer 本地编排；每个条目复用同一套单体 reconcile IPC。
4. Main 只暴露单体 reconcile IPC，不引入 batch coordinator、batch IPC 或进度事件。
5. `metadata-updater` 被彻底删除。
6. `ingest` 保持功能不变。

## 冻结决策

- `ReconcilerService` 不负责 search。
- `ReconcilerService` 不负责 batch。
- 单体 reconcile 直接接收 renderer 已确定的 lookup。
- batch 不新增 main 侧 coordinator、batch IPC、batch progress event 或 batch result contract。
- batch 在 renderer 中本地循环执行 `search -> reconcile` 或 `lookup -> reconcile`，按实体类型复用单体 reconcile IPC。
- 每次 reconcile 都先执行一次 `ScraperService.scrape()`，再在 `services/reconciler/incoming` 中完成 bundle -> incoming 转换。
- `selection` 只影响 `current` 加载和 `plan` 生成，不影响 scrape 覆盖范围。
- `ScraperService` 保持现有 search/scrape bundle 边界，不感知 reconciler 内部 incoming 类型。
- `reconciler` 的公共协议不暴露 scraper slot 名称。
- `singularUpdate` 只支持 `ifMissing` 和 `overwrite`。
- `collectionUpdate` 只支持 `merge` 和 `replace`。
- `replace` 固定表示“只有存在可用 incoming 时才执行替换”；incoming 为空时一律 no-op。
- 资源附件统一在数据库事务提交后执行 flush。
- asset flush 失败只记日志，不回滚已提交的数据库变更，也不为 renderer 设计额外的进度 / warning 事件。
- 单体 reconcile IPC 只返回标准 success / error，不额外设计结构化 reconcile result。

## 关联实体匹配

`externalIds only` 不是 `merge` 策略，而是 reconciler 的 DB 复用策略。

- `ScraperService` 可以继续保留当前基于归一化 alias key 的 provider 结果合并行为。
  该层仍可按 `externalIds + originalName/name`，必要时再结合 relation type 做归并。
- `Reconciler` 不会按名称复用数据库中已有实体。
- Reconciler 在 DB 层只按归一化后的 external IDs 复用既有实体。
- incoming 关联实体如果没有 external IDs，不会按名称去命中已有 DB 实体。

这样可以保持 scraper 侧的归一化能力不变，同时避免在 DB 复用阶段引入高风险的名称误命中。

## 范围概览

- 新增 `apps/desktop/src/shared/reconciler.ts`。
- 新增 `apps/desktop/src/main/services/reconciler/`。
- 为 `game`、`character`、`person`、`company` 增加单体 reconcile IPC。
- 将四类单体 metadata update dialog 迁移到 `reconciler`。
- 将四类 batch metadata update dialog 迁移为 renderer 本地 `search/lookup -> reconcile` 编排。
- 在 cutover 阶段删除 `metadata-updater`、旧 updater shared contract、旧 updater IPC 以及 renderer updater helper。

## 非目标

- 不重写 `services/ingest`。
- 不为 `ingest` 和 `reconciler` 设计共享抽象层。
- 不设计 batch IPC、batch event、batch result contract。
- 当前这轮重构不补自动化测试，原因是当前项目尚未建立可复用的测试框架。
- 本次不扩展 `person` 和 `company` 的关系同步能力。

## 文档索引

- [协议与职责边界](./metadata-reconciler-refactor/01-contracts-and-boundaries.md)
- [Reconcile 语义规则](./metadata-reconciler-refactor/02-semantics.md)
- [Renderer 迁移范围](./metadata-reconciler-refactor/03-renderer-migration.md)
- [实施阶段](./metadata-reconciler-refactor/04-phases.md)
- [清理与验证](./metadata-reconciler-refactor/05-cleanup-and-validation.md)
