# 05 Library Events

## 目标

Kisaki 当前大量代码直接操作 Drizzle API，不能依赖每个写入点手动发 `library.game.updated`。事件系统需要以 SQLite trigger 发出的 raw DB event 为底层事实源，再由 `DbService` 内的 typed event projector 投影为实体级 library events。

## Raw DB Trigger

现有 SQLite trigger 只发 `operation`、`table`、`id`。为了构造类型安全的新旧值，需要增强 raw trigger payload：

```ts
interface RawDbChangeEvent {
  operation: 'inserted' | 'updated' | 'deleted'
  table: TableName
  id: string
  old?: Record<string, unknown>
  next?: Record<string, unknown>
  occurredAt: number
}
```

SQLite trigger 可以使用 `OLD` / `NEW` 为直接表字段提供 old/next row snapshot。实现上可以：

- 为每张 tracked table 生成 `json_object(...)` 形式的 OLD/NEW payload。
- INSERT 只提供 `next`。
- UPDATE 同时提供 `old` 和 `next`。
- DELETE 只提供 `old`。
- raw payload 只供主进程 projector 使用，不作为扩展公共契约。

直接字段变化可以从 raw old/next 准确判断。关系表变化同样应进入 raw payload；projector 用 raw old/next change set 加上窗口结束时的当前公共状态，反向重建窗口开始前的公共状态，从而为关系聚合 facet 提供类型安全的 `before` / `after`。

## DB Event Projector

DB event projector 是 `DbService` 的子模块：

- 订阅 raw `db:*` event。
- 按 table/id debounce/coalesce。
- 将 raw table change 映射为实体级 library event。
- 对同一个实体在同一批次的多次变化合并为一个 `updated` event。
- 对直接字段变化保留批次开始前的 `before` 和批次结束时的 `after`。
- 对 tracked junction table 支撑的关系聚合 facet 同样必须构造 `before` 和 `after`，例如 external ids、tags、collection membership。
- 只有真正无法从 raw change set 可逆重建的派生 facet 才允许省略 `before`，并应在具体 contract 中显式标记。

扩展事件 capability 订阅 projector 发出的领域事件，而不是自己把 `db:*` 映射成 library event。

## 事件粒度

公共事件至少按实体类型拆分：

- `library.game.created`
- `library.game.updated`
- `library.game.deleted`
- `library.person.created`
- `library.person.updated`
- `library.person.deleted`
- `library.company.created`
- `library.company.updated`
- `library.company.deleted`
- `library.character.created`
- `library.character.updated`
- `library.character.deleted`
- `library.collection.created`
- `library.collection.updated`
- `library.collection.deleted`
- `library.tag.created`
- `library.tag.updated`
- `library.tag.deleted`

不使用一个大而全的 `LibraryEntityUpdatedEvent`。实体内部变化使用 `changes` 判别联合表达，不拆成 `library.game.score.updated` 这类过细事件。

## Game Updated Contract

`changes[].facet` 是判别字段，决定 `before` / `after` 的类型。`fields` 是 best-effort 诊断信息，不作为扩展兼容性保证。

```ts
type LibraryGameChange =
  | {
      facet: 'status'
      before: { status: LibraryGameStatus }
      after: { status: LibraryGameStatus }
      fields?: ['status']
    }
  | {
      facet: 'score'
      before: { score: number | null }
      after: { score: number | null }
      fields?: ['score']
    }
  | {
      facet: 'identity'
      before: { externalIds: ExternalId[] }
      after: { externalIds: ExternalId[] }
      fields?: string[]
    }
  | {
      facet: 'activity'
      before: { totalDuration?: number; lastActiveAt?: number | null }
      after: { totalDuration?: number; lastActiveAt?: number | null }
      fields?: string[]
    }
  | {
      facet: 'tags'
      before: { tagIds: string[] }
      after: { tagIds: string[] }
      fields?: string[]
    }
  | {
      facet: 'collections'
      before: { collectionIds: string[] }
      after: { collectionIds: string[] }
      fields?: string[]
    }
  | {
      facet: 'assets'
      before: Partial<LibraryGameAssetSnapshot>
      after: Partial<LibraryGameAssetSnapshot>
      fields?: string[]
    }
  | {
      facet: 'relations'
      before: LibraryGameRelationSnapshot
      after: LibraryGameRelationSnapshot
      fields?: string[]
    }
  | {
      facet: 'core'
      before: Partial<LibraryGameCoreSnapshot>
      after: Partial<LibraryGameCoreSnapshot>
      fields?: string[]
    }

interface LibraryGameUpdatedEvent {
  gameId: string
  changes: LibraryGameChange[]
  occurredAt: number
  source?: LibraryChangeSource
}
```

规则：

- `facet` 是稳定公共契约，对扩展保证语义兼容。
- `before` / `after` 是对应 facet 的稳定公共值快照，不是 DB column dump。
- 直接字段变化必须带 `before` 和 `after`。
- tracked 关系变化必须带 `before` 和 `after`。projector 可以通过“查询窗口结束后的聚合状态 + 反向应用 raw old/next change set”得到窗口开始前的聚合状态。
- 如果未来新增无法可靠反推旧值的派生 facet，应在类型里显式使用 `before?`，不能让扩展猜。
- `fields` 只用于日志、调试和高级诊断，不给扩展做强兼容承诺。
- payload 不带完整实体。扩展需要更多数据时，通过 `kisaki.library.games.get(gameId)` 查询。

## Game Facet Mapping

建议的 game facet 映射：

- `games.status` -> `status`
- `games.score` -> `score`
- `games.name`、`games.originalName`、`games.description`、`games.releaseDate` -> `core`
- `game_external_ids` -> `identity`
- `game_tag_relations` -> `tags`
- `collection_game_relations` -> `collections`
- `game_sessions` 或游玩时长相关写入 -> `activity`
- 封面、背景、logo、icon 等附件字段 -> `assets`
- 人物、公司、角色等关系表 -> `relations`

## Other Entity Contracts

每个实体都定义自己的 change union，哪怕第一版很多 facet 名相同：

```ts
type LibraryPersonChange =
  | {
      facet: 'core'
      before: Partial<LibraryPersonCoreSnapshot>
      after: Partial<LibraryPersonCoreSnapshot>
      fields?: string[]
    }
  | {
      facet: 'identity'
      before: { externalIds: ExternalId[] }
      after: { externalIds: ExternalId[] }
      fields?: string[]
    }
  | {
      facet: 'score'
      before: { score: number | null }
      after: { score: number | null }
      fields?: ['score']
    }
  | { facet: 'tags'; before: { tagIds: string[] }; after: { tagIds: string[] }; fields?: string[] }
  | {
      facet: 'assets'
      before: Partial<LibraryPersonAssetSnapshot>
      after: Partial<LibraryPersonAssetSnapshot>
      fields?: string[]
    }
  | {
      facet: 'relations'
      before: LibraryPersonRelationSnapshot
      after: LibraryPersonRelationSnapshot
      fields?: string[]
    }

type LibraryCollectionChange =
  | {
      facet: 'core'
      before: Partial<LibraryCollectionCoreSnapshot>
      after: Partial<LibraryCollectionCoreSnapshot>
      fields?: string[]
    }
  | {
      facet: 'membership'
      before: LibraryCollectionMembershipSnapshot
      after: LibraryCollectionMembershipSnapshot
      fields?: string[]
    }
  | {
      facet: 'dynamicConfig'
      before: LibraryDynamicCollectionConfig
      after: LibraryDynamicCollectionConfig
      fields?: string[]
    }
  | {
      facet: 'assets'
      before: Partial<LibraryCollectionAssetSnapshot>
      after: Partial<LibraryCollectionAssetSnapshot>
      fields?: string[]
    }
```

## Optional Source And Coalescing

`source` 是可选诊断字段，不是自动同步防循环的硬条件。建议包含：

```ts
interface LibraryChangeSource {
  kind: 'user' | 'extension' | 'scanner' | 'ingest' | 'command' | 'system' | 'unknown'
  extensionId?: string
  commandId?: string
  taskId?: string
}
```

由于直接 Drizzle 写入无法天然携带 source，第一版允许 `source.kind = 'unknown'`。通过 library capability、ingest service、command service、background task service 发生的写入可以尽量携带 source，用于日志、后台任务历史和调试。

Coalescing 规则：

- 同一 tick / 短窗口内同一实体的多次 raw DB change 合成一个 updated event。
- 直接字段的 `before` 取窗口内第一次变化前的值，`after` 取窗口结束时的值。
- 关系聚合的 `after` 取窗口结束时的公共聚合状态；`before` 通过反向应用本窗口 raw old/next relation changes 得到，或在事务/批次开始时显式采样。
- 如果变化先 insert 后 delete，可只发 deleted 或不发 public event，具体由 projector 按实体生命周期决定。
- 如果 insert 后又 update，created event 可携带最终创建快照，避免立即追加 updated 噪音。
