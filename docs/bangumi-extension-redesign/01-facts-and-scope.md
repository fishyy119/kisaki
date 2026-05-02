# 01 Facts And Scope

## 事实源

所有 Bangumi 侧行为只以官方 API 和开发者文档为事实源：

- Bangumi API Swagger: <https://bangumi.github.io/api/>
- Bangumi API OpenAPI JSON: <https://bangumi.github.io/api/dist.json>
- Bangumi API repository: <https://github.com/bangumi/api>
- OAuth 文档: <https://github.com/bangumi/api/blob/master/docs-raw/How-to-Auth.md>
- User-Agent 建议: <https://github.com/bangumi/api/blob/master/docs-raw/user%20agent.md>
- Bangumi 开发者平台入口: <https://bgm.tv/dev> 和 <https://bgm.tv/dev/app>

实现规则：

- API base URL 使用 `https://api.bgm.tv`。
- OAuth base URL 使用 `https://bgm.tv`。
- 新 API `/v0/` 的授权只能通过 `Authorization: Bearer <token>` header，不使用 query string token。
- 非浏览器 API client 必须发送包含开发者个人 ID、应用名的 User-Agent；作为分发应用还应包含版本号和项目主页。
- OpenAPI 未定义的字段、endpoint、状态语义，不在实现中臆造。

## Bangumi API 能力边界

OAuth：

- 授权入口：`GET https://bgm.tv/oauth/authorize`，`response_type` 当前使用 `code`。
- 授权码有效期为 60 秒。
- 换取 token：`POST https://bgm.tv/oauth/access_token`，`grant_type=authorization_code`。
- 刷新 token：同一 endpoint，`grant_type=refresh_token`。
- 查询 token 状态：`POST https://bgm.tv/oauth/token_status`。
- `scope` 在文档中标记为尚未实现，因此第一版不设计 scope 选择。
- 当前登录用户信息：`GET /v0/me`，需要 Bearer token。

收藏同步：

- 获取用户收藏：`GET /v0/users/{username}/collections`。
- 过滤参数：`subject_type`、`type`、`limit`、`offset`。
- 游戏条目类型：`SubjectType=4`。
- 用户收藏类型：`1=想看`、`2=看过`、`3=在看`、`4=搁置`、`5=抛弃`；在游戏 UI 中显示为想玩、玩过、在玩、搁置、抛弃。
- 获取单条收藏：`GET /v0/users/{username}/collections/{subject_id}`。
- 新增或修改当前用户单条收藏：`POST /v0/users/-/collections/{subject_id}`。
- 修改当前用户单条收藏：`PATCH /v0/users/-/collections/{subject_id}`。
- 修改 payload 字段包括 `type`、`rate`、`ep_status`、`vol_status`、`comment`、`private`、`tags`。
- `rate` 为 0 到 10 的整数，`0` 表示删除评分。
- `ep_status` 和 `vol_status` 文档限定用于书籍进度；本扩展不得用它们表示游戏游玩进度。
- `UserSubjectCollection.updated_at` 文档提示不应依赖，因此导入/同步冲突判断不使用该时间。

目录导入：

- 获取目录：`GET /v0/indices/{index_id}`。
- 获取目录条目：`GET /v0/indices/{index_id}/subjects`。
- 目录条目可用 `type` 过滤；游戏导入使用 `type=4`。
- 目录条目返回 `id`、`type`、`name`、`images`、`infobox`、`date`、`comment`、`added_at` 等字段。

条目解析与 scraper：

- Bangumi scraper provider 的条目定位以官方 subject ID 为主。
- 条目详情使用 `GET /v0/subjects/{subject_id}`。
- 搜索使用 `POST /v0/search/subjects`，过滤 `type=[4]`。
- 图片可使用 API 返回的 `images` 字段或 `GET /v0/subjects/{subject_id}/image` 的 302 location。

## 范围

In：

- 彻底重写 `extensions/bangumi` 的模块结构和设置面板。
- 使用 Bangumi OAuth 登录并刷新 token。
- 自动同步 Kisaki 游戏状态和评分到 Bangumi，状态同步和评分同步可分别开关。
- 设置面板提供手动全量同步，支持 dry run、进度、结果摘要、错误重试。
- 通过指定 scraper profile 导入用户 Bangumi 游戏数据库，支持按 Bangumi 收藏类型选择导入。
- 导入时可选映射 Bangumi 收藏类型、评分、标签等字段到 Kisaki 数据库。
- 通过指定 scraper profile 导入指定 Bangumi 目录中的游戏，支持可选目标合集。
- 用户可配置 Bangumi provider client 的 API 速率限制和重试策略；批量导入仍保持并行调度。
- 为实现上述能力补齐 Kisaki extension API 中缺失的公共能力。

Out：

- 不同步 Bangumi 章节/书籍进度到游戏进度。
- 不删除用户 Bangumi 收藏；官方 OpenAPI 未提供当前用户 subject collection 删除 endpoint。
- 不创建或编辑 Bangumi 条目、目录条目。
- 不把 Bangumi 作为所有媒体类型的统一同步源；第一版只面向游戏。
- 不保留旧 Bangumi 扩展 storage、旧 token 输入方式或旧内部模块结构。
