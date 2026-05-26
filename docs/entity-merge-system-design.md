# 实体合并系统设计

本文定义 Kisaki 的用户可用实体合并系统。系统用于把一个重复实体合并到一个保留实体中，并迁移 external ID、关系、标签、合集、活动记录、附件与相关筛选引用。

本方案不考虑向后兼容。可以直接调整共享契约、IPC、DbService helper 结构与实体菜单接入方式，但应保持项目现有架构边界、命名风格和 UI 语言一致。

## 核心原则

- 只支持两两合并：一次请求只有一个保留实体和一个重复实体。
- 入口实体就是事实源：从哪个实体菜单发起合并，哪个实体就是最终保留实体。
- 合并不是字段比选流程：不提供合并前影响清单或字段选择 UI。
- 策略必须确定：同一输入在任何地方执行都得到同一结果。
- 默认不覆盖入口实体的已有事实，只吸收重复实体中可安全保留的数据。
- 跨表写入统一由主进程 DbService 完成，renderer 不参与业务规则。

## 目标

- 支持用户从实体菜单直接发起合并。
- 支持同类型两个实体合并为一个目标实体。
- 合并后数据库只保留入口实体，重复实体被删除。
- 尽可能保留全部用户数据，不因为唯一约束、附件清理或关系去重造成隐式丢失。
- 主进程在单个合并流程中保证数据一致性。
- 前端保持干净、密集、克制，只提供重复实体选择与确认动作。

## 范围

支持 `AllEntityType`：

- `game`
- `character`
- `person`
- `company`
- `collection`
- `tag`

其中 `game`、`character`、`person`、`company` 是 external ID 主体，必须完整处理 external ID 合并与唯一约束。`collection`、`tag` 没有 external ID，但仍支持实体合并与关系迁移。

不处理：

- 跨类型合并。
- 一次合并多个重复实体。
- 用户字段选择 UI。
- 合并前影响清单。
- 撤销历史。
- 扩展私有 storage/secrets 中的任意实体 ID 重写。
- 无稳定 schema 的 background task args 自动重写。
- 把动态合集查询结果物化为静态成员。

## 现有基础

实体与关系：

- 核心实体表在 `apps/desktop/src/shared/db/schema.ts`。
- 内容实体 external ID 表是 `game_external_ids`、`person_external_ids`、`company_external_ids`、`character_external_ids`，每张表都有 `(source, external_id)` 全局唯一约束。
- 本方案要求 external ID 的 `source` 与 `external_id` 使用专用 Drizzle `customType` 入库前规范化，确保唯一约束比较的是规范化后的值。
- 实体关系主要通过 link tables 表达，例如 `game_person_links`、`character_person_links`、`collection_game_links`、`game_tag_links`。
- link tables 普遍有唯一约束和排序字段，不能只做简单 foreign key update。

服务边界：

- 主进程 DB 能力集中在 `DbService`。
- Renderer 通过 sqlite-proxy 查询普通数据，但跨表一致性写入应走主进程 IPC。
- 合并是 DbService 的一等能力，不复用 renderer 查询结果做业务判断。

UI 边界：

- 实体菜单统一使用 `MenuItems` 加 `DropdownMenu` / `ContextMenu` adapter。
- 业务对话框由菜单外层组件持有 open state，避免菜单关闭导致 dialog 被销毁。
- 删除、external ID、元数据更新等已有表单都使用 `Dialog`、`DialogBody`、`DialogFooter`、`useAsyncData`、`notify`。

## 总体设计

实体合并做成 DbService 的确定性写入能力：

```text
renderer
  EntityMergeDialog
  useEntityMerge
  core/db/entity-merge.ts
      |
      | IPC
      v
main DbService
  entityMerge.merge(request)
      |
      v
SQLite transaction + attachment staging
```

合并流程：

1. 用户从入口实体菜单点击“合并重复实体”。
2. 对话框锁定当前入口实体为目标实体。
3. 用户选择一个同类型重复实体。
4. 用户确认后调用 `db:merge-entities`。
5. 主进程读取最新目标与来源数据，生成内部合并计划。
6. 主进程先异步暂存需要复制的附件，再进入同步 DB transaction。
7. transaction 内更新目标实体、迁移关系、重写筛选引用、删除来源实体。
8. transaction 成功后返回结果，renderer toast 并按当前页面位置刷新或跳转。

整个流程没有公开的合并前计划查询。用户只需要决定“把哪个重复实体合并到当前入口实体”。

## 文件组织

共享契约：

```text
apps/desktop/src/shared/entity-merge.ts
```

主进程：

```text
apps/desktop/src/main/services/db/helper/entity-merge/
  coordinator.ts
  configs.ts
  fields.ts
  filters.ts
  relations.ts
  attachments.ts
  types.ts
  index.ts
```

DbService 接入：

```text
apps/desktop/src/main/services/db/service.ts
apps/desktop/src/main/services/db/ipc.ts
apps/desktop/src/main/services/db/helper/index.ts
```

Renderer DB client：

```text
apps/desktop/src/renderer/src/core/db/entity-merge.ts
apps/desktop/src/renderer/src/core/db/index.ts
```

Renderer UI：

```text
apps/desktop/src/renderer/src/composables/use-entity-merge.ts
apps/desktop/src/renderer/src/components/shared/entity-merge/
  merge-dialog.vue
  target-summary.vue
  source-summary.vue
  source-picker.vue
  confirm-summary.vue
  index.ts
```

菜单接入：

```text
apps/desktop/src/renderer/src/components/shared/game/menus/*
apps/desktop/src/renderer/src/components/shared/person/menus/*
apps/desktop/src/renderer/src/components/shared/company/menus/*
apps/desktop/src/renderer/src/components/shared/character/menus/*
apps/desktop/src/renderer/src/components/shared/collection/menus/*
apps/desktop/src/renderer/src/components/shared/tag/menus/*
```

## 共享契约

`apps/desktop/src/shared/entity-merge.ts` 只放纯类型。

核心类型：

```ts
export interface EntityMergeRequest {
  entityType: AllEntityType
  targetId: string
  sourceId: string
}

export interface EntityMergeResult {
  entityType: AllEntityType
  targetId: string
  sourceId: string
  changedCounts: Partial<Record<EntityMergeChangeKind, number>>
}
```

`targetId` 永远表示入口实体，也是最终保留实体。`sourceId` 永远表示被吸收并删除的重复实体。

IPC：

```ts
'db:merge-entities': (params: EntityMergeRequest) => IpcResult<EntityMergeResult>
```

IPC adapter 只转发到 `service.entityMerge`，不放业务判断。

不需要共享：

- 用户字段选择。
- 合并前影响计划。
- 用户可编辑的字段分歧类型。
- 用户可见的执行前置错误类型。

无法执行的情况由主进程抛出稳定英文错误，renderer 只显示本地中文失败 toast。

## 主进程能力

`DbEntityMergeCoordinator` 是 public entry：

```ts
export class DbEntityMergeCoordinator {
  merge(params: EntityMergeRequest): Promise<EntityMergeResult>
}
```

构造参数：

- `db`: Drizzle better-sqlite3 client。
- `attachment`: `AttachmentStore`。
- `event`: `EventService`，用于发出合并完成事件。

`DbService` 初始化：

```ts
this.entityMerge = new DbEntityMergeCoordinator(this.client, this.attachment, event)
```

合并执行分为两个阶段：

1. 异步附件暂存阶段。
   - 不进入 DB transaction。
   - 复制 source row storage 中需要保留的文件到 target row storage。
   - 生成 staged file names。
   - 若后续 transaction 失败，清理 staged files。

2. 同步 transaction 阶段。
   - 不使用 `await`。
   - 写目标实体字段。
   - 合并 external IDs。
   - 合并或迁移 link tables。
   - 重写 collection dynamicConfig 与 showcase section filters。
   - 删除 source entity。

成功后发送：

```ts
event.bus.emit('entity.merged', {
  entityType,
  targetId,
  sourceId,
  occurredAt: Date.now()
})
```

DB triggers 仍会正常产生 `db.updated`、`db.inserted`、`db.deleted` 与现有 library projection 事件。

## 请求校验

主进程入口统一做最小校验：

- `entityType` 必须有 merge config。
- `targetId` 与 `sourceId` 必须非空。
- `targetId` 与 `sourceId` 不能相同。
- target 与 source 必须存在。
- target 与 source 必须属于同一 `entityType`。

这些问题不进入 UI 专用类型。它们是执行前置条件，失败时作为普通合并失败处理。

## Entity Config

每个实体类型由配置驱动，避免把所有规则散在 switch 中。

配置包含：

- 主表。
- 名称字段。
- external ID 配置，可选。
- 标量字段策略。
- JSON 字段策略。
- 附件字段策略。
- 该实体作为 owner 的 link tables。
- 该实体作为 referenced target 的 link tables。
- 删除来源实体的方法。

示例结构：

```ts
interface EntityMergeConfig {
  entityType: AllEntityType
  table: SQLiteTable
  nameColumn: AnyColumn
  externalIds?: ExternalIdMergeConfig
  fields: FieldMergeConfig[]
  attachments: AttachmentMergeConfig[]
  ownedRelations: RelationMergeConfig[]
  referencedRelations: RelationMergeConfig[]
}
```

`ownedRelations` 示例：

- 合并 game 时，`game_person_links.game_id`、`game_company_links.game_id`、`game_character_links.game_id`、`game_tag_links.game_id`、`game_notes.game_id`、`game_sessions.game_id`。

`referencedRelations` 示例：

- 合并 person 时，`game_person_links.person_id`、`character_person_links.person_id`、`collection_person_links.person_id`。
- 合并 tag 时，`game_tag_links.tag_id`、`character_tag_links.tag_id`、`person_tag_links.tag_id`、`company_tag_links.tag_id`。

## 字段合并策略

字段策略以入口实体为事实源。目标已有事实不被来源覆盖；来源只在目标缺失或字段天然可合并时参与。

通用字段：

| 字段类型       | 策略                                     |
| -------------- | ---------------------------------------- |
| `name`         | 保留目标                                 |
| `originalName` | 目标非空优先，否则来源补齐               |
| `sortName`     | 目标非空优先，否则来源补齐               |
| `description`  | 目标非空优先，否则来源补齐               |
| `score`        | 目标非空优先，否则来源补齐               |
| `isFavorite`   | OR                                       |
| `isNsfw`       | OR                                       |
| `relatedSites` | 按 URL 规范化去重，目标顺序优先          |
| `createdAt`    | 取最早                                   |
| `updatedAt`    | transaction 内自然更新或显式设为当前时间 |

Game 字段：

| 字段                           | 策略                                   |
| ------------------------------ | -------------------------------------- |
| `status`                       | 保留目标                               |
| `releaseDate`                  | 目标非空优先，否则来源补齐             |
| `lastActiveAt`                 | 取最新                                 |
| `totalDuration`                | 目标和来源相加                         |
| launcher / monitor / save 配置 | 目标非空优先，否则来源补齐             |
| `saveBackups`                  | 目标顺序优先，按 `backupAt` 去重后追加 |

Person 字段：

- `birthDate`、`deathDate`、`gender` 目标非空优先，否则来源补齐。

Company 字段：

- `foundedDate` 目标非空优先，否则来源补齐。

Character 字段：

- `birthDate`、`gender`、`bloodType`、`height`、`weight`、`bust`、`waist`、`hips`、`cup`、`age` 目标非空优先，否则来源补齐。

Collection 字段：

- `name`、`description`、`coverFile`、`order` 目标非空优先，否则来源补齐。
- `isNsfw` OR。
- `isDynamic` 与 `dynamicConfig` 作为一组处理：保留目标配置，不采用来源配置。
- 不把动态合集结果物化为静态 membership。

Tag 字段：

- `name` 保留目标。
- `description` 目标非空优先，否则来源补齐。
- `isNsfw` OR。

## External ID 合并

仅内容实体有 external ID。

规范化边界：

- `source` 与 `external_id` 列使用专用 Drizzle `customType`，`toDriver` 调用 `normalizeKeyText`。DB 内只存规范化后的 external ID 值。
- `normalizeExternalIds` 保留在 `@shared/identity`，负责数组级规范化、去重和顺序保留，不承担列写入职责。
- 所有写入 external ID rows 的路径都必须经过 Drizzle schema column，不绕过 custom type；空值仍由表单或服务边界校验拒绝。

规则：

1. 读取目标和来源 external IDs。
2. 使用 `normalizeExternalIds` 合成最终列表并去重。
3. 目标已有顺序优先，来源追加。
4. `merge` 阶段校验最终 external IDs 的现有归属实体只属于目标或来源；若违反，抛出稳定错误。
5. transaction 内删除目标和来源 external ID rows，再按最终顺序插入目标 rows。

这样可以避免 `(source, external_id)` 唯一约束在迁移中间态触发。

## 关系合并

关系表必须按“最终快照”重建，不直接批量 update。

通用步骤：

1. 读取目标相关 rows。
2. 读取来源相关 rows。
3. 将来源 rows 的合并实体 ID 替换为目标 ID。
4. 按唯一约束 key 合并重复 rows。
5. 删除目标和来源相关 rows。
6. 按最终排序插入目标 rows。

重复 row 合并策略：

| 字段                | 合并策略                       |
| ------------------- | ------------------------------ |
| `isSpoiler`         | OR                             |
| `note`              | 目标非空优先，否则来源补齐     |
| `type`              | 参与唯一 key，不互相覆盖       |
| owner 排序字段      | 目标原顺序优先，来源-only 追加 |
| referenced 排序字段 | 按目标实体下重新计算           |

典型关系：

- `game_person_links`: key = `gameId + personId + type`
- `game_company_links`: key = `gameId + companyId + type`
- `game_character_links`: key = `gameId + characterId + type`
- `character_person_links`: key = `characterId + personId + type`
- `*_tag_links`: key = entity id + tag id
- `collection_*_links`: key = collection id + entity id

## Game 专属数据

`game_sessions`：

- 来源 sessions 全部迁移到目标。
- `totalDuration` 使用目标与来源相加。
- 如果 session rows 迁移后触发唯一性问题，以 session `id` 为独立记录，不合并。

`game_notes`：

- 按 `gameId + name` 有唯一约束。
- 目标没有同名 note 时直接迁移。
- 同名时保留两份，来源 note 重命名为 `原名 (merged)`。
- 如果重命名后仍重名，追加序号：`原名 (merged 2)`。
- `contentInlineFiles` 跟随 note 内容复制到目标 row storage。

save backups：

- `saveBackups` JSON 按 `backupAt` 去重。
- 来源 backup files 如果保留，复制到目标 row storage 并更新 JSON 中的 `saveFile`。

## 附件处理

附件不能只更新 DB 字段，因为删除 source row 会触发 source storage cleanup。

需要在 `AttachmentStore` 增加面向合并的低层能力：

```ts
copyFileForMerge(tableName, fromRowId, toRowId, fileName): Promise<string>
copyFilesForMerge(tableName, fromRowId, toRowId, fileNames): Promise<string[]>
cleanupStagedFiles(tableName, rowId, fileNames): Promise<void>
```

规则：

- 目标附件字段已有值时保留目标，不复制来源文件。
- 目标附件字段为空且来源有值时，把来源文件复制到目标 row storage，并写入复制后的新文件名。
- JSON inline files 与文本字段成组处理。采用来源文本时复制来源 inline files；合并文本时按实际保留文件集合复制。
- transaction 失败时清理已暂存到目标 row storage 的文件。
- transaction 成功后不删除来源文件，由 source row deletion 的现有 cleanup 处理。

主要附件字段：

- `games`: `coverFile`、`backdropFile`、`logoFile`、`iconFile`、`descriptionInlineFiles`、`saveBackups[].saveFile`
- `game_notes`: `coverFile`、`contentInlineFiles`
- `persons`: `photoFile`
- `companies`: `logoFile`
- `characters`: `photoFile`
- `collections`: `coverFile`

## 筛选引用重写

合并后 source entity ID 不应继续出现在用户可见筛选配置中。

需要重写：

- `showcase_sections.filter`
- `collections.dynamic_config.*.filter`

规则：

1. 遍历所有 filter state。
2. 找到 relation filter 中引用被合并实体类型的字段。
3. 把 `sourceId` 替换为 `targetId`。
4. 去重并保持原顺序。
5. 空 relation filter 按现有 filter normalization 移除。

需要显式配置 relation filter 目标类型，因为当前 query spec 只描述 link table 和 column，不直接声明 related entity type。

示例：

- 合并 tag：重写 `tags` relation filter。
- 合并 collection：重写 `collections` relation filter。
- 合并 person：重写 game filter 中的 `persons`、character filter 中的 `persons`。
- 合并 game：重写 person/character/company filter 中的 `games`。

## Collection 合并

静态合集：

- 迁移 `collection_*_links` 到目标。
- 按 entity ID 去重。
- 目标顺序优先，来源-only 成员追加。

动态合集：

- `dynamicConfig` 是合集实体字段，不代表固定 membership。
- 保留目标的动态配置。
- 来源动态配置不合并、不覆盖。
- 如果目标是静态合集、来源是动态合集，目标仍保持静态合集。
- 如果目标是动态合集、来源是静态合集，目标仍保持动态合集；来源静态成员作为普通 relation 迁移。

## Tag 合并

Tag 合并只迁移 tag links：

- `game_tag_links`
- `character_tag_links`
- `person_tag_links`
- `company_tag_links`

同一实体已经同时有目标 tag 和来源 tag 时合并 link 状态：

- `isSpoiler` OR。
- `note` 目标非空优先。
- 排序目标优先，来源-only 追加。

source tag 删除后，唯一 name 约束自然释放。

## Renderer 交互

菜单项：

- 文案：`合并重复实体`
- 图标：`icon-[mdi--source-merge]`
- 位置：`管理外部ID` 之后、extension entity menu contributions 之前；`collection` 和 `tag` 放在编辑信息之后、删除之前。

每个 `MenuItems` 增加 emit：

```ts
openMergeDialog: []
```

每个 `DropdownMenu` / `ContextMenu` 增加：

```ts
const mergeDialogOpen = ref(false)
```

并在菜单外渲染：

```vue
<EntityMergeDialog
  v-if="mergeDialogOpen"
  v-model:open="mergeDialogOpen"
  entity-type="game"
  :target-id="props.gameId"
/>
```

对话框结构：

1. 顶部：目标实体摘要，明确它会被保留。
2. 中部：重复实体选择器，只能选择一个。
3. 中部：重复实体摘要，明确它会被合并并删除。
4. 中部：简短确认摘要，只表达最终动作。
5. 底部：取消与合并按钮。

选择器：

- 复用现有 `GameSelect`、`PersonSelect`、`CompanySelect`、`CharacterSelect`、`CollectionSelect`、`TagSelect`。
- single mode。
- `excludeIds` 包含目标 ID。

实体摘要：

- `target-summary.vue` 与 `source-summary.vue` 使用同一种紧凑行布局。
- 左侧显示正方形媒体，样式与 `GameSelect` 选项保持一致。
- `game` 使用 cover，`person` / `character` 使用 photo，`company` 使用 logo，`collection` 使用 cover，`tag` 使用 fallback icon / 色块。
- 媒体区域固定尺寸，不因图片加载、缺失或长文本造成布局跳动。
- 右侧显示名称与一行次要信息；文本截断，不换成说明段落。

状态：

- `idle`: 还未选择来源实体，禁用合并按钮，不显示重复实体摘要。
- `ready`: 已选择来源实体，显示重复实体摘要，允许合并。
- `submitting`: 禁止关闭和重复提交。
- `failed`: toast 显示失败，对话框保持可编辑状态。

UI 风格：

- 使用 `DialogContent class="max-w-lg"`。
- 不使用影响清单、字段分歧列表、字段选择控件。
- 不做教程式说明。
- destructive 样式只用于真正删除语义；合并按钮用 default primary。

## Renderer 数据流

`useEntityMerge` 负责：

- 接收 `entityType`、`targetId`、`sourceId`、`open`。
- 暴露 `submitting`、`mergeEntities()`。
- 成功后返回 `EntityMergeResult`。

`core/db/entity-merge.ts` 负责 IPC unwrap：

```ts
export async function mergeEntities(params): Promise<EntityMergeResult>
```

Renderer owns notifications：

- 成功：`已合并到「目标名称」`
- 失败：`合并失败`

## 路由与刷新

合并结果返回 `targetId` 和 `sourceId`：

- 当前页面实体是 target：关闭 dialog，依赖 DB events 刷新。
- 当前页面实体被作为 source 合并：跳转到 target detail route。
- 当前列表选中了 source：清空 selection。
- detail dialog 展示 source：关闭 source dialog 或切到 target。

Renderer 不需要依赖 error string 或 DB deleted event 反推目标。

## 事务顺序

执行顺序建议固定：

1. 规范化请求 ID。
2. 读取最新目标与来源 rows。
3. 校验执行前置条件。
4. 生成内部合并计划。
5. 校验 merge 内部不变量，例如 external IDs 的现有归属实体只属于目标或来源。
6. 暂存附件文件。
7. 开启 DB transaction。
8. 写目标核心字段。
9. 写 external IDs。
10. 合并 owned relations。
11. 合并 referenced relations。
12. 重写 filters。
13. 删除 source entity。
14. 提交 transaction。
15. 发出 `entity.merged`。
16. 返回 result。

transaction 内不允许 `await`。

## 错误处理

主进程：

- domain 层抛出稳定英文错误。
- 记录可诊断上下文时使用 `createLogger('Db')`。
- 不记录完整 DB row、用户正文、note 内容、description 内容、完整文件路径数组。

IPC：

- 使用 `wrapIpc`。
- 返回 `IpcResult`。
- 不在 IPC adapter 中做业务分支。

Renderer：

- 不比较 `result.error`。
- 用本地中文 toast 表达操作上下文。

## 实施步骤

1. 新增 external ID 专用 Drizzle custom type，并替换四张 external ID 表的 `source` 与 `external_id` 列。
2. 新增 `@shared/entity-merge` 契约与 IPC 类型。
3. 在 DbService 下新增 `entityMerge` helper。
4. 实现确定性 merge：请求校验、内部合并计划、内部不变量校验、附件暂存、同步 transaction、source 删除、result。
5. 增加 filter rewrite。
6. 增加 renderer core client 与 `useEntityMerge`。
7. 增加 `components/shared/entity-merge` 对话框。
8. 接入六类实体菜单。
9. 调整 detail page/dialog 在 source 被合并后的跳转或关闭逻辑。
10. 运行类型检查与 lint。

## 验证

项目当前没有专门的单元测试脚本，落地后至少执行：

```powershell
pnpm --filter kisaki typecheck
pnpm --filter kisaki lint
```

手工验证 fixture：

- 两个 game 合并，包含 external IDs、tags、collections、persons、companies、characters、sessions、notes、media files。
- 两个 person 合并，包含 game links、character links、collections、tags、photo。
- 两个 character 合并，包含 game links、person links、collections、tags、photo。
- 两个 company 合并，包含 game links、collections、tags、logo。
- 两个 tag 合并，验证四类 tag links 去重。
- 两个 collection 合并，验证静态成员去重和 dynamicConfig 保留目标。
- external ID `source` / `external_id` 使用大小写、前后空白、全角半角差异写入时，DB 中存储为规范化值，唯一约束能阻止重复归属。
- source detail page 被其他入口合并后跳转到 target。
- target detail page 发起合并后数据刷新。
- source 附件复制到 target 后，删除 source 不会清掉 target 文件。

## 后续扩展

后续可以增加：

- 候选重复实体推荐。
- 批量重复实体巡检页。
- 合并历史与撤销。
- extension API 中的 merge event。

这些能力不影响当前合并主流程，暂不进入第一版实现。
