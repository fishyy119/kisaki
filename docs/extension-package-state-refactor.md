# 扩展包状态提交与恢复重构设计与实施文档

本文定义 Kisaki 扩展包安装、更新、卸载、提交、恢复和 signer trust 处理的目标形态。

本次重构不考虑向后兼容：旧 `packages/transaction/` 模型、旧 rollback handle、旧 signer trust 随安装回滚语义、旧 transaction 命名和旧跨业务聚合实现全部删除，不保留 alias、shim、双写或降级路径。

## 背景

当前 `apps/desktop/src/main/services/extension/packages/transaction/` 名义上是包事务层，但实际承担了过多职责：

1. 替换 active package。
2. 删除 active package。
3. 写入 installation row。
4. 写入 signer trust。
5. 保存 signer trust 快照并在失败时恢复。
6. 启动时扫描、修复、隔离包目录。
7. 校验 active package 与 archive、repository source snapshot、signature 的一致性。
8. 裁剪 archive cache 和 operation temp 目录。

这些职责跨越 package artifact、installation state、signer trust、recovery、integrity verification 和 runtime activation，已经不再是事务辅助层，而是一个不清晰的聚合业务层。

根本问题不是缺少更复杂的事务，而是过度追求“全流程原子化”和“全流程可回滚”。文件系统、SQLite、扩展运行时和用户信任偏好不可能组成真正的 ACID 事务。继续模拟大事务只会让边界越来越模糊。

## 核心结论

删除 `transaction` 概念，改为更小、更明确的模型：

```text
prepare -> commit package state -> refresh installation view -> apply runtime state -> recover on startup
```

规则：

1. `installation row` 是已安装事实。
2. `packages/<extension-id>` 是 active package artifact。
3. `archives/<sha256>.kisx` 是恢复、校验和 cache 输入，不是 active package。
4. `temp/operations/*` 是一次操作的临时产物，可以被启动恢复清理。
5. `data/<extension-id>` 是扩展数据，安装和卸载 package code 不删除数据。
6. signer trust 是用户信任偏好，不属于安装事务。
7. runtime 启动失败不是安装失败。
8. commit 成功返回后，不再提供业务 rollback。
9. crash 后由 recovery 根据持久事实收敛，而不是依赖未完成的业务调用栈。

目标是小提交、强校验、启动恢复兜底，而不是大事务。

## 目标

- 删除 `packages/transaction/` 目录和所有 `Transaction` 命名。
- 新增清晰的 package commit 层，只负责提交 active package 和 installation row。
- 新增 package integrity 层，只负责校验 active package 是否匹配 installation source。
- 新增 package recovery 层，只负责启动时收敛 package store。
- signer trust 从安装提交中剥离，作为独立用户偏好写入。
- installer 负责业务决策，packages 只负责 artifact 准备、校验、提交和恢复。
- runtime activation 在 package commit 成功后执行，失败时保留安装记录并展示 runtime failed。
- uninstall 只删除 package code 和 installation row，保留 data、cache、secrets。
- 更新不再通过 package rollback 回到旧版本；更新后的 runtime 失败通过 installed view 暴露。

## 非目标

- 不设计新的 extension runtime API。
- 不设计 signer trust UI。
- 不设计扩展权限系统。
- 不保留旧 transaction API。
- 不支持旧安装状态迁移。
- 不在 package commit 层实现业务策略判断。
- 不让 renderer 参与 package 文件、archive、repository manifest 或 signer trust 的直接写入。

## 目标目录结构

最终 `packages/` 目录使用以下职责划分：

```text
apps/desktop/src/main/services/extension/packages/
  archive.ts
  cleanup.ts
  commit.ts
  downloader.ts
  extractor.ts
  icon.ts
  index.ts
  integrity.ts
  layout.ts
  manifest.ts
  operations.ts
  preparer.ts
  recovery.ts
  types.ts
  verifier.ts
```

删除：

```text
apps/desktop/src/main/services/extension/packages/transaction/
```

其中：

| 文件           | 职责                                                                |
| -------------- | ------------------------------------------------------------------- |
| `commit.ts`    | 提交 staged package 为 active package，或移除 active package。      |
| `integrity.ts` | 校验 package dir、manifest、archive、source snapshot 和 signature。 |
| `recovery.ts`  | 启动恢复、清理 operation temp、恢复 backup/trash、隔离孤儿 active。 |
| `cleanup.ts`   | operation temp 的通用清理 helper，可选；也可内联在 `commit.ts`。    |
| `preparer.ts`  | 下载、复制、解压 `.kisx` 到 staging，不做最终提交。                 |
| `archive.ts`   | content-addressed archive store。                                   |
| `layout.ts`    | 路径派生和路径安全约束。                                            |

## 模块边界

### `installer/**`

`installer` 是安装和更新的业务编排层。

它负责：

- 创建 install plan。
- 校验用户确认。
- 决定首次安装、更新、本地覆盖安装的语义。
- 决定 enabled、installReason、updatePolicy、pinnedVersion、includePreviewUpdates。
- 决定是否写入 signer trust。
- 调用 package preparer 下载或复制 archive。
- 调用 package committer 提交 active package 和 installation row。
- commit 成功后刷新 installed view 并应用 runtime state。
- 发送 installations 和 trusted signers 变更事件。

它不负责：

- 直接移动 active package 目录。
- 直接扫描 package store。
- 直接裁剪 archive cache。
- 在 runtime 失败后回滚 package。

### `packages/**`

`packages` 是 package artifact 生命周期层。

它负责：

- `.kisx` 下载、复制、校验、解压。
- active package 提交和移除。
- package store 启动恢复。
- active package 与 installation source 的完整性校验。
- operation temp、backup、trash、quarantine 的路径安全。

它不负责：

- install/update 业务策略。
- renderer confirmation。
- signer trust 决策。
- runtime lifecycle。
- contribution release。

### `installations/**`

`installations` 是安装事实和 installed view 层。

它负责：

- SQLite installation row 的 CRUD。
- installed view 聚合。
- enable/disable/update policy/uninstall/purge data。
- runtime desired state 构建和刷新。
- 卸载前的 user-managed 检查和 contribution release 检查。

它不负责：

- active package 目录的底层移动细节。
- repository candidate selection。
- archive verification。

### `signers/**`

`signers` 是用户信任偏好层。

它负责：

- extension-scoped signer trust 的存储、展示、删除。
- signer trust 输入校验。

它不负责：

- 跟随安装成功或失败做 rollback。
- package commit。
- repository install candidate 选择。

### `runtime/**`

`runtime` 是扩展运行状态层。

它负责：

- extension host 生命周期。
- desired vs loaded state reconcile。
- runtime diagnostics。

它不负责：

- 决定 package 是否安装成功。
- 在 activation 失败时回滚 active package。

## Package Commit 模型

### 命名

使用 `ExtensionPackageCommitter`，文件为 `packages/commit.ts`。

不再使用：

- `ExtensionPackageTransactionCoordinator`
- `ExtensionPackageTransaction`
- `ExtensionPackageTransactionHandle`
- `replaceActivePackage` 作为唯一 public API
- `commit()/rollback()` handle

### Public API

```ts
export type ExpectedPreviousActivePackage = 'none' | 'present' | 'any'

export interface PutActiveExtensionPackageInput {
  operationId: string
  extensionId: string
  stagedPackageDir: string
  installation: CreateOrUpdateExtensionInstallationInput
  expectedPrevious: ExpectedPreviousActivePackage
  cleanupPaths?: readonly string[]
}

export interface RemoveActiveExtensionPackageInput {
  operationId: string
  extensionId: string
  cleanupPaths?: readonly string[]
}

export class ExtensionPackageCommitter {
  putActivePackage(input: PutActiveExtensionPackageInput): Promise<void>
  removeActivePackage(input: RemoveActiveExtensionPackageInput): Promise<void>
}
```

`CreateOrUpdateExtensionInstallationInput` 应由 `installations/store.ts` 定义或导出。不要在 `packages/commit.ts` 中重新定义一份安装领域字段。

### `expectedPrevious`

`expectedPrevious` 是 package store 的前置条件声明。它不是业务类型，不表达 install、update 或 local import。

| 值        | 含义                                               | 典型调用场景                     |
| --------- | -------------------------------------------------- | -------------------------------- |
| `none`    | 当前不应存在 active package。若存在则失败。        | 首次安装                         |
| `present` | 当前必须存在 active package。若不存在则失败。      | 普通更新                         |
| `any`     | 不关心 active package 是否存在，有则替换，无则新增 | 本地覆盖安装、修复安装、强制覆盖 |

使用建议：

```text
首次安装: expectedPrevious = 'none'
普通更新: expectedPrevious = 'present'
本地覆盖安装: expectedPrevious = 'any'
修复安装: expectedPrevious = 'any'
```

### `putActivePackage` 语义

`putActivePackage` 的职责是把一个已经准备好的 staged package 提交为 active package，并写入对应 installation row。

它必须：

1. 校验 `input.extensionId === input.installation.id`。
2. 通过 `layout.operationPaths(input.operationId)` 派生 operation paths。
3. 校验 `stagedPackageDir` 位于本 operation 的 staging root 内。
4. 检查当前 active package 是否存在，并执行 `expectedPrevious` 前置条件。
5. 将旧 active package 移到 operation backup。
6. 将 staged package 移到 active package path。
7. 在 SQLite 中 create 或 update installation row。
8. 尽力删除 backup、download、staging 和额外 cleanup paths。
9. 在失败时只做当前函数内部的局部补偿。

它不允许：

1. 写入 signer trust。
2. 创建 signer trust snapshot。
3. 返回 rollback handle。
4. 启动、停止或 reload runtime。
5. 发送 IPC event。
6. 计算 updatePolicy、pinnedVersion 或 installReason。
7. 校验 renderer confirmation。

建议提交顺序：

```text
assert paths and preconditions
ensure package operation directories
move active package to backup if present
move staged package to active package
upsert installation row
best-effort cleanup backup and operation temp
return
```

失败补偿规则：

| 失败位置                      | 处理方式                                           |
| ----------------------------- | -------------------------------------------------- |
| 前置条件失败                  | 不移动任何文件，直接抛错。                         |
| 旧 active 移到 backup 后失败  | 尝试把 backup 移回 active。                        |
| staged 移到 active 后 DB 失败 | 删除新 active，尝试把 backup 移回 active。         |
| cleanup 失败                  | 记录 warning，不让 commit 失败，由 recovery 清理。 |

### `removeActivePackage` 语义

`removeActivePackage` 的职责是移除 active package 并删除 installation row。

它必须：

1. 通过 `layout.operationPaths(input.operationId)` 派生 operation paths。
2. 如果 active package 存在，将其移到 operation trash。
3. 删除 installation row。
4. 尽力删除 trash、download、staging 和额外 cleanup paths。
5. 在 DB 删除失败时尝试把 trash 移回 active。

它不允许：

1. 删除 `data/<extension-id>`。
2. 删除 extension secrets。
3. 删除 signer trust。
4. 停止 runtime。
5. assert contributions released。

卸载前的业务约束仍由 `ExtensionInstallationManager.uninstall` 完成。

## Signer Trust 模型

signer trust 不再属于 package commit。

用户选择信任 signer fingerprint 时，installer 直接调用 `signers` 模块写入：

```text
assert install plan confirmed
if approval.trustSignerFingerprint:
  signers.trust(...)
prepare package
commit package
apply runtime state
```

规则：

1. signer trust 是用户偏好，不是安装产物。
2. signer trust 写入成功后，即使后续下载、解压、commit 或 runtime activation 失败，也不撤回。
3. 如果用户明确选择信任 signer，但 trust 写入失败，本次安装应在 package prepare 前失败。
4. 如果用户没有选择信任 signer，则 installer 不写 signer trust。
5. signer trust 删除只能通过 signer 管理入口完成，不能由 package uninstall 隐式删除。

这会让语义更诚实：用户信任的是某个 extension id 下的 signing key fingerprint，不是“某次安装成功后的附带状态”。

## Runtime 模型

runtime activation 不再决定 package commit 成败。

安装和更新流程中：

```text
package commit success
refresh installed view
apply runtime state
if runtime failed:
  keep installation row
  keep active package
  expose runtime failed diagnostics
```

规则：

1. enabled extension 启动失败时，安装仍然成功。
2. update 后新版本启动失败时，更新仍然成功。
3. installed view 通过 runtimeStatus/runtimeError/runtimeDiagnostics 暴露失败。
4. 手动 reload、disable、uninstall、set update policy 继续走 installations manager。
5. 不在 runtime failure catch 分支调用 package rollback。

如果未来需要“更新失败自动回退旧版本”，应作为独立产品能力设计，不复用 package commit 的内部 backup。

## Package Integrity 模型

新增 `packages/integrity.ts`，从旧 `transaction/validation.ts` 拆出纯校验逻辑。

建议 API：

```ts
export interface ExtensionPackageInspection {
  valid: boolean
  extensionId: string | null
  version: string | null
}

export interface ExtensionPackageIntegrityIssue {
  message: string
}

export async function inspectPackageDirectory(
  packageDir: string
): Promise<ExtensionPackageInspection>

export async function validateInstalledPackageIntegrity(
  archiveStore: ExtensionPackageArchiveStore,
  installation: ExtensionInstallationRow,
  packageDir: string
): Promise<string | null>
```

`integrity.ts` 可以调用：

- `readExtensionManifestFile`
- `validateInstalledExtensionPackage`
- `ExtensionPackageVerifier`
- `archiveStore.requireArchive`
- `createExtensionRegistryReleaseDigest`
- `hashFile`

它不允许：

- 移动文件。
- 删除文件。
- 写 DB。
- 修改 installation row。
- 修改 signer trust。
- 发送 event。

校验内容：

1. active package 有合法 `manifest.json`。
2. manifest id 与 installation id 一致。
3. manifest version 与 installation version 一致。
4. installation source 存在。
5. source 对应 archive 存在。
6. local-file source 的 archive sha256 一致。
7. repository source 的 release digest 与 source snapshot 一致。
8. repository source 的 artifact 存在于 source snapshot。
9. signed artifact 的 key id 和 fingerprint 与 installation source 一致。
10. active package 文件集合和 archive entries 一致。

## Package Recovery 模型

新增 `packages/recovery.ts`，从旧 `transaction/recovery.ts` 拆出启动收敛逻辑。

建议 API：

```ts
export interface ExtensionPackageRecoveryResult {
  actions: readonly ExtensionPackageRecoveryAction[]
  issues: readonly string[]
}

export class ExtensionPackageRecovery {
  recover(): Promise<ExtensionPackageRecoveryResult>
}
```

recovery 的唯一入口由 `ExtensionService.init()` 在 repositories、runtime、installations 初始化前调用。

### 恢复原则

1. SQLite installation rows 是事实源。
2. active package 必须匹配 installation row。
3. backup/trash 只是未完成 commit/remove 的恢复材料。
4. downloads/staging 是可删除临时产物。
5. untracked active package 不能进入 installed view，必须 quarantine。
6. archive cache 只保留当前 installation source 需要的 sha256。

### 恢复步骤

```text
ensure base directories
prune downloads
prune staging
prune old quarantine entries if desired
load installation rows
prune archives not referenced by installation source
scan active packages
scan operation backups
scan operation trash
quarantine active packages without installation row
for each installation:
  if active package matches installation:
    remove stale backups/trash for this extension
    continue
  if matching backup/trash can satisfy installation:
    restore it to active package path
    remove other backup/trash entries for this extension
    continue
  report issue
remove backups that are no longer useful
remove trash entries for missing installation rows
return actions and issues
```

### Crash Window Matrix

`putActivePackage` crash windows:

| Crash 位置                      | 持久状态                       | recovery 行为                          |
| ------------------------------- | ------------------------------ | -------------------------------------- |
| 移动旧 active 前                | DB 与 active 仍一致            | 不处理或清理 temp。                    |
| 旧 active 已进入 backup         | DB 指向旧版本，active 缺失     | 从 backup 恢复旧 active。              |
| staged 已进入 active，DB 未写入 | DB 指向旧版本或无 row          | 对更新恢复 backup；对新增 quarantine。 |
| DB 已写入，backup 未清理        | DB 指向新版本，active 是新版本 | 删除旧 backup。                        |
| cleanup 未完成                  | DB 与 active 一致，temp 残留   | 删除 temp。                            |

`removeActivePackage` crash windows:

| Crash 位置          | 持久状态                   | recovery 行为            |
| ------------------- | -------------------------- | ------------------------ |
| 移动 active 前      | DB 与 active 仍一致        | 不处理。                 |
| active 已进入 trash | DB row 仍存在，active 缺失 | 从 trash 恢复 active。   |
| DB row 已删除       | 无 installation row        | 删除 trash。             |
| cleanup 未完成      | 无 installation row        | 删除残留 temp 或 trash。 |

## Installer 流程

### Repository install/update

```text
operation = packageOperations.start(...)
runMutatingOperation:
  assert not aborted
  candidate = repositories.resolveInstallCandidate(command)
  plan = installPlanner.createRepositoryPlanForCandidate(candidate)
  assert plan approved
  if user confirmed signer trust:
    signers.trust(...)
    emit trusted signers changed
  prepared = packagePreparer.prepareRepositoryPackage(...)
  installation = create installation write from candidate, plan and command
  packageCommitter.putActivePackage({
    operationId,
    extensionId,
    stagedPackageDir: prepared.packageDir,
    installation,
    expectedPrevious: command.reason === 'update' ? 'present' : 'none'
  })
  installations.refresh()
  installations.applyRuntimeState(...)
  emit installations changed
  return installations.require(extensionId)
finally:
  packageOperations.finish(operationId)
```

注意：

1. update 前仍可 unload 当前 runtime，避免 Windows 上文件占用。
2. update 后 runtime activation 失败不回滚。
3. signer trust 写入失败会阻止后续 package prepare。
4. package prepare 失败不会撤回 signer trust。

### Local file install

```text
operation = packageOperations.start(...)
runMutatingOperation:
  plan = create local install plan
  assert plan confirmed
  prepared = packagePreparer.prepareLocalPackage(...)
  preparedPlan = create local import plan from prepared archive
  assert prepared plan confirmed
  packageCommitter.putActivePackage({
    operationId,
    extensionId,
    stagedPackageDir: prepared.packageDir,
    installation: {
      id: extensionId,
      enabled,
      version,
      source: local-file source,
      installReason: 'local-file',
      updatePolicy: 'manual',
      pinnedVersion: null,
      includePreviewUpdates: false
    },
    expectedPrevious: installations.store.get(extensionId) ? 'any' : 'none'
  })
  installations.refresh()
  installations.applyRuntimeState(...)
  emit installations changed
  return installations.require(extensionId)
finally:
  packageOperations.finish(operationId)
```

本地文件重复安装同一 extension id 时，产品语义是覆盖安装，因此使用 `any`。

## Uninstall 流程

`ExtensionInstallationManager.uninstall` 负责业务前置条件：

```text
runMutatingOperation:
  safeExtensionId = requireSafeExtensionId(extensionId)
  assert user-managed
  previous = requireUserInstalled(safeExtensionId)
  runtime.unloadExtension(safeExtensionId, 'disable')
  contributions.assertReleased(safeExtensionId, 'uninstall')
  syncReloadWatcherTargets(...)
  packageCommitter.removeActivePackage({
    operationId: randomUUID(),
    extensionId: safeExtensionId
  })
  refresh()
  applyRuntimeState({ cause: 'uninstall' })
  emit installations changed
```

卸载失败时：

1. 如果失败发生在 `removeActivePackage` 内部，committer 做局部补偿。
2. 如果 `removeActivePackage` 成功，卸载已经完成，不再回滚。
3. 后续 refresh/applyRuntimeState 失败时，下一次启动 recovery 和 installed view 会收敛。
4. data、runtime temp、secrets 和 signer trust 保留。

`purgeData` 仍是独立命令，只有它可以删除 `data/<extension-id>` 和 runtime temp。

## Service 初始化

`ExtensionService.init()` 中的包相关初始化调整为：

```text
layout = new ExtensionPackageLayout(paths)
archiveStore = new ExtensionPackageArchiveStore(layout)
packageVerifier = new ExtensionPackageVerifier()
packageCommitter = new ExtensionPackageCommitter(layout, db, installationStore)
packageRecovery = new ExtensionPackageRecovery(layout, db, archiveStore)

await recoverPackages()

init repositories
init capabilities/contributions/runtime/reloadWatcher/installations/installer/updates
register IPC
await installations.init()
repositories.refreshRepositoriesInBackground()
```

`recoverPackages()` 只调用 package recovery，不再提 transaction。

日志前缀统一使用：

```text
[ExtensionPackageRecovery]
[ExtensionPackageCommitter]
[ExtensionService]
```

不再出现：

```text
[ExtensionPackageTransaction]
[ExtensionPackageTransactionCoordinator]
```

## 数据模型

不需要新增 SQLite 表。

需要调整的是类型所有权：

1. installation 写入类型放在 `installations/store.ts`。
2. package commit input 引用 installation store 的 public input type。
3. signer trust input 只由 `signers/store.ts` 拥有。
4. package recovery result 类型放在 `packages/recovery.ts` 或 `packages/types.ts`。
5. package integrity inspection 类型放在 `packages/integrity.ts`。

不要在 `packages/commit.ts` 里复制 installation 字段定义。

## 文件级实施清单

### 删除

```text
apps/desktop/src/main/services/extension/packages/transaction/context.ts
apps/desktop/src/main/services/extension/packages/transaction/coordinator.ts
apps/desktop/src/main/services/extension/packages/transaction/filesystem.ts
apps/desktop/src/main/services/extension/packages/transaction/index.ts
apps/desktop/src/main/services/extension/packages/transaction/recovery.ts
apps/desktop/src/main/services/extension/packages/transaction/replace.ts
apps/desktop/src/main/services/extension/packages/transaction/signer-snapshots.ts
apps/desktop/src/main/services/extension/packages/transaction/types.ts
apps/desktop/src/main/services/extension/packages/transaction/uninstall.ts
apps/desktop/src/main/services/extension/packages/transaction/validation.ts
```

### 新增

```text
apps/desktop/src/main/services/extension/packages/commit.ts
apps/desktop/src/main/services/extension/packages/integrity.ts
apps/desktop/src/main/services/extension/packages/recovery.ts
apps/desktop/src/main/services/extension/packages/cleanup.ts
```

`cleanup.ts` 如果内容很少，可以不新增，直接把 helper 保留在 `commit.ts` 和 `recovery.ts` 内部。

### 修改

```text
apps/desktop/src/main/services/extension/packages/index.ts
apps/desktop/src/main/services/extension/service.ts
apps/desktop/src/main/services/extension/installer/manager.ts
apps/desktop/src/main/services/extension/installations/manager.ts
apps/desktop/src/main/services/extension/installations/store.ts
apps/desktop/src/main/services/extension/signers/manager.ts
apps/desktop/src/main/services/extension/updates/manager.ts
apps/desktop/src/main/services/extension/updates/planner.ts
docs/extension-distributed-registry-redesign.md
```

`updates/**` 理论上只需要适配 installer public API，不应直接触碰 package commit。

## 实施顺序

### 1. 引入 installation 写入类型

在 `installations/store.ts` 中统一安装写入类型：

```ts
export interface CreateOrUpdateExtensionInstallationInput {
  id: string
  enabled?: boolean
  version: string
  source: ExtensionInstallationSource
  installReason?: ExtensionInstallReason
  updatePolicy?: ExtensionUpdatePolicy
  pinnedVersion?: string | null
  includePreviewUpdates?: boolean
  installedAt?: Date
}
```

将 `create` 和 `update` 的输入类型整理为围绕这个公共写入类型展开。

### 2. 新增 `packages/integrity.ts`

从旧 `transaction/validation.ts` 迁移纯校验逻辑。

迁移后确认：

- 文件内没有 DB write。
- 文件内没有 `fse.move`、`fse.remove`。
- 文件内没有 signer trust import。
- 文件内没有 installer/installations manager import。

### 3. 新增 `packages/recovery.ts`

从旧 `transaction/recovery.ts` 迁移 recovery 流程。

迁移后确认：

- recovery 调用 `integrity.ts`。
- recovery 可以读 installation rows。
- recovery 可以移动 active/backup/trash/quarantine。
- recovery 不写 signer trust。
- recovery 不调用 runtime。
- recovery 不发送 IPC。

### 4. 新增 `packages/commit.ts`

实现 `ExtensionPackageCommitter`：

- `putActivePackage`
- `removeActivePackage`
- `ExpectedPreviousActivePackage`

迁移后确认：

- 无 public rollback handle。
- 无 signer trust input。
- 无 runtime import。
- 无 installer import。
- 只使用 `ExtensionInstallationStore` 写 installation row。
- cleanup failure 只 warning。

### 5. 改写 installer install/update

在 `installer/manager.ts` 中：

- 替换 `packageTransactionCoordinator` 为 `packageCommitter`。
- 删除 `handle` 变量。
- 删除 catch 分支中的 `handle.rollback()`。
- signer trust 写入提前到 package prepare 前。
- package commit 成功后刷新 installed view。
- runtime activation 失败不回滚 package。

### 6. 改写 local file install

本地安装使用 `putActivePackage`：

- 新安装使用 `expectedPrevious: 'none'`。
- 已存在 extension id 的覆盖安装使用 `expectedPrevious: 'any'`。
- local-file source 仍记录 `artifactSha256`。
- updatePolicy 固定为 `manual`。

### 7. 改写 uninstall

在 `installations/manager.ts` 中：

- 替换 `packageTransactionCoordinator.uninstallPackage` 为 `packageCommitter.removeActivePackage`。
- 删除 rollback handle。
- 保留 runtime unload 和 contribution release 检查。
- 保留 data purge 为独立命令。

### 8. 改写 service wiring

在 `service.ts` 中：

- 创建 `ExtensionPackageCommitter`。
- 创建 `ExtensionPackageRecovery`。
- `recoverPackageTransactions` 改名为 `recoverPackages`。
- 删除所有 transaction import、字段和日志。

### 9. 清理 exports 和 imports

在 `packages/index.ts` 中：

- 删除 `export * from './transaction'`。
- 新增 `export * from './commit'`。
- 新增 `export * from './integrity'`。
- 新增 `export * from './recovery'`。

全仓库搜索并清理：

```text
Transaction
transaction
ExtensionPackageTransaction
replaceActivePackage
uninstallPackage
ExtensionPackageTransactionHandle
signer-snapshots
```

保留普通数据库 `db.transaction` 这个词。

### 10. 更新设计文档和 skill 参考

更新：

- `docs/extension-distributed-registry-redesign.md`
- `.codex/skills/kisaki/references/extension-system.md`
- `.codex/skills/kisaki/references/architecture.md`

将旧文案中的“事务安装”“可回滚更新”“transaction coordinator”替换为：

- package commit
- package recovery
- package integrity
- startup reconciliation

## 验证策略

本次重构不新增自动化测试，不编写 unit tests 或 integration tests。

实施完成后只做静态和构建验证：

```text
pnpm typecheck
pnpm lint
pnpm --filter @kisaki/desktop build
```

如果项目当前没有对应 script，至少执行 TypeScript 检查和 desktop build。

## 风险与处理

### Runtime failure 不回滚更新

风险：用户更新后扩展无法启动，旧版本不会自动恢复。

处理：installed view 明确展示 runtime failed，并提供手动重新安装旧版本、禁用、卸载或后续 repair 能力。自动回退如果需要，另立设计，不复用 commit backup。

### Signer trust 独立持久化

风险：用户信任 signer 后安装失败，trusted signer 列表仍出现该 fingerprint。

处理：这是目标语义。UI 可以展示 trust 来源和时间，但不应暗示只有成功安装才会保留 trust。

### Commit cleanup 失败

风险：backup、trash 或 temp 残留。

处理：commit 记录 warning，startup recovery 清理。

### Active package 与 DB 短暂不一致

风险：进程 crash 可能留下 active/package row 不一致。

处理：启动 recovery 以 installation row 为事实源收敛。

### Local overwrite 语义过宽

风险：`expectedPrevious: 'any'` 可能掩盖调用方状态错误。

处理：只在本地覆盖安装、repair、force overwrite 使用 `any`。repository update 使用 `present`，repository first install 使用 `none`。

## 完成标准

重构完成时必须满足：

1. 仓库中不存在 `packages/transaction/`。
2. 除 `db.transaction` 外，扩展 package commit/recovery 代码不再使用 `transaction` 命名。
3. signer trust 不再出现在 package commit input 中。
4. package commit 不返回 rollback handle。
5. runtime activation 失败不会触发 package rollback。
6. recovery 是 `packages` 顶层能力，不挂在 transaction 下。
7. integrity verification 是纯校验能力，不移动文件、不写 DB。
8. installer 仍是 install/update 业务决策唯一入口。
9. uninstall 保留 extension data 和 signer trust。
10. docs 和 kisaki skill reference 中不再描述旧 transaction coordinator 目标形态。

## 最终心智模型

```text
repositories  说明可安装什么
installer     决定本次要安装什么，以及用户确认了什么
packages      准备、校验、提交和恢复 package artifact
installations 记录本机已经安装什么
signers       记录用户信任哪些 signer fingerprint
runtime       尝试运行已安装且启用的 extension
updates       选择候选版本，并复用 installer 执行
```

一句话原则：

```text
不要追求全流程可回滚；只提交最小持久事实，其余状态通过恢复和视图收敛。
```
