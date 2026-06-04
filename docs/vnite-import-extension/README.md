# Vnite 数据库导入内置扩展

本文档集描述一个新的内置扩展 `builtin.vnite-importer`。扩展从 Vnite 数据库备份压缩包读取 PouchDB 数据，将用户选择的字段导入 Kisaki 本地资料库，并可在导入后通过 Kisaki ingest 按用户选择的刮削配置补全缺失元数据。

扩展 API 尚未发布，本设计不保留旧 API 兼容层。所有新增能力以当前 Kisaki 扩展系统、SQLite/Drizzle 数据层、TaskRun、settings panel 和 ingest 服务为事实边界。

## 目标

- 用户选择 Vnite 备份 zip 后，扩展能分析、预览并导入其中的游戏、合集、标签、启动配置、游玩记录、媒体附件、存档记录和回忆记录。
- 用户可按字段组选择导入范围。
- 用户可选择是否在导入后补全元数据。
- 用户可选择补全元数据所用的 game scraper profile。
- 导入过程可取消、可追踪进度、可生成可读摘要。
- 导入是幂等的：重复导入同一个 Vnite 游戏不会重复创建 Kisaki 游戏。
- 扩展不直接写 Kisaki SQLite，不绕过主进程服务、触发器、附件存储、FTS 和事件系统。

## 非目标

- 不导入 Vnite 用户配置、插件配置、云同步配置、热键、代理、主题 CSS。
- 不恢复 Vnite 应用本身的运行环境。
- 不保证 Vnite 的全部 UI 外观配置在 Kisaki 中可表达。
- 不把 Vnite 单个游戏视为完整 Kisaki 知识图谱。直接导入只保留可可靠迁移的用户数据和浅层事实；更完整的公司、人物、角色、图片和关系由后续 ingest 补全。

## 关键决策

- **两段式导入**：先将 Vnite 数据规范化为 Kisaki library graph 并直接导入，再按用户选择用 ingest 补全缺失元数据。
- **宿主 graph 写入**：新增通用 `kisaki.library.graph.preview/apply` capability，由宿主在主进程内完成校验、实体自然匹配、关系写入、附件落盘和事件触发。
- **文件授权**：新增 `kisaki.files.pickFile` capability。用户选中的 zip 会被复制为扩展临时 file grant，扩展只读取这个受控副本。
- **来源标识强制写入**：每个导入的游戏都写入 `source=vnite` 的 external id，值为 Vnite `game._id`，用于幂等和后续诊断。该内部来源标识不作为用户可关闭字段。
- **补全默认不覆盖**：metadata completion 默认使用 `singularUpdate: "ifMissing"` 和 `collectionUpdate: "merge"`。用户导入的 Vnite 字段优先保留。
- **敏感配置隔离**：Vnite `config-local` 可能包含同步账号和密码。扩展只做结构校验和统计，不导入、不展示、不记录这些值。

## 文档导航

- [01 Source Facts](01-source-facts.md): Vnite 源码和真实备份包事实。
- [02 Extension API And Host Changes](02-extension-api-and-host-changes.md): 需要新增或调整的扩展 API、RPC 和宿主实现边界。
- [03 Extension Architecture](03-extension-architecture.md): 内置扩展目录、模块职责、依赖方向和数据生命周期。
- [04 Import Model And Field Mapping](04-import-model-and-field-mapping.md): Graph DTO、字段选择和 Vnite 到 Kisaki 的映射规则。
- [05 Import Flow And Metadata Completion](05-import-flow-and-metadata-completion.md): 端到端流程、graph apply 算法、补全策略和冲突处理。
- [06 UI TaskRun And Errors](06-ui-taskrun-and-errors.md): settings panel、TaskRun 进度、错误模型、安全与日志。
- [07 Implementation Plan](07-implementation-plan.md): 可执行实施步骤、测试策略和验收搜索。
