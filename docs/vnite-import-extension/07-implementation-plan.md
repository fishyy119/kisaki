# 07 Implementation Plan

本计划按依赖顺序实施。每一步完成后运行窄范围检查，再进入下一步。

## Phase 1: Extension API Contracts

修改：

```text
packages/extension-api/src/capabilities/files.ts
packages/extension-api/src/capabilities/index.ts
packages/extension-api/src/capabilities/library/imports.ts
packages/extension-api/src/capabilities/library/index.ts
packages/extension-api/src/capabilities/ingest.ts
packages/extension-api/src/kisaki.ts
packages/extension-api/src/rpc/capabilities.ts
packages/extension-sdk/src/index.ts
```

内容：

- 定义 `FilesCapability`。
- 定义 `LibraryGameImportPlan` 和结果 DTO。
- 扩展 `IngestCapability`，加入 `game.update.fromScraper`。
- 更新 RPC request/response map。
- 更新 SDK facade。

检查：

```powershell
pnpm --filter @kisaki/extension-api typecheck
pnpm --filter @kisaki/extension-api lint
pnpm --filter @kisaki/extension-sdk typecheck
```

## Phase 2: Host Capability Implementation

修改：

```text
apps/desktop/src/main/services/extension/capabilities/files.ts
apps/desktop/src/main/services/extension/capabilities/gateway.ts
apps/desktop/src/main/services/extension/capabilities/ingest.ts
apps/desktop/src/main/services/extension/capabilities/library/provider.ts
apps/desktop/src/main/services/extension/capabilities/library/imports/
apps/desktop/src/main/services/extension/runtime/host/sdk-bridge/kisaki-api.ts
```

内容：

- `files.openFile` 调 Electron dialog 并复制文件到 extension temp。
- `files.release` 删除 file grant。
- `library.imports.applyGamePlan` 实现 dry-run、匹配、事务写入、附件写入和 diagnostics。
- `ingest.game.update.fromScraper` 转发到 app ingest update。

检查：

```powershell
pnpm --filter kisaki typecheck
pnpm --filter kisaki lint
```

## Phase 3: Built-in Extension Scaffold

新增：

```text
extensions/vnite-importer/
```

更新：

```text
pnpm-workspace.yaml
apps/desktop/scripts/prepare-builtin-extensions.ts
```

内容：

- package、manifest、tsconfig、tsdown。
- 空 `activate`。
- settings panel 注册。
- build tooling 能输出 built-in package。

检查：

```powershell
pnpm --filter @kisaki3/builtin-vnite-importer typecheck
pnpm check:extension-tooling
```

## Phase 4: Backup Reader And Analyzer

实现：

```text
extensions/vnite-importer/src/backup/
extensions/vnite-importer/src/vnite/
```

内容：

- zip 解压和 root detection。
- PouchDB 读取 `game`、`game-local`、`game-collection`。
- 文档 normalization。
- attachment metadata classification。
- analysis summary。

测试：

- 使用合成 PouchDB fixture。
- 使用 `tmp/vnite-database-20260603.zip` 做本地 smoke test，但不要把 94MB 真实备份提交到仓库。

## Phase 5: Mapping And Plan Builder

实现：

```text
extensions/vnite-importer/src/mapping/
extensions/vnite-importer/src/import/planner.ts
```

内容：

- 日期、状态、score、external IDs 映射。
- tags、companies、persons 映射。
- launcher 和 savePath 映射。
- media/memory/save attachment item 构建。
- collection import items。
- diagnostics。

测试：

- 每个 mapper 独立单测。
- 覆盖缺字段、无效日期、未知状态、多 save paths、缺附件。

## Phase 6: Import Executor

实现：

```text
extensions/vnite-importer/src/import/executor.ts
extensions/vnite-importer/src/jobs/import-runner.ts
```

内容：

- 导出 PouchDB attachment 到 temp。
- 调 `kisaki.library.imports.applyGamePlan`。
- 汇总 direct import result。
- 支持 dry-run preview。
- cancellation checkpoint。

测试：

- mock `kisaki.library.imports.applyGamePlan`。
- 验证重复导入时 source id 稳定。

## Phase 7: Metadata Completion

实现：

```text
extensions/vnite-importer/src/completion/
```

内容：

- profile 查询。
- lookup 生成。
- surfaces/policy 生成。
- 顺序调用 `kisaki.ingest.game.update.fromScraper`。
- 单项失败继续。

测试：

- knownIds 不包含 `vnite`。
- 缺 profile 时跳过补全并 warning。
- 单个补全失败不影响 summary。

## Phase 8: Settings Panel UI

实现：

```text
extensions/vnite-importer/src/ui/settings/
```

内容：

- 备份包选择。
- 分析结果。
- 字段选择 dialog。
- 补全设置。
- dry-run 预览。
- 开始导入。
- 高级选项。

检查：

- 文案使用本文档统一术语。
- 长列表使用 table/comparisonList。
- 不在 UI 展示敏感 config。

## Phase 9: Integration Tests

建议测试层：

- extension-api validation tests。
- host import manager unit tests。
- extension mapper unit tests。
- extension reader fixture tests。
- desktop smoke test。

Synthetic fixture 建议：

```text
fixtures/vnite-backup-small/
  game/
  game-local/
  game-collection/
```

Fixture 内容：

- 2 个游戏。
- 1 个已带 external id。
- 1 个带 media attachment。
- 1 个 collection。
- 1 个 timer。
- 1 个 memory。
- 1 个 saveList 但缺 save attachment。

使用脚本生成 fixture，不手写 LevelDB 二进制。测试脚本可用 PouchDB 创建临时数据库并 zip。

## Phase 10: Acceptance

命令：

```powershell
pnpm --filter @kisaki/extension-api typecheck
pnpm --filter @kisaki/extension-sdk typecheck
pnpm --filter @kisaki3/builtin-vnite-importer typecheck
pnpm --filter kisaki typecheck
pnpm check:extension-tooling
```

搜索：

```powershell
rg -n "builtin.vnite-importer|Vnite 导入|vnite.import" extensions apps packages docs
rg -n "capabilities.files.openFile|capabilities.library.imports.applyGamePlan|capabilities.ingest.game.update.fromScraper" packages apps
rg -n "config-local.*password|officialConfig.*password|selfHostedConfig.*password" extensions/vnite-importer apps/desktop/src/main/services/extension -g "*.ts"
```

负向搜索：

```powershell
rg -n "from ['\"]@main|from ['\"]@shared/db|drizzle|better-sqlite3|electron" extensions/vnite-importer/src -g "*.ts"
rg -n "console\\.log|console\\.error" extensions/vnite-importer/src -g "*.ts"
```

手动验收：

1. 选择 `tmp/vnite-database-20260603.zip`。
2. 分析结果应显示 124 个游戏、5 个合集。
3. 默认字段预览应显示媒体附件高覆盖、save attachment missing warnings。
4. 关闭补全后执行导入，应创建或更新游戏并导入合集。
5. 开启补全并选择 game scraper profile 后执行导入，应在 TaskRun 中显示 completion counters。
6. 重复导入同一备份，不应重复创建游戏、sessions、notes 或合集关系。
7. 取消导入，TaskRun 应进入 cancelled，临时目录应清理。

## Rollout

因为这是内置扩展且 API 未发布：

- 不写迁移兼容层。
- 不保留旧 method string。
- 不发布到远程 extension registry。
- 跟随 desktop build 打包进 `resources/extensions`。

合并顺序：

1. API contracts。
2. Host capability。
3. Built-in extension scaffold。
4. Reader/mapping/import/completion。
5. UI。
6. Tests and docs update。
