# 01 Scope And API Facts

## 目标

把 `extensions/bangumi` 从内置 Bangumi game scraper 重写为综合性内置扩展：

- 使用 Kisaki 官方 Bangumi 应用和已部署 OAuth Relay 登录用户自己的 Bangumi 账号。
- 继续提供高质量 Bangumi game scraper provider。
- 支持 Kisaki 游戏状态和评分同步到 Bangumi 收藏。
- 支持导入当前 Bangumi 用户的游戏收藏。
- 支持导入指定 Bangumi 目录中的游戏。
- 支持可配置 Bangumi API 限速、重试和任务失败策略。
- 提供 settings panel、extension command job 和主应用 task 创建入口。

## 事实源

Bangumi 侧行为只以官方资料为准：

- API base URL: `https://api.bgm.tv`
- OAuth base URL: `https://bgm.tv`
- API 文档: <https://bangumi.github.io/api/>
- OpenAPI JSON: <https://bangumi.github.io/api/dist.json>
- OAuth 文档: <https://github.com/bangumi/api/blob/master/docs-raw/How-to-Auth.md>
- User-Agent 建议: <https://github.com/bangumi/api/blob/master/docs-raw/user%20agent.md>

本文在 2026-05-17 核对到 OpenAPI `info.version = 2026-05-2`。实施时如发现 OpenAPI 已更新，先调整扩展内 DTO 与本文事实表，再继续实现。

实现规则：

- `/v0/` API 使用 `Authorization: Bearer <token>` header。
- 所有非浏览器请求必须发送包含开发者身份、应用名、版本和项目主页的 User-Agent。
- OpenAPI 未定义的字段、endpoint、状态语义不得在实现中臆造。
- 扩展内 DTO 只建模实际用到的字段；网络边界要对关键字段做最小校验和容错。

## 功能范围

In:

- 重写 `extensions/bangumi` 模块结构、settings panel 和 storage/secrets schema。
- OAuth 登录、退出、验证、refresh token、账号摘要。
- 自动同步本地游玩状态和评分到 Bangumi。
- 手动全量同步，支持 dry run、过滤、是否更新远端已有收藏、结果摘要。
- 用户 Bangumi 游戏收藏导入，支持收藏类型过滤、scraper profile、目标合集、可选用户态字段写入、dry run 和结果摘要。
- Bangumi 目录导入，支持目录 ID/URL、预览、scraper profile、目标合集、dry run 和结果摘要。
- 可配置 Bangumi API 请求窗口、超时和重试。
- extension command job 与主应用 task 集成。
- 保留并提升 Bangumi scraper provider 的搜索、解析、metadata、人物、公司、角色、图片能力。

Out:

- 不同步 Bangumi 章节、书籍进度或游戏游玩时长到 Bangumi `ep_status` / `vol_status`。
- 不删除 Bangumi 远端收藏。
- 不创建、编辑或删除 Bangumi 条目、目录或目录条目。
- 不把 Bangumi 做成所有媒体类型的统一同步源；第一版只面向游戏。
- 不兼容旧实现；旧数据一律作废。
- 不在主应用新增 Bangumi 专用 OAuth service。

## Bangumi API 能力表

OAuth:

- `GET https://bgm.tv/oauth/authorize`
- `POST https://bgm.tv/oauth/access_token`
- `POST https://bgm.tv/oauth/token_status`
- 授权码有效期短，桌面端必须把授权、relay complete 和错误提示做成可恢复流程。
- refresh token 也需要官方 app secret，因此生产 refresh 同样走 Kisaki OAuth Relay。
- 扩展不直接调用 `bgm.tv/oauth/token_status`；账号验证和 token status 通过 Kisaki OAuth Relay 的 `/token-status` 完成。

账号:

- `GET /v0/me` 获取当前登录用户。
- 扩展保存账号快照用于展示和拉取 `/v0/users/{username}/collections`。

收藏同步:

- `GET /v0/users/{username}/collections`
- `GET /v0/users/{username}/collections/{subject_id}`
- `POST /v0/users/-/collections/{subject_id}`
- `PATCH /v0/users/-/collections/{subject_id}`
- 游戏条目类型为 `SubjectType = 4`。
- Bangumi 收藏类型：`1=想看`、`2=看过`、`3=在看`、`4=搁置`、`5=抛弃`；在游戏文案中显示为想玩、玩过、在玩、搁置、抛弃。
- `rate` 为 0 到 10 的整数，`0` 表示删除评分。
- `UserSubjectCollection.updated_at` 不作为增量或是否改写本地字段的依据。

目录导入:

- `GET /v0/indices/{index_id}`
- `GET /v0/indices/{index_id}/subjects`
- 游戏导入使用 `type=4` 过滤。

Scraper:

- `POST /v0/search/subjects`，过滤 `type=[4]`。
- `GET /v0/subjects/{subject_id}`。
- `GET /v0/subjects/{subject_id}/persons`。
- `GET /v0/subjects/{subject_id}/characters`。
- `GET /v0/subjects/{subject_id}/subjects`。
- `GET /v0/subjects/{subject_id}/image` 可作为图片 fallback。

## 身份规则

- Bangumi subject ID 是游戏条目的唯一稳定外部身份。
- Kisaki external id 使用 `{ source: "bangumi", id: String(subjectId) }`。
- 导入、同步和 scraper resolve 都先走 external id。
- 未绑定 Bangumi ID 的本地游戏默认跳过；用户可选择用指定 scraper profile 尝试解析。

## 状态与评分默认映射

| Kisaki status | 默认 Bangumi type | 游戏文案 |
| ------------- | ----------------: | -------- |
| `notStarted`  |                 1 | 想玩     |
| `inProgress`  |                 3 | 在玩     |
| `partial`     |                 3 | 在玩     |
| `completed`   |                 2 | 玩过     |
| `multiple`    |                 2 | 玩过     |
| `shelved`     |                 4 | 搁置     |

规则：

- 每个 Kisaki status 都可配置为任意 Bangumi type 或 `skip`。
- Bangumi `type=5` 抛弃导入默认映射到 `shelved`，也可配置为 `skip`。
- Kisaki `score` 按主应用约定以 0-100 整数存储，并显示为 0-10 一位小数；Bangumi `rate` 是 1-10 整数。
- 从 Kisaki 同步到 Bangumi 时，本地 `score` 先转换为显示分数，再写入最接近的 Bangumi `rate`。
- Bangumi `1=想玩` 收藏不能保留评分；同步到 `1=想玩` 时必须写 `rate=0` 清除远端评分。
- 从 Bangumi 导入到 Kisaki 时，Bangumi `rate=1..10` 写为本地 `score=rate*10`；Bangumi `rate=0` 导入为 `score=null`。
- 本地空评分默认不同步为远端 `0`，除非用户启用“清除远端评分”，或本次同步目标为 `1=想玩`。
