# 清理与验证

## 删除清单

以下内容只在 cutover 阶段删除，不提前处理：

- `apps/desktop/src/main/services/metadata-updater/index.ts`
- `apps/desktop/src/main/services/metadata-updater/service.ts`
- `apps/desktop/src/main/services/metadata-updater/types.ts`
- `apps/desktop/src/main/services/metadata-updater/utils.ts`
- `apps/desktop/src/main/services/metadata-updater/handlers/*`
- `apps/desktop/src/shared/metadata-updater.ts`
- `apps/desktop/src/renderer/src/utils/metadata-updater.ts`
- `apps/desktop/src/shared/ipc.ts` 中的 updater IPC 声明
- main container 和 bootstrap 中 updater service 的注册与类型映射
- 只为旧 updater payload 组装存在的 dialog helper
- renderer 侧 batch 的旧 `search/scrape/update` 循环逻辑

## 本轮重构的验证策略

当前决策：这轮重构不新增自动化测试。

原因：

- 当前项目尚未建立可复用的测试框架。

验证要求收敛为：

- `pnpm typecheck`
- `pnpm --filter kisaki build:plugin-types`
- 当最终代码改动面足够大时执行 `pnpm lint`

## 手工验证关注点

只在实施过程中按需做聚焦验证：

- 单体 dialog 最终只发送一次 reconcile IPC
- 单体 dialog 不再直接调用 `scraper:scrape-*`
- batch dialog 在 renderer 本地循环调用单体 reconcile IPC
- batch dialog 不再直接调用 `scraper:scrape-*`
- batch dialog 不再直接调用 `metadata-updater:update-*`
- 代码库中不存在 `reconciler:batch-*` 或 `reconciler:batch-progress`
- cutover 后旧 updater 路径已全部移除
- `ingest` 在 reconciler 迁移后仍然可用

## 延后处理的事项

以下内容明确延后：

- 新的自动化测试覆盖
- 更完整的 smoke 测试矩阵
- 面向 scraper / reconcile 流程的测试基建补齐
