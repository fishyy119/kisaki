# 01 Scope And API Facts

## 目标

`extensions/bangumi` 是 media scope Bangumi 集成：

- 使用 Kisaki 官方 Bangumi 应用和已部署 OAuth Relay 登录用户自己的 Bangumi 账号。
- 支持 Bangumi `book`、`game`、`anime`、`music` 四类 subject。
- 提供高质量 Bangumi game scraper provider。
- `game` scope 提供游戏状态和评分同步，并由 game local adapter 承载。
- 支持按 media scope 拉取、预览和规划 Bangumi 收藏与目录条目。
- 对本地库写入保持严格能力检查：当前只有 `game` 能执行本地创建、补写、同步和合集关系写入。
- 提供 settings panel、extension command job、scoped TaskRun 和主应用 automation 创建入口。

## Media Scope

Bangumi 扩展内部只允许以下四类 scope：

| Scope   | Bangumi SubjectType | 默认文案 | 当前本地库能力 |
| ------- | ------------------: | -------- | -------------- |
| `book`  |                   1 | 书籍     | remote-only    |
| `game`  |                   4 | 游戏     | 完整支持       |
| `anime` |                   2 | 动漫     | remote-only    |
| `music` |                   3 | 音乐     | remote-only    |

规则：

- `BangumiMediaScope = 'book' | 'game' | 'anime' | 'music'` 是扩展内部业务轴。
- `BangumiSubjectRef` 必须同时携带 `scope`、`subjectType`、`subjectId`。
- Bangumi subject ID 仍是全局外部身份值；本地 external id 使用 `{ source: 'bangumi', id: String(subjectId) }`。
- 本地写入必须先查询 scope 是否有 `LocalMediaAdapter`。
- `book` / `anime` / `music` 不允许借用 `kisaki.library.games` 或 `kisaki.ingest.game.add.fromScraper` 写成游戏。
- 三次元和其他 Bangumi subject type 固定为 out of scope，不进入 settings、command args 或内部 union。

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

- 实现 media scope 模块结构、settings panel 和 storage/secrets schema。
- OAuth 登录、退出、验证、refresh token、账号摘要。
- Bangumi `book`、`game`、`anime`、`music` subject 查询、收藏读取、目录读取和 user collection 分页。
- `game` scope 的自动同步、全量同步、用户收藏导入、目录导入和 game scraper provider。
- `book` / `anime` / `music` scope 的账号收藏读取、目录预览、任务参数建模和 UI 空间预留。
- 可配置 Bangumi API 请求窗口、超时和重试。
- extension command job 与主应用 TaskRun / Automation 集成。

Out:

- 不新增 Bangumi 专用 extension API、extension host、SDK bridge 或桌面端公共 extension contract；长流程使用通用 `kisaki.taskRuns`，自动化使用通用 `kisaki.automations`。
- 不支持 Bangumi 三次元或其他 subject type。
- 不把书籍、动漫、音乐映射成 Kisaki 游戏实体。
- 不同步 Bangumi 章节、卷册、曲目或游戏游玩时长进度到 `ep_status` / `vol_status`。
- 不删除 Bangumi 远端收藏。
- 不创建、编辑或删除 Bangumi 条目、目录或目录条目。
- 不提供历史数据兼容迁移；开发期数据可被当前 schema normalization 覆盖。
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

收藏读取与同步:

- `GET /v0/users/{username}/collections`
- `GET /v0/users/{username}/collections/{subject_id}`
- `POST /v0/users/-/collections/{subject_id}`
- `PATCH /v0/users/-/collections/{subject_id}`
- 查询必须按 scope 注入 `subject_type`。
- Bangumi 收藏类型：`1=计划`、`2=完成`、`3=进行中`、`4=搁置`、`5=抛弃`。UI 可以按 scope 显示为想读、想玩、想看或想听。
- `rate` 为 0 到 10 的整数，`0` 表示删除评分。
- `UserSubjectCollection.updated_at` 不作为增量或是否改写本地字段的依据。

目录读取:

- `GET /v0/indices/{index_id}`
- `GET /v0/indices/{index_id}/subjects`
- 查询必须按 scope 注入 `type`。

Scraper:

- `POST /v0/search/subjects`，按 scope 过滤 `type`。
- `GET /v0/subjects/{subject_id}`。
- `GET /v0/subjects/{subject_id}/persons`。
- `GET /v0/subjects/{subject_id}/characters`。
- `GET /v0/subjects/{subject_id}/subjects`。
- `GET /v0/subjects/{subject_id}/image` 可作为图片 fallback。

## 身份规则

- `BangumiSubjectRef` 是扩展内所有 API、sync、import、planner 的身份输入。
- 本地 external id 仍使用 `{ source: 'bangumi', id: String(subjectId) }`，不把 scope 拼进 id。
- 对本地库能力来说，scope 决定使用哪个 local adapter；subject ID 只用于匹配外部身份。
- `game` 导入、同步和 scraper resolve 都先走 external id。
- `book` / `anime` / `music` 在没有 local adapter 前只能保留远端 subject ref，不写本地 library。

## 状态与评分默认映射

Bangumi collection type 是 scope 通用枚举，文案按 scope 显示：

| Type | Book | Game | Anime | Music |
| ---: | ---- | ---- | ----- | ----- |
|    1 | 想读 | 想玩 | 想看  | 想听  |
|    2 | 读过 | 玩过 | 看过  | 听过  |
|    3 | 在读 | 在玩 | 在看  | 在听  |
|    4 | 搁置 | 搁置 | 搁置  | 搁置  |
|    5 | 抛弃 | 抛弃 | 抛弃  | 抛弃  |

`game` local adapter 的默认映射：

| Kisaki status | 默认 Bangumi type | 游戏文案 |
| ------------- | ----------------: | -------- |
| `notStarted`  |                 1 | 想玩     |
| `inProgress`  |                 3 | 在玩     |
| `partial`     |                 3 | 在玩     |
| `completed`   |                 2 | 玩过     |
| `multiple`    |                 2 | 玩过     |
| `shelved`     |                 4 | 搁置     |

规则：

- 每个可本地同步的 scope 都可以有自己的 status mapping；当前只有 game mapping 生效。
- Kisaki `score` 按主应用约定以 0-100 整数存储，并显示为 0-10 一位小数；Bangumi `rate` 是 1-10 整数。
- 从 Kisaki 同步到 Bangumi 时，本地 `score` 先转换为显示分数，再写入最接近的 Bangumi `rate`。
- Bangumi `type=1` 不能保留评分；同步到 `type=1` 时必须写 `rate=0` 清除远端评分。
- 从 Bangumi 导入到 Kisaki 时，Bangumi `rate=1..10` 写为本地 `score=rate*10`；Bangumi `rate=0` 导入为 `score=null`。
- 本地空评分默认不同步为远端 `0`，除非用户启用“清除远端评分”，或本次同步目标为 `type=1`。
