# Renderer 迁移范围

## 为什么这不是简单换 IPC

当前 dialog 是围绕旧 updater 字段集和 renderer 侧编排构建的。

- 单体 dialog 目前执行的是 `search -> scrape -> metadata-updater:update-*`。
- batch dialog 目前是在 renderer 本地循环 `search -> scrape -> update`。
- 当前选择 UI 只覆盖旧 updater 的字段集合。
- `game` 和 `character` 的 metadata update dialog 目前没有关系选择面。

所以 renderer 这部分不是“把一个 IPC 名称换掉”这么简单，而是实际的 UI 和交互重构。

## 单体 Dialog 范围

### 四类实体共通改造

- 保留现有 searcher 组件，继续由 renderer 负责单体 search 和结果选择。
- 扩充 searcher 输出，确保单体 lookup 至少包含：
  - `name`
  - `knownIds`
  - 可选的 `searchProviderId`
  - 可选的 `searchProviderItemId`
- 用新的 reconcile request 替换旧 updater 选项：
  - `surfaces`
  - `policy.singularUpdate`
  - `policy.collectionUpdate`
- UI 直接渲染单一 `surfaces` 清单，不再按 `core / media / relation` 分组；surface metadata 仅作为内部语义和实现依据。
- 提交一次 `reconciler:reconcile-*-from-scraper` 请求。
- 成功 / 失败反馈收敛为简单 toast 或本地提示，不设计结构化结果展示面板。
- 删除对 `scraper:scrape-*` 的直接调用。
- 删除对 `metadata-updater:update-*` 的直接调用。
- 删除 renderer 侧 metadata patch 转换逻辑。

### `game`

- 将当前字段选择区改为单一 `surfaces` 清单。
- 新增以下关系选择 UI：
  - `person`
  - `company`
  - `character`
- nested `characterPerson` 不单独暴露；在选择 `character` 时隐式跟随。
- 保留“使用当前 external IDs 辅助定位”的选项。

### `character`

- 将当前字段选择区改为单一 `surfaces` 清单。
- 新增 `person` 关系选择 UI，对应 `characterPerson`。
- 保留“使用当前 external IDs 辅助定位”的选项。

### `person`

- 将当前字段选择区改为单一 `surfaces` 清单。
- 本阶段不增加关系选择区。

### `company`

- 将当前字段选择区改为单一 `surfaces` 清单。
- 本阶段不增加关系选择区。

## Batch Dialog 范围

### 四类实体共通改造

- 保持 batch 编排在 renderer。
- 用 renderer 本地循环的 `search/lookup -> reconciler:reconcile-*-from-scraper` 替换旧的 `search -> scrape -> update`。
- 继续在 renderer 中读取当前根实体摘要并维护本地进度状态。
- 本地跟踪并展示：
  - total
  - processed
  - success count
  - failure count
  - current item
- 不新增 batch IPC。
- 不订阅 batch progress event。
- 不设计 batch 聚合结果 contract。
- 删除本地逐项 `scrape/update` 编排逻辑。

### Batch lookup 约束

batch dialog 对每个 root 需要：

- 基于当前摘要组装初始 lookup
- 按配置决定是否带上当前 external IDs
- 在需要时执行本地 search，用搜索结果补强 lookup
- 最终仅调用单体 reconcile IPC

### Batch 表单状态

batch dialog 仍然需要收集：

- `profileId`
- 选中的 `surfaces`
- reconcile policy
- `useCurrentExternalIdsAsKnownIds`

batch dialog 不再需要收集或构造：

- 本地 update payload
- 本地 bundle-to-patch 转换结果
- 任何依赖 main 侧 batch IPC / event 的进度状态

## Helper 和旧契约清理

在 cutover 阶段删除以下 renderer 侧 helper：

- `to*MetadataUpdateInput`
- `fieldsToOption`
- `@renderer/utils` 中只为 updater 服务的导出
- 所有依赖旧 updater payload 形态的 dialog 逻辑

## 迁移备注

- `person` 和 `company` 的 renderer 迁移相对较小，因为本阶段没有关系选择区。
- `character` 和 `game` 的 renderer 迁移更大，因为需要引入新的 relation section。
- 单体 flow 的 search 继续留在 renderer。
- batch 的 lookup 组装和本地进度维护都继续留在 renderer。
