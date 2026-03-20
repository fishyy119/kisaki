# Reconcile 语义规则

## 通用规则

- `selection` 只影响 `current` 加载和 `plan`，不影响 scrape 覆盖范围。
- 只有被选中的 surface 才能生成 plan item。
- `character` reconcile 显式暴露 `person` surface，对应 `characterPerson` 关系集合。
- `game` reconcile 中的 nested `characterPerson` 仍不作为独立用户选择项暴露；
  只要本次选择了 `gameCharacter`，就必须跟随同步。
- 没有可用 incoming 时执行内部 no-op，请求本身不报错。
- incoming 为空时绝不清空已有数据。
- 所有 external ID 冲突都必须在真正写入前检查。
- asset 写入统一在事务提交后执行。

## 单值 surface

可用 incoming 的定义：

- 字符串：非空字符串
- 日期：有值
- 枚举或数值：有值
- 数组：非空数组

规则：

- `singularUpdate = ifMissing`：只有当前值缺失且 incoming 可用时才写入。
- `singularUpdate = overwrite`：只要 incoming 可用就覆盖。
- incoming 不可用：内部 no-op。

## 集合型 core surface

### `merge`

- 保留当前顺序。
- 对 incoming 做归一化和去重。
- 只把净新增项按 incoming 顺序追加到尾部。
- 不重排已有项。

### `replace`

- 只有 incoming 集合非空时才整体替换。
- 最终顺序以 incoming 为准。
- incoming 为空时内部 no-op。

### 补充说明

- `externalIds`：替换前先做全量冲突预检查。
- `tags`：按标签名归一化，并复用已有标签实体。
- `relatedSites`：按 URL 归一化。

## 媒体资源

- 每个媒体 surface 最终只落一个活动 attachment。
- 可用 incoming 定义为“首个非空 URL 可用”。

规则：

- `singularUpdate = ifMissing`：只有当前 attachment 缺失且 incoming 首个 URL 可用时才写入。
- `singularUpdate = overwrite`：incoming 首个 URL 可用时直接替换。
- incoming 为空：内部 no-op。

### 说明

- 只有当前 attachment 缺失且 incoming 首个 URL 可用时才写入。
- 当前 attachment 已存在时，只有 `overwrite` 才会替换。

## 关系集合

唯一 key 以数据库约束为准：

- `gamePerson`：`gameId + personId + type`
- `gameCompany`：`gameId + companyId + type`
- `gameCharacter`：`gameId + characterId + type`
- `characterPerson`：`characterId + personId + type`

### `merge`

- 保留当前 link 顺序。
- 先解析或创建关联实体。
- 再把 incoming 归一化成 link key。
- 命中已有 key 时：
  - 保留当前位置
  - 以保守策略合并 payload
  - `isSpoiler = current || incoming`
  - `note = current firstNonEmpty incoming`
- 未命中 key 时：
  - 按 incoming 顺序追加到尾部
- 不删除当前存在但 incoming 中缺失的 link。

### `replace`

- 只有 incoming link 集合非空时才整体替换。
- 先解析 incoming 关联实体。
- 再删除当前关系集合，并按 incoming 顺序重建。
- link payload 以 incoming 为准。
- incoming 为空时内部 no-op。

## 关联实体复用与创建

### 分层原则

- scraper 的 provider 结果合并仍可继续使用 `externalIds + originalName/name` 这类 alias key。
- reconciler 的 DB 复用阶段不使用名称匹配。

### DB 复用规则

- 只按归一化后的 external IDs 复用既有关联实体。
- 不按 `name`、`originalName`、alias 或其他 fallback key 命中已有 DB 实体。
- incoming 关联实体如果有 external IDs：
  - 先按 external IDs 查 DB
  - 命中则复用
  - 未命中则创建
- incoming 关联实体如果没有 external IDs：
  - 直接视为 DB miss
  - 创建新实体

### 命中既有实体后的限制

- 复用既有实体 ID。
- 不更新被复用实体的根字段。
- 不更新被复用实体的标签。
- 不更新被复用实体的 external IDs。
- 不更新被复用实体的媒体资源。
- 只在当前 reconcile 边界内写 link。

### 新建实体写入范围

新建关联实体时写入：

- 根字段
- 标签
- external IDs
- 媒体资源

新建关联实体的媒体资源同样走 post-commit asset flush。

## 嵌套 `characterPerson`

- 在 `game` reconcile 中，先统一归一化 nested `characterPerson` facts，再进入 plan。
- nested `characterPerson` facts 在 incoming 归一化阶段同时派生 `gamePerson` candidates。
- 派生出的 gamePerson candidates 归入 `gamePerson` surface，而不是暴露新的 surface。
- nested `characterPerson` 不作为独立用户选择项暴露；只要本次选择了 `gameCharacter`，就必须跟随同步。
- `gameCharacter` 与 nested `characterPerson` 的写入必须发生在同一事务中。
- 如果 incoming `character` 复用了既有 DB character：
  - 仍允许写入 `characterPerson` links
  - 但不能顺手更新该 `character` 的根 metadata。

## 顺序规则

- `merge`：保留当前顺序，并按 incoming 顺序追加净新增项。
- `replace`：按 incoming 顺序整体重建。
- `orderInGame`、`orderInCharacter`、`orderInPerson`、`orderInCompany` 都在 apply 阶段重新计算。
- 不复用旧的持久化顺序值。

## 失败与日志规则

### 单体 reconcile

直接失败：

- 根实体不存在
- scrape 调用失败
- external ID 冲突
- 事务写入失败

内部 no-op，但不作为错误返回：

- 所选 surface 没有可用 incoming
- `singularUpdate = ifMissing` 因当前已有值而跳过
- `replace` 因 incoming 为空而跳过
- `merge` 后没有净新增或有效差异

只记录日志，不回滚事务，也不额外暴露公共 payload：

- post-commit asset flush 失败
- 非致命 scrape / incoming 归一化异常

### Batch reconcile（renderer 本地编排）

- 单项失败不能中断整个 batch。
- renderer 本地循环继续处理后续 root。
- 成功数、失败数和当前进度都由 renderer 本地状态维护。
