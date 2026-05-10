# 扩展发现、安装、更新、卸载分布式注册表重构设计与实施文档

本文定义 Kisaki 扩展管理系统的目标形态：以 Jellyfin 插件仓库的分布式 manifest 思路为参考，重构扩展发现、安装、更新和卸载链路。

本次重构不考虑向后兼容：旧 source provider、旧 `provider/locator` 来源模型、旧 `state.json` 状态文件、旧发现 IPC、旧安装目录布局和旧 UI 状态都直接删除，不提供迁移、桥接或降级路径。扩展运行时贡献点 API 不属于本文改造范围，除非安装状态或包路径变更需要调整运行时加载入口。

## 参考结论

Jellyfin 的插件仓库模型提供了三个值得吸收的核心点：

1. 插件仓库是用户可维护的 manifest URL 列表。官方仓库不是硬编码唯一来源，第三方仓库也可以并存。
2. 仓库 manifest 只描述插件元数据和版本列表；每个版本指向独立的二进制包 URL，并携带兼容版本、校验和、发布时间等信息。
3. 客户端聚合多个仓库，过滤不兼容版本，按插件身份合并版本，再执行下载和安装。

Kisaki 不照搬 Jellyfin 的实现细节。Kisaki 是 Electron 桌面应用，扩展包格式是 `.kisx`，版本使用 semver，扩展可执行 JavaScript 代码，因此必须补上完整性校验、作者自签名、signer 信任选择、事务安装、可回滚更新、可审计安装来源和更清晰的 UI 状态。

参考资料：

- Jellyfin 插件文档列出了官方与第三方仓库 manifest URL，并允许用户添加仓库：https://jellyfin.org/docs/general/server/plugins/
- Jellyfin 插件仓库更新说明描述了 manifest + release artifact 的分布式模型：https://jellyfin.org/posts/plugin-updates/
- Jellyfin `InstallationManager` 会读取多个仓库 manifest、过滤 `targetAbi`、合并版本并校验下载包 checksum：https://github.com/jellyfin/jellyfin/blob/master/Emby.Server.Implementations/Updates/InstallationManager.cs

## 背景

当前 Kisaki 扩展管理已经有运行时、贡献点、`.kisx` 打包和基本安装能力，但发现/安装/更新/卸载链路仍偏早期：

- `apps/desktop/src/main/services/extension/sources/` 把发现、解析、下载耦合成 provider 接口，目前 GitHub 搜索是默认发现来源。
- `ExtensionSourceLocator` 只有 `provider` 和 `locator`，无法稳定表达“来自哪个仓库 manifest、哪个 release、哪个 artifact digest、哪个 signing key”。
- `ExtensionStateStore` 把安装状态放在 `userData/extensions/state.json`，与主数据库、事务和查询能力脱节。
- `ExtensionInstaller` 直接从 source provider 解析最新版并下载，没有独立的远程仓库快照、signer trust 记录和安装来源审计。
- 发现 UI 以“选 provider 搜索”为中心，而不是以“管理仓库、浏览聚合目录、查看仓库健康状态”为中心。
- 卸载当前直接删除包、数据和临时目录，缺少“卸载包但保留数据”与“彻底清除数据”的清晰产品语义。
- 更新只问原 source 的 latest version，无法处理多仓库合并、channel、pin、yanked release、兼容范围、signing key 变化和离线缓存。

本文目标是把扩展管理重建为一个可长期维护的分布式注册表系统。

## 目标

- 用户可以添加、启用、禁用、刷新和删除扩展仓库。
- 仓库是普通 HTTPS manifest URL；官方仓库只是默认预置仓库，第三方仓库使用同一套协议。
- 发现页展示所有启用仓库聚合后的兼容扩展，而不是直接搜索 GitHub。
- 安装和更新始终基于一个明确 release，且 release 的来源、manifest digest、artifact digest、签名状态和安装时间可追溯。
- 远程 `.kisx` 必须通过 `sha256` 完整性校验；签名允许扩展作者自签，是否为该 extension 信任 signer fingerprint 由用户决定。
- 安装、更新、卸载都是事务化操作：失败时包目录、数据库状态、运行时状态和缓存不会留下半完成结果。
- 更新支持自动检查、手动更新、pin 版本、channel 策略、yanked release 过滤和兼容范围过滤。
- 卸载拆分为“卸载”和“清除数据”：卸载移除运行时代码，清除数据才删除 `data/<extension-id>`。
- 仓库配置和安装状态进入 SQLite；文件系统只保存包内容、缓存和扩展数据。
- 主进程保持唯一可信边界；renderer 只消费 DTO 和调用 `extension:*` IPC；扩展代码仍只在 extension host 运行。

## 非目标

- 不设计扩展贡献点 API。
- 不设计扩展 sandbox 权限系统。
- 不兼容旧 `state.json`、旧 source provider、旧安装目录布局或旧发现 IPC。
- 不保留旧 GitHub topic 搜索作为主要发现方式。GitHub 可以作为 manifest 或 artifact 的托管平台，但不是 Kisaki 的发现协议。
- 不允许 renderer 直接读取仓库 manifest、下载扩展包或执行扩展校验。

## 术语

| 术语              | 含义                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------- |
| Extension         | Kisaki 扩展包。用户文案可称“插件”，代码和公共类型统一使用 `Extension`。               |
| Repository        | 用户配置的扩展仓库，一个仓库对应一个 manifest URL。                                   |
| Registry manifest | 仓库 URL 返回的 JSON 文档，描述仓库元信息、扩展包和 release 列表。                    |
| Package           | 一个扩展身份，例如 `bangumi`。同一 package 可以有多个 release。                       |
| Release           | 一个 package 的某个版本，包含兼容范围、artifact、校验和、签名、发布时间和 changelog。 |
| Artifact          | 可下载的 `.kisx` 文件。一个 release 可以有多个 artifact，用于不同平台或架构。         |
| Catalog           | Main 进程聚合并规范化后的可发现扩展目录。                                             |
| Installation      | 本机某个扩展的安装记录，指向当前 active release。                                     |
| Signer trust      | 用户对某个扩展 signing key fingerprint 的本地信任选择。                               |

## 核心结论

最终模型按四层分离：

```text
Repository manifest  ->  Repository snapshot  ->  Aggregated catalog  ->  Installation
远程声明               最近成功快照             可发现目录              已安装事实
```

规则：

- 仓库 manifest 是远程事实来源，但不是安装事实来源。
- 安装事实必须由本地 SQLite 安装记录决定；不在 package 目录里维护第二份来源事实。
- 扩展运行时只加载本地 active package，不关心远程仓库是否在线。
- 更新检查只基于已缓存或刚刷新的仓库 manifest，不直接询问旧 source provider。
- 安装时选择一个具体 release 和 artifact；安装后不再用“latest”这类动态引用表达来源。
- 多个仓库出现同一扩展时，以 `extensionId` 聚合 package，以 release digest 去重，以 signer 信任状态、版本、发布时间和仓库优先级决定默认候选。

## 分布式仓库协议

### Repository URL

仓库 URL 必须是 `https:`。只有开发模式允许 `http://localhost`、`http://127.0.0.1` 和本地文件导入。

URL 指向一个 JSON manifest。manifest 可以托管在任意静态站点、GitHub raw、对象存储、CDN 或自建服务上。Kisaki 不要求仓库实现动态 API。

### Manifest Shape

新增 schema：

```text
packages/extension-api/schemas/extension-registry.schema.json
```

公共类型位置：

```text
packages/extension-api/src/registry/manifest.ts
packages/extension-api/src/registry/validation.ts
packages/extension-api/src/registry/types.ts
```

目标 manifest：

```json
{
  "$schema": "https://kisaki.dev/schemas/extension-registry.schema.json",
  "schemaVersion": 1,
  "id": "kisaki.official",
  "name": "Kisaki Official Extensions",
  "description": "Official Kisaki extensions.",
  "homepage": "https://kisaki.dev/extensions",
  "updatedAt": "2026-05-10T00:00:00.000Z",
  "signingKeys": [
    {
      "id": "kisaki-official-2026",
      "algorithm": "ed25519",
      "publicKey": "base64-public-key"
    }
  ],
  "packages": [
    {
      "id": "bangumi",
      "name": "Bangumi",
      "summary": "Bangumi metadata and sync integration.",
      "description": "Provides scraper providers, settings panels, and sync tasks for Bangumi.",
      "categories": ["scraper", "integration"],
      "keywords": ["bangumi", "metadata", "sync"],
      "owner": {
        "name": "Kisaki",
        "url": "https://kisaki.dev"
      },
      "homepage": "https://github.com/kisaki-dev/kisaki",
      "repository": "https://github.com/kisaki-dev/kisaki",
      "license": "MIT",
      "icon": {
        "url": "https://example.com/bangumi/icon.png",
        "sha256": "hex-sha256"
      },
      "releases": [
        {
          "version": "1.2.0",
          "channel": "stable",
          "publishedAt": "2026-05-10T00:00:00.000Z",
          "engines": {
            "kisaki": ">=0.0.3 <0.1.0"
          },
          "changelog": {
            "text": "Improve matching and settings.",
            "url": "https://example.com/bangumi/releases/1.2.0"
          },
          "yanked": false,
          "artifacts": [
            {
              "target": "any",
              "url": "https://example.com/bangumi/bangumi-1.2.0.kisx",
              "size": 123456,
              "sha256": "hex-sha256",
              "signature": {
                "keyId": "kisaki-official-2026",
                "algorithm": "ed25519",
                "value": "base64-signature"
              }
            }
          ]
        }
      ]
    }
  ]
}
```

### Manifest 字段规则

Repository：

- `schemaVersion` 固定为 `1`。
- `id` 使用与扩展 id 相同风格的点分 kebab 标识，必须在本机仓库列表中唯一。
- `name` 为 UI 展示名。
- `updatedAt` 必须是 ISO 8601 UTC 时间，用于缓存展示，不用于安全判断。
- `signingKeys` 可为空。仓库可以声明一个或多个作者自签名 public key，Kisaki 只验证签名是否匹配，不替用户判断第三方 key 是否可信。
- 未知字段默认拒绝，避免 manifest 漂移。

Package：

- `id` 必须符合 `isExtensionIdentifier`。
- `name`、`summary`、`categories` 必填。
- `description` 可以较长，用于详情页。
- `categories` 复用 `ExtensionCategory`。
- `icon.url` 必须是 `https:`；`icon.sha256` 推荐提供，官方仓库必须提供。
- `releases` 至少包含一个 release。

Release：

- `version` 必须是 semver。
- `channel` 为 `stable`、`beta`、`nightly` 或自定义字符串；UI 默认只显示 `stable`。
- `engines.kisaki` 必须是 semver range。
- `publishedAt` 必须是 ISO 8601 UTC 时间。
- `yanked: true` 表示不再用于新安装和自动更新，但已安装版本仍可显示来源。
- `artifacts` 至少包含一个 artifact。
- release 在 manifest 中不需要人工维护 id；客户端使用规范化 release identity 的 `sha256` 作为 `releaseDigest`，并把它作为本地 `releaseId`。
- `releaseDigest` 只标识可安装内容和安装策略相关身份，不标识仓库展示元数据。参与 digest 的字段固定为：`schemaVersion`、`packageId`、`version`、`channel`、`engines.kisaki`、每个 artifact 的 `target`、`size`、`sha256`、签名算法、signer fingerprint 和 signature value。`repositoryId`、`repositoryUrl`、artifact `url`、`publishedAt`、`changelog`、`yanked`、package 展示字段不参与 digest。
- 规范化 JSON 使用稳定规则：对象 key 按字典序排序，数组按协议语义排序；artifact 数组按 `target`、`sha256`、signer fingerprint 排序；所有字符串保留原值但去除协议明确要求去除的首尾空白；缺省可选字段不写入 canonical payload。

Artifact：

- `target` 为 `any` 或 `${platform}-${arch}`，例如 `win32-x64`、`darwin-arm64`。
- `url` 必须是 `https:`，开发模式例外。
- `size` 必须大于 0，并用于下载预算和 UI 展示。
- `sha256` 必填。
- `signature` 可选但推荐。若提供签名，Kisaki 必须验证；若没有签名，安装计划必须标记为 unsigned 并要求用户确认。
- 签名覆盖 artifact identity envelope，而不是只覆盖下载 URL，也不是只覆盖裸 `sha256` 字符串。artifact URL 可以因镜像变化而不同；签名必须绑定扩展身份、版本、兼容范围、channel、target、size 和 artifact bytes digest。

签名 payload 使用 canonical JSON：

```json
{
  "kind": "kisaki-extension-artifact-signature",
  "schemaVersion": 1,
  "extensionId": "bangumi",
  "version": "1.2.0",
  "channel": "stable",
  "engines": {
    "kisaki": ">=0.0.3 <0.1.0"
  },
  "target": "any",
  "size": 123456,
  "sha256": "hex-sha256"
}
```

签名不覆盖 `repositoryId`、仓库 URL、artifact URL、`publishedAt`、`changelog` 或 `yanked`。这些字段由 manifest schema 和安装计划展示约束，但不参与作者身份连续性判断。

## 兼容性与候选版本选择

候选 release 必须同时满足：

- `release.yanked !== true`，除非用户明确选择安装已撤回版本。
- `semver.satisfies(app.getVersion(), release.engines.kisaki)`。
- 存在与当前平台匹配的 artifact；优先精确平台，后退到 `any`。
- artifact 完整性字段齐全。
- release 所在仓库状态为 `enabled`。
- signer trust 允许该 release 被自动安装/更新，或安装计划要求用户确认未信任风险。

默认更新候选：

1. 与当前安装 channel 相同。
2. 版本号大于当前版本。
3. 兼容当前 Kisaki。
4. 非 yanked。
5. 优先选择 signer 已被当前 extension 信任的 release。
6. 仓库优先级最高；同优先级时版本最高；同版本时发布时间最新；仍相同则 repository id 字典序稳定排序。

用户可以在详情页切换 channel、固定版本或手动选择旧版本。自动更新永远不跨 channel，除非用户明确修改策略。

## 信任与安全模型

签名不是中心化审核机制。Kisaki 允许扩展作者自签名，软件本身只负责验证签名数学上是否正确，并把 signing key fingerprint、仓库 URL、artifact URL 和风险状态展示给用户。安全模型只保留一层信任：用户是否信任某个 extension 的 signing key fingerprint。仓库本身只有启用、禁用和阻止状态，不表达“可信”。

### 机制说明

`sha256` 用于验货，签名用于认人：

1. 扩展作者生成 Ed25519 key pair。
2. 作者发布 `.kisx` 时计算 artifact 的 `sha256` 和 size。
3. 作者用 private key 对 artifact identity envelope 签名。
4. 仓库 manifest 公开 artifact identity 字段、signature 和 public key。
5. Kisaki 下载 `.kisx` 后重新计算 `sha256`。
6. `sha256` 不一致时直接拒绝安装。
7. `sha256` 一致时，如果 manifest 提供 signature，Kisaki 按 manifest 和包内 manifest 重新构造 artifact identity envelope，并用 public key 验证 signature 是否确实签了这个 envelope。
8. 签名验证成功只说明“拥有对应 private key 的人签过这个包”，不说明这个人一定可信。
9. 用户可以为该 extension 信任这个 key fingerprint。后续更新如果仍由同一个 key 签名，Kisaki 可以认为该 extension 的作者身份连续。

### 默认策略

- 仓库配置只决定是否参与刷新和展示：`enabled`、`disabled`、`blocked`。
- 官方仓库只是应用内置的默认仓库配置，不是安全信任等级。若官方 release 需要免确认安装，应用内置对应 extension-scoped signer fingerprint，并通过同一套 signer trust 判断。
- 第三方仓库添加后默认可浏览、可安装；安装未信任 signer、unsigned release 或 signer changed 时必须展示确认。
- 所有远程 artifact 必须校验 `sha256`。
- 签名可选。若存在签名，验证失败必须拒绝安装；若没有签名，安装计划标记为 unsigned。
- 下载 URL 的 hostname 与仓库 URL hostname 可以不同，但安装计划必须展示 artifact host。
- 自动更新只允许使用当前 extension 已信任 signer 签名的 release。unsigned 或 signer changed 的更新只能手动确认。

### Signer Trust

```ts
export interface ExtensionTrustedSigner {
  id: string
  extensionId: string
  fingerprint: string
  algorithm: 'ed25519'
  publicKey: string
  label?: string
  trustedAt: Date
  trustedFromRepositoryId?: string
  trustedFromRepositoryUrl?: string
}
```

规则：

- signer trust 是 extension-scoped：信任 `bangumi` 的某个 fingerprint，不会自动信任其它 extension。
- fingerprint 使用 public key 原始 bytes 的 `sha256` hex。`keyId` 只用于在 manifest 中查找 public key，不参与信任判断。
- `signed + fingerprint 已被该 extension 信任`：允许自动更新。
- `signed + fingerprint 未被该 extension 信任`：允许手动安装/更新，确认后可以写入 trusted signer。
- `signed + fingerprint 与当前已安装版本不同`：视为 signer changed，必须手动确认。
- `unsigned remote release`：允许手动安装，永远不能自动更新。
- 仓库 manifest 被篡改时，攻击者无法伪造已信任 key 的签名；如果换成 unsigned 或新 key release，会被安装计划挡在手动确认前。

### Package Verification

安装时按顺序校验：

1. Repository manifest schema。
2. Release compatibility。
3. Artifact URL、size、sha256。
4. 下载文件大小不超过 manifest 声明和全局上限。
5. 下载文件 `sha256` 等于 manifest。
6. 如果 manifest 提供签名，签名必须能被对应 public key 对 artifact identity envelope 验证通过。
7. 如果 signer 未被当前 extension 信任，安装计划必须要求用户确认；自动更新必须跳过。
8. `.kisx` zip 条目通过 path confinement 校验，不允许绝对路径、`..`、空路径、Windows 设备名和重复规范路径。
9. 包内 `manifest.json` 通过现有 `parseExtensionManifest`。
10. 包内 manifest 的 `id`、`version`、`categories` 与 registry package/release 兼容：

- `id` 必须完全一致。
- `version` 必须完全一致。
- `categories` 必须与 registry package 的 `categories` 作为集合完全一致；比较前去重并按字典序排序，数组原始顺序不参与判断。
- `engines.kisaki` 必须与 registry release 中的 `engines.kisaki` 去除首尾空白后完全一致；v1 不做 semver range 子集判断。

11. `entry` 文件必须存在；包内 manifest 声明了 `icon` 时，该 icon 文件必须存在。

## 本地状态模型

v1 新增三张核心表：仓库表、安装表和 trusted signer 表。远程 catalog 不单独建表，而是从 `extension_repositories.manifest_snapshot` 动态聚合。这里的 snapshot 不是一套额外缓存系统，而是“最近一次成功抓取并解析的仓库 manifest”。它用于启动时快速展示、仓库离线时继续浏览、更新检查和安装来源审计。扩展数量和仓库数量在可预期范围内不会大到需要复杂索引；未来如果要做评分、排行榜或全文搜索，再新增可重建的 catalog index 表。

删除 `ExtensionStateStore` 和 `state.json`。新系统只以 SQLite installation 记录作为本机安装事实，不读取、不迁移、不回写旧状态文件。

Schema 文件：

```text
apps/desktop/src/shared/db/schema.ts
apps/desktop/src/shared/db/schema-relations.ts
apps/desktop/src/shared/db/table-names.ts
apps/desktop/drizzle/
```

所有新增表都必须有 `id` 列，以符合现有 `TriggerStore` 对被跟踪 Drizzle 表的约束。`extension_installations.id` 直接使用扩展 id，不再额外保留 `extension_id`。

### Tables

#### `extension_repositories`

| 字段                | 类型                       | 说明                                                                                  |
| ------------------- | -------------------------- | ------------------------------------------------------------------------------------- |
| `id`                | text primary key           | 本机仓库 id。官方仓库固定，第三方仓库可用 manifest id；冲突时生成本地 id。            |
| `url`               | text unique                | manifest URL。                                                                        |
| `name`              | text                       | 展示名，来自 manifest 或用户输入。                                                    |
| `state`             | text                       | `enabled`、`disabled`、`blocked`。                                                    |
| `built_in`          | integer boolean            | 是否为应用预置仓库。预置仓库不是安全信任等级，只表示来源由应用内置。                  |
| `priority`          | integer                    | 聚合排序。官方仓库默认 0，第三方按添加顺序递增。                                      |
| `manifest_snapshot` | json text nullable         | 最近一次成功解析后的规范化 manifest，用于启动展示、离线浏览、更新检查和安装来源审计。 |
| `last_refresh_at`   | integer timestamp nullable | 最近刷新时间。                                                                        |
| `last_success_at`   | integer timestamp nullable | 最近成功刷新时间。                                                                    |
| `last_error`        | text nullable              | 最近失败摘要。                                                                        |
| `manifest_digest`   | text nullable              | 最近成功 manifest 的 sha256。                                                         |
| `etag`              | text nullable              | HTTP cache validator。                                                                |
| `last_modified`     | text nullable              | HTTP cache validator。                                                                |
| `created_at`        | integer timestamp          | 创建时间。                                                                            |
| `updated_at`        | integer timestamp          | 更新时间。                                                                            |

Repository state 规则：

- `enabled`：参与刷新、展示和 catalog 聚合。
- `disabled`：保留配置和 snapshot，但不刷新、不参与 catalog 聚合。
- `blocked`：不刷新、不展示、不参与 catalog 聚合；用于用户明确阻止某个仓库。
- 官方仓库通过 `built_in`、固定 `id` 和默认 `priority` 表达预置来源，不表达安全信任。

Catalog 查询规则：

- Main 从所有 `state = enabled` repository 的 `manifest_snapshot` 动态聚合 catalog。
- 聚合结果可以保存在内存中，随仓库刷新或安装状态变更重建。
- 搜索、过滤和排序优先在内存聚合结果上完成；不为 v1 新增 catalog package/release 表。
- 仓库离线时使用最近成功的 `manifest_snapshot`。

#### `extension_installations`

| 字段             | 类型              | 说明                                                             |
| ---------------- | ----------------- | ---------------------------------------------------------------- |
| `id`             | text primary key  | 扩展 id。DB 层统一使用 `id`，服务和 DTO 层映射为 `extensionId`。 |
| `enabled`        | integer boolean   | 是否期望运行。                                                   |
| `version`        | text              | 当前安装版本。                                                   |
| `source`         | json text         | 安装来源，使用 `ExtensionInstallationSource` custom type。       |
| `install_reason` | text              | `manual`、`update`、`local-file`。                               |
| `update_policy`  | text              | `manual`、`notify`、`auto`、`pinned`。                           |
| `pinned_version` | text nullable     | 固定版本。                                                       |
| `channel`        | text              | 更新 channel。                                                   |
| `installed_at`   | integer timestamp | 首次安装时间。                                                   |
| `updated_at`     | integer timestamp | 最近状态更新时间。                                               |

`extension_installations` 只记录本机 active package 的持久事实和用户策略，不记录内存性质或启动时可重新计算的临时状态。因此不新增 `status`、`last_error`、`integrity_state` 这类字段。缺包、manifest 无效、runtime failed 等状态由 `ExtensionInstallationCatalog` 启动或刷新时动态计算，作为 installed DTO 的 `status`、`issues`、`runtimeStatus`、`runtimeError` 返回 renderer。

active package 路径不存入 DB。`extension_installations.id` 是唯一持久安装身份，`ExtensionPackageLayout` 只能从该 id 派生 `packages/<extension-id>`，并在每次读取时执行 path confinement。这样 DB 中不存在可被篡改为任意绝对路径的加载入口，Runtime 也不会直接信任持久化 path 字符串。

`source` 使用 Drizzle `customType` 序列化为 JSON text，而不是拆成多个 `source_*` 列。原因是安装来源在业务上是一个整体对象；更新检查、安装详情和审计展示都会读取完整 installation 后在 TypeScript 中判断，不依赖 SQL 对单个 source 子字段建索引。若未来需要按仓库做大规模 SQL 统计或索引，再新增可派生列或独立索引表，不让 v1 表结构提前膨胀。`ExtensionInstallationSource` 类型和 parser 放在 shared 边界，例如 `apps/desktop/src/shared/extension-installation-source.ts` 或 `apps/desktop/src/shared/extension.ts`；`apps/desktop/src/shared/db/custom-types.ts` 只引用 shared parser，main 侧服务也复用同一个 parser。shared/db 不允许反向依赖 `apps/desktop/src/main/**`。无效 source 由 `ExtensionInstallationCatalog` 作为动态 issue 暴露，不写回临时状态字段。

```ts
export type ExtensionInstallationSource =
  | {
      kind: 'repository'
      repositoryId: string
      repositoryUrl: string
      releaseId: string
      manifestDigest: string
      artifact: {
        url: string
        sha256: string
      }
      signature?: {
        keyId?: string
        fingerprint: string
      }
    }
  | {
      kind: 'local-file'
      path: string
      artifactSha256: string
    }
```

#### `extension_trusted_signers`

| 字段                          | 类型              | 说明                                                                       |
| ----------------------------- | ----------------- | -------------------------------------------------------------------------- |
| `id`                          | text primary key  | 本地 trusted signer id，可由 `${extension_id}:${fingerprint}` 稳定生成。   |
| `extension_id`                | text              | 信任范围对应的扩展 id。                                                    |
| `fingerprint`                 | text              | signing public key fingerprint，使用 public key 原始 bytes 的 sha256 hex。 |
| `algorithm`                   | text              | v1 固定为 `ed25519`。                                                      |
| `public_key`                  | text              | base64 public key，用于展示、复核和后续验证。                              |
| `label`                       | text nullable     | 用户或内置配置提供的展示名。                                               |
| `trusted_from_repository_id`  | text nullable     | 首次信任时的仓库 id。                                                      |
| `trusted_from_repository_url` | text nullable     | 首次信任时的仓库 URL。                                                     |
| `trusted_at`                  | integer timestamp | 信任时间。                                                                 |
| `created_at`                  | integer timestamp | 创建时间。                                                                 |
| `updated_at`                  | integer timestamp | 更新时间。                                                                 |

约束：

- `unique(extension_id, fingerprint)`。
- signer trust 不从 repository 派生；仓库是否预置、启用或阻止都不改变 signing key 是否被信任。
- 移除 trusted signer 后，后续自动更新会跳过该 signer 签名的 release，但已安装版本不会被自动卸载。

## 文件系统布局

删除旧布局：

```text
userData/extensions/packages/<extension-id>/
userData/extensions/state.json
```

目标布局：

```text
userData/extensions/
  packages/
    <extension-id>/
      manifest.json
      dist/
      README.md
  data/
    <extension-id>/
      storage.json
      secrets.json
      ...
  temp/
    runtime/
      <extension-id>/
        ...
    operations/
      downloads/
        <operation-id>.kisx
      staging/
        <operation-id>/
      backups/
        <operation-id>/
      trash/
        <operation-id>/
```

`temp/runtime/<extension-id>` 是 extension runtime 暴露给扩展的临时目录，生命周期属于该扩展的数据域。`temp/operations/*` 是安装、更新、卸载的事务目录，生命周期属于单次 operation。

安装、更新、卸载的事务目录使用 `userData/extensions/temp/operations`，不使用 OS temp。原因是 staging、backup 和 trash 会参与 package 目录替换和回滚，必须尽量与 `packages/` 位于同一卷，避免跨盘 move 退化为 copy/delete。

Active package 不使用 symlink，也不在 DB 中保存绝对 package path。`ExtensionInstallationCatalog` 从 `extension_installations.id` 和 `ExtensionPackageLayout` 派生 `packages/<extension-id>`，校验包内 manifest 后创建 `ExtensionRuntimeMetadata`。

更新时先完成下载、校验和解压 staging；进入提交阶段后再 unload 当前 runtime，把旧 package 目录移动到 `temp/operations/backups/<operation-id>`，新包加载成功后删除 backup；如果安装或 runtime activation 失败，再把 backup 移回原路径。v1 不保留多版本历史，也不提供长期回滚列表。

未安装扩展的远程图标不由 renderer 直接访问外网。v1 使用 main 进程图标代理或轻量缓存：renderer 请求 catalog DTO 中的 app-local icon URL，main 负责按 manifest `icon.url` 拉取、限制大小、校验可选 `icon.sha256`、设置缓存 TTL，并在失败时返回占位图。这样 discovery UI 不泄露 renderer 直连网络行为，也保留后续离线图标演进空间。

## Package Source Record

v1 不在 package 目录中写入额外的来源文件。安装来源只记录在 `extension_installations.source` 中：

- repository 安装写入 `kind = repository`、repository id/url、manifest digest、release digest、artifact URL、artifact sha256、signature key id 和 signer fingerprint。
- 本地文件安装写入 `kind = local-file`、原始文件路径和 artifact sha256，并设置 `install_reason = local-file`。
- trusted signer 选择写入 `extension_trusted_signers`，不复制到 package 目录。

原因：

- package 目录内的来源文件会与 SQLite `source` 字段重复，但又不是唯一可信事实。
- 如果用户或外部程序能改 package 目录，也能改同目录来源文件；它不能提供额外安全性。
- Runtime 加载只需要 DB installation id、由 layout 派生的 active package、包内 manifest、entry/可选 icon 校验和 enabled 状态。
- DB 丢失时 v1 不自动从 package 目录恢复安装记录；孤儿 package 只作为动态 catalog issue 展示，用户可以卸载或重新安装。

## Main Process 文件组织

目标目录：

```text
apps/desktop/src/main/services/extension/
  service.ts
  ipc.ts
  types.ts
  repositories/
    index.ts
    manager.ts
    fetcher.ts
    manifest.ts
    aggregate.ts
    types.ts
  signers/
    index.ts
    store.ts
    trust.ts
    types.ts
  installations/
    index.ts
    store.ts
    catalog.ts
    metadata.ts
    types.ts
  packages/
    index.ts
    manifest.ts
    layout.ts
    downloader.ts
    icon.ts
    operations.ts
    verifier.ts
    extractor.ts
    transaction.ts
    types.ts
  installer/
    index.ts
    manager.ts
    install-plan.ts
    update-planner.ts
    uninstall.ts
    types.ts
  runtime/
    ...
  capabilities/
    ...
  contributions/
    ...
  shared/
    path-confinement.ts
```

删除目录：

```text
apps/desktop/src/main/services/extension/sources/
```

类命名：

| 类                                     | 职责                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `ExtensionRepositoryManager`           | 管理仓库配置、刷新、manifest snapshot 和 catalog 聚合。                                                      |
| `ExtensionRepositoryFetcher`           | HTTP 抓取 manifest，处理 ETag、Last-Modified、超时和大小限制。                                               |
| `ExtensionRepositoryAggregator`        | 将启用仓库的 manifest snapshot 合并为内存 catalog。                                                          |
| `ExtensionSignerTrustManager`          | 计算 fingerprint，并应用 extension-scoped signer trust。                                                     |
| `ExtensionTrustedSignerStore`          | 读写 `extension_trusted_signers`。                                                                           |
| `ExtensionInstallationStore`           | 读写 `extension_installations`，取代旧 `ExtensionStateStore`。                                               |
| `ExtensionInstallationCatalog`         | 聚合 built-in、安装记录、package manifest 和 runtime 状态，输出 installed 列表。                             |
| `ExtensionInstallationMetadataFactory` | 从 installation、built-in 和 dev 记录创建 `ExtensionRuntimeMetadata`，实现放在 `installations/metadata.ts`。 |
| `ExtensionPackageLayout`               | 统一解析 packages、data、temp 路径。                                                                         |
| `ExtensionPackageInstaller`            | 安装、更新、卸载的门面。                                                                                     |
| `ExtensionPackageDownloader`           | 下载 `.kisx` 到 temp。                                                                                       |
| `ExtensionPackageOperationRegistry`    | 在内存中跟踪正在运行的 install/update operation，并保存下载阶段的 `AbortController`。                        |
| `ExtensionIconManager`                 | 由 main 代理 catalog 图标下载、大小限制、可选 sha256 校验和本地 URL 映射；实现放在 `packages/icon.ts`。      |
| `ExtensionPackageVerifier`             | 校验 sha256、签名、zip 安全和包内 manifest。                                                                 |
| `ExtensionPackageExtractor`            | 解压到 staging 并验证文件存在。                                                                              |
| `ExtensionPackageTransaction`          | 文件系统和数据库事务协调。                                                                                   |
| `ExtensionUpdatePlanner`               | 选择更新候选和解释不可更新原因。                                                                             |

`ExtensionService` 保持 main-process facade，只编排这些 helper，不放复杂业务逻辑。`extension/` 根目录只保留服务门面、IPC 注册和共享类型；远程仓库、已安装状态、本地包文件系统和安装编排必须分别进入 `repositories/`、`installations/`、`packages/` 和 `installer/`。

## Public Types 与 Shared DTO

### Extension API Registry Types

`packages/extension-api/src/registry/`：

```text
registry/
  index.ts
  manifest.ts
  validation.ts
  artifact.ts
  integrity.ts
```

`artifact.ts` 只处理 artifact 层职责：artifact target 解析、当前平台匹配、精确 target 与 `any` 的优先级选择，以及 artifact URL、size、sha256 等基础字段辅助校验。release `engines.kisaki`、channel、yanked、pin、signer trust 和更新候选排序不放在这里。

导出：

```ts
export interface ExtensionRegistryManifest
export interface ExtensionRegistryPackage
export interface ExtensionRegistryRelease
export interface ExtensionRegistryArtifact
export interface ExtensionRegistrySigningKey
export interface ParsedExtensionRegistryManifest

export function parseExtensionRegistryManifest(value: unknown): ParsedExtensionRegistryManifest
export function selectExtensionArtifactForTarget(...)
export function getExtensionReleaseDigest(...)
```

这些类型是 registry manifest 协议的一部分，可以被 CLI、官网发布工具和 desktop 主进程共同使用。

### Shared Renderer DTO

`apps/desktop/src/shared/extension.ts` 中新增或替换以下 DTO：

```ts
export interface ExtensionRepositoryInfo
export interface ExtensionRepositoryCreateRequest
export interface ExtensionRepositoryUpdateRequest
export interface ExtensionRepositoryRefreshResult
export interface ExtensionCatalogPackageInfo
export interface ExtensionCatalogReleaseInfo
export interface ExtensionCatalogArtifactInfo
export interface ExtensionInstallRequest
export interface ExtensionInstallPlan
export interface ExtensionInstalledPackageInfo
export interface ExtensionUpdateCandidateInfo
export interface ExtensionUninstallRequest
export interface ExtensionTrustedSignerInfo
```

删除：

```ts
export interface ExtensionSourceReference
export interface ExtensionRegistryEntry
```

`ExtensionCatalogInfo` 改名为：

```ts
export interface ExtensionInstalledPackageInfo
```

原因：旧 `ExtensionCatalogInfo` 实际表示已安装扩展，不是远程 catalog；新系统中 catalog 特指聚合后的远程可发现目录。

shared DTO 和 shared DB custom type 的边界规则：

- `ExtensionInstallationSource`、`parseExtensionInstallationSource` 和相关 type guard 放在 shared 层，供 DB custom type、main service 和 renderer DTO mapper 共用。
- shared 层只能依赖 `@kisaki/extension-api` 和 shared helper，不允许导入 main service、Electron 或 Node-only 文件系统模块。
- main service 负责把 shared source 解释为业务动作；shared parser 只负责结构和基本字段合法性。

## IPC 设计

删除旧 IPC：

```text
extension:get-sources
extension:search
extension:install(source)
```

新增 IPC：

```text
extension:list-repositories
extension:add-repository
extension:update-repository
extension:remove-repository
extension:refresh-repository
extension:refresh-repositories
extension:list-trusted-signers
extension:remove-trusted-signer

extension:search-catalog
extension:get-catalog-package
extension:list-catalog-releases

extension:create-install-plan
extension:install-release
extension:install-from-file
extension:uninstall
extension:purge-data
extension:check-updates
extension:update
extension:update-all
extension:set-update-policy
extension:cancel-operation

extension:get-installed-packages
```

Main to renderer events：

```text
extension:repositories-changed
extension:catalog-changed
extension:installations-changed
```

保留贡献点相关事件：

```text
extension:contributions-changed
extension:settings-panels-refresh-requested
extension:entity-menus-refresh-requested
```

IPC handler 规则：

- `ipc.ts` 只做输入校验、调用 `ExtensionService`、返回 `IpcResult`。
- 复杂校验函数放在 `repositories/manifest.ts`、`packages/verifier.ts` 或 `shared` helper。
- 所有 DTO 必须可序列化。
- Main 不展示安装、更新、卸载确认 UI，也不调用 Electron 系统原生 dialog。Main 只返回 install/update plan、风险项和校验结果；确认交互由 renderer 的业务 dialog 完成。
- v1 不持久化安装任务状态。安装、更新、卸载是互斥的异步 IPC 调用；需要更细粒度进度时，后续可接入已有 `BackgroundTaskService`。崩溃恢复不依赖额外 JSON 任务记录，而是由 `ExtensionPackageTransaction` 按 DB installation、package 目录、backup/trash/staging 目录执行确定性恢复。
- 下载必须可中断。`install-release` 和 `update` request 携带 `operationId`，main 在等待 mutation mutex 前创建 operation record，并用 `ExtensionPackageOperationRegistry` 保存 `AbortController`。
- `extension:cancel-operation(operationId)` 不获取 extension mutation mutex，只标记 abort 并中断当前可取消阶段。
- 可取消阶段：等待 mutation mutex、下载、hash 计算和解压前准备。不可取消阶段：文件移动、SQLite transaction、runtime reconcile；进入不可取消阶段后只能完成或失败回滚。
- 安装相关 temp 使用 `userData/extensions/temp/operations` 下的 `downloads`、`staging`、`backups` 和 `trash` 结构。每次操作在 `finally` 中清理本 operation 目录；应用启动时执行一次 transaction recovery，再 prune stale downloads/staging，并按 DB 和 package 目录复核 backups/trash。

Transaction recovery 规则：

- 下载、hash、解压属于可取消阶段，只允许留下 `downloads/` 或 `staging/` 临时文件；启动恢复可以直接删除。
- 提交阶段不写额外 operation JSON。`ExtensionPackageTransaction` 的内存 rollback context 只在当前进程内用于失败回滚；应用崩溃后不尝试恢复内存意图。
- 启动恢复以 SQLite installation 为事实来源：DB 记录存在且 `packages/<id>` manifest 与 DB version 一致时，视为 committed，清理同 extension 的 stale backup。
- DB 记录存在但 `packages/<id>` 缺失或无效时，如果 `backups/*` 中存在同 extension 且版本等于 DB version 的有效包，则恢复该 backup；否则 installed catalog 返回 missing/invalid issue，Runtime 不加载。
- DB 记录不存在但 `packages/<id>` 存在时，视为 orphan package，不自动安装、不自动删除，由 installed catalog 暴露 issue。
- `backups/*` 中的包如果对应 extension 已有有效 active package，直接清理；`trash/*` 中的包如果 DB 已无对应 installation，直接清理。
- 如果 DB 已提交新版本且 package 有效，即使崩溃发生在 runtime reconcile 前，启动后也按已安装版本加载；runtime 启动失败作为 runtime status/issue 暴露，不做跨进程自动回滚。
- 签名、sha256、包内 manifest 仍必须从 manifest snapshot、安装记录和 package 文件重新校验；backup/trash/staging 目录从不作为安全信任来源。

## 发现流程

启动流程：

1. `ExtensionService.init()` 初始化 DB、paths、runtime、repositories、installer。
2. `ExtensionPackageTransaction` 执行启动恢复，保证 package 目录和 DB installation 尽量重新一致。
3. `ExtensionRepositoryManager` 确保官方仓库存在。
4. 读取 `state = enabled` repositories。
5. 使用最近成功 manifest snapshot 重建 catalog。
6. 异步触发后台刷新，刷新成功后重建 catalog 并发送 `extension:catalog-changed`。
7. `RuntimeManager` 只根据 installed packages 的 active package 加载扩展，不等待远程刷新。

手动刷新：

1. 用户点击刷新仓库或全部刷新。
2. Fetcher 使用 ETag / Last-Modified。
3. 304 时只更新时间，不重建 manifest。
4. 200 时限制响应大小，解析 JSON，校验 schema，计算 digest。
5. 将规范化 manifest 写入 `extension_repositories.manifest_snapshot`。
6. Aggregator 从所有 `state = enabled` repository 的 manifest snapshot 重建内存 catalog。
7. 发送 repository 和 catalog 事件。

搜索 catalog：

- 查询内存聚合 catalog，必要时回退读取 `extension_repositories.manifest_snapshot` 重建。
- 支持 query、category、channel、repository、compatibleOnly、installedOnly、hasUpdateOnly。
- 排序支持 relevance、name、updatedAt、publishedAt、repositoryPriority。
- 搜索不访问网络。

## 安装流程

`extension:create-install-plan`：

1. 输入 `extensionId`、可选 `releaseId`、可选 `repositoryId`。
2. 从 catalog 查找候选 release。
3. 选择兼容 artifact。
4. 检查是否已安装、是否版本相同、是否降级、是否跨 channel。
5. 检查 sha256、签名状态和 extension-scoped signer trust。
6. 返回计划和需要用户确认的风险：
   - artifact host 与 repository host 不同。
   - 降级。
   - yanked release。
   - unsigned remote release。
   - signer 未被当前 extension 信任。
   - signer 与当前已安装版本不同。

安装确认必须由 renderer 完成：

- Renderer 调用 `extension:create-install-plan`。
- Renderer 使用 `@renderer/features/extension/components/install-dialog/` 展示版本、仓库、artifact host、sha256、签名状态、权限/风险和更新策略。
- 用户确认后，renderer 调用 `extension:install-release` 并携带 `acceptedRiskIds`、`trustSignerFingerprint` 等显式确认字段。
- Main 校验确认字段是否覆盖当前 plan 中的风险；若 plan 已变化，拒绝安装并要求 renderer 重新获取 plan。
- 不再使用主进程 Electron 原生确认 dialog。系统原生 dialog 只保留给选择本地 `.kisx` 文件这类 OS 文件选择场景。

`extension:install-release`：

1. 用 request 中的 `operationId` 创建 operation record 和 `AbortController`。
2. 等待全局 extension mutation mutex；等待期间如果 operation 已取消，直接退出。
3. 再次读取 catalog release，防止 UI 使用过期计划。
4. 如果 release 带有未信任 signer、unsigned、降级等风险，要求 request 携带用户确认标记。
5. 下载 artifact 到 `temp/operations/downloads/<operation-id>.kisx`；如果收到 `extension:cancel-operation`，下载中断并清理临时文件。
6. 校验 size、sha256；如果提供 signature，则按 artifact identity envelope 验证 signature。
7. 解压到 `temp/operations/staging/<operation-id>/package`。
8. 校验包内 manifest、entry、可选 icon 和 package id/version。
9. 准备目标目录 `packages/<id>`。
10. 进入不可取消提交阶段，创建内存 rollback context。
11. 如果目标目录已存在，先移动到 `temp/operations/backups/<operation-id>`。
12. 将 staging package 原子移动到目标目录。
13. 在 SQLite transaction 中写 `extension_installations`；如果用户选择信任 signer，同时写入 `extension_trusted_signers`。
14. 如果安装后应启用，调用 `RuntimeManager.reconcile()`。
15. 如果当前进程内发生 runtime failed，使用内存 rollback context 回滚 DB 和文件；如果用户选择“安装但保持禁用”，则写安装记录但不启用。
16. 清理 backup/download/staging。
17. 发送 `extension:installations-changed` 和 contribution snapshot 事件。

安装成功只说明：

- 包已落盘。
- DB active version 已指向该包。
- 如果启用，运行时已加载成功。

安装失败必须保证：

- active package 仍指向旧版本或不存在。
- DB 不记录半安装版本。
- Runtime 不加载 staging 目录。
- temp 可以遗留可清理目录，但不会影响 catalog 或运行时。

## 本地文件安装

`extension:install-from-file` 仍保留，但语义变为“导入本地 `.kisx`”。

规则：

- 不走 repository catalog。
- 仍先创建 install plan，和远程安装共用风险确认、验证、解压、事务和 runtime reconcile 流程。
- 必须计算 `sha256`。
- 允许 unsigned，但 UI 明确显示“本地 unsigned”。
- 默认 update policy 为 `manual`。
- source kind 为 `local-file`。
- 如果后续用户想接收更新，必须手动绑定到某个 repository release。绑定流程会校验 extension id、当前 version、artifact sha256 和签名状态。

## 更新流程

`extension:check-updates`：

1. 确保 catalog 已从 manifest snapshot 可用。
2. 对每个 installed extension 读取 update policy。
3. 跳过 builtin、local dev、`pinned` 和 disabled auto update。
4. 使用 `ExtensionUpdatePlanner` 选择候选 release。
5. 返回：
   - 可更新版本。
   - 当前版本。
   - 来源仓库。
   - changelog。
   - signer trust status。
   - 不可更新原因。

`extension:update(extensionId)`：

1. 选择更新候选；自动更新只允许当前 extension 已信任 signer 签名的 release。
2. 创建 operation record，获取 extension mutation mutex；mutex 持有期间 extension 仍保持运行。
3. 重新读取安装记录和 catalog release，确认 update policy、channel、pin、release digest、artifact sha256 和 signer trust 仍满足计划。
4. 下载、校验、解压新 release 到 staging；下载阶段可通过 `extension:cancel-operation` 中断。
5. 进入不可取消提交阶段，创建内存 rollback context。
6. 卸载当前 runtime，但不删除旧 package。
7. 将旧 package 移动到 `temp/operations/backups/<operation-id>`。
8. 将 staging package 移动到 `packages/<extension-id>`。
9. 在 SQLite transaction 中更新 `extension_installations.version`、source 字段、channel 和 `updated_at`。
10. 重新加载 runtime。
11. 如果当前进程内发生 runtime failed，使用内存 rollback context 回滚 DB 和文件，并重新加载旧 package。
12. 成功后删除 backup。

`extension:update-all`：

- 顺序执行，不并发改动多个扩展 runtime。
- 单个扩展失败不阻塞后续扩展，但最终返回失败列表。
- UI 展示每个扩展的成功或失败结果；v1 不持久化 update task。

## 卸载与清除数据

卸载分为两个命令：

```text
extension:uninstall
extension:purge-data
```

`uninstall`：

1. 获取 mutation mutex。
2. 确认不是 builtin。
3. 读取当前 installation record，并通过 `ExtensionPackageLayout` 派生 package path。
4. 卸载 runtime。
5. 从 contribution registry 释放扩展贡献。
6. 将 `packages/<extension-id>` 移动到 `temp/operations/trash/<operation-id>`；如果 package 目录已不存在，继续执行 DB 删除。
7. 在 SQLite transaction 中删除 `extension_installations`。
8. transaction 成功后清理 trash。
9. 如果 DB 删除或后续 reconcile 失败，把 trash 中的 package 移回原路径，恢复安装记录，并按原 enabled 状态重新 reconcile runtime。
10. 保留 `data/<extension-id>` 和 `temp/runtime/<extension-id>`。
11. 发送安装状态和贡献点事件。

`purge-data`：

1. 只能对未安装扩展执行，除非用户传 `force: true` 并先禁用 runtime。
2. 删除 `data/<extension-id>` 和 `temp/runtime/<extension-id>`。
3. 删除 storage/secrets 相关记录。

UI 文案：

- “卸载”表示移除扩展代码，保留设置和数据。
- “清除数据”表示删除该扩展的本地配置、缓存和 secret。
- 卸载弹窗提供 checkbox：`同时清除扩展数据`，默认不勾选。

## Built-in 扩展

内置扩展继续由构建流程写入应用资源目录：

```text
apps/desktop/out/extensions
apps/desktop/resources/extensions
```

规则：

- Built-in 不进入 remote repository。
- Built-in 在 installed DTO 中可以有只读 installation view，但不写入 DB 安装记录。
- Built-in 不允许禁用、卸载、更新、pin 或清除数据。
- Built-in 不写入 `extension_installations`，不提供 `enabled_override`。`ExtensionInstallationCatalog` 从应用资源目录扫描 built-in package，manifest 有效时始终视为 enabled。

## Runtime 接入

`RuntimeManager` 输入从 installed catalog 构建：

```ts
interface ExtensionRuntimeMetadata {
  id: string
  name: string
  version: string
  manifestPath: string
  extensionPath: string
  dataPath: string
  tempPath: string
  mode: ExtensionMode
}
```

变化：

- `extensionPath` 由 `ExtensionPackageLayout` 从 installation id 派生并校验，最终指向 `packages/<id>`。
- `manifestPath` 指向 package root 下的 `manifest.json`。
- `dataPath` 仍为 `data/<id>`。
- 更新时必须先完成下载、校验和 staging，再在提交阶段 unload、切换 active version、reload。
- 回滚时把 `temp/operations/backups/<operation-id>` 中的旧包移回 `packages/<id>`，再重新加载旧包。

Contribution registry 不需要知道远程仓库信息。它只接收运行时加载后的贡献点。

## Renderer 设计

`@renderer/features/extension` 拆成三个清晰视图：

```text
features/extension/
  pages/
    extension-layout.vue
    extension-installed-page.vue
    extension-discover-page.vue
    extension-repositories-page.vue
  stores/
    installed-extension-store.ts
    discover-extension-store.ts
    extension-repository-store.ts
  components/
    installed-panel/
    discover-panel/
    repository-panel/
    install-dialog/
    update-dialog/
    uninstall-dialog/
```

Discover：

- 默认展示本地 catalog。
- 顶部有 repository 状态入口，不再是 provider 选择器。
- 支持分类、channel、兼容、已安装、已信任 signer 过滤。
- package card 显示来源数量、最新兼容版本、签名状态、更新日期。
- 详情页展示 releases、artifact host、signer fingerprint、changelog。

Repositories：

- 列出官方和第三方仓库。
- 支持添加 manifest URL、启用、禁用、阻止、刷新、删除、修改优先级。
- 显示 state、built-in 标记、last success、last error、manifest digest、package count。
- 不在仓库页表达“仓库可信”。signer 信任只在安装、更新确认和 signer 管理视图中展示。

Installed：

- 显示 active version、source repository、signer fingerprint、update policy、channel、runtime status。
- 安装确认使用 renderer `install-dialog`，展示 install plan、风险项和信任选择。
- 更新按钮打开 update dialog，展示将要安装的 release、changelog、签名和风险。
- 卸载按钮打开 renderer `uninstall-dialog`，默认保留数据。
- 安装、更新、卸载期间使用按钮 loading 和结果通知；v1 不实现持久化任务列表。

UI 不展示实现说明、协议细节或调试字段，除非用户打开详情/诊断区域。扩展管理确认 UI 必须是 renderer 内的应用 dialog，不能由 main 使用系统原生 dialog 代替。

## CLI 与发布工具

`kisx` 必须让扩展作者不用手写 registry manifest。作者只需要 pack `.kisx`，再用 CLI 把包追加到静态 manifest。

新增 registry 子命令：

```text
kisx key generate --out <key-file>
kisx registry init
kisx registry add-release <package.kisx> --manifest <manifest.json> --url <artifact-url>
kisx registry validate <manifest.json>
kisx registry sign <package.kisx>
kisx registry digest <package.kisx>
```

`kisx pack` 新增：

```text
kisx pack --sign --key <key-file>
kisx pack --out-dir dist
```

作者生成仓库 manifest 的推荐流程：

```powershell
kisx build
kisx pack --out-dir dist
kisx registry init --out registry/manifest.json
kisx registry add-release dist/bangumi-1.2.0.kisx --manifest registry/manifest.json --url https://example.com/extensions/bangumi-1.2.0.kisx
kisx registry validate registry/manifest.json
```

如果作者希望自签名：

```powershell
kisx key generate --out .keys/author.ed25519
kisx pack --out-dir dist --sign --key .keys/author.ed25519
kisx registry add-release dist/bangumi-1.2.0.kisx --manifest registry/manifest.json --url https://example.com/extensions/bangumi-1.2.0.kisx --signature dist/bangumi-1.2.0.sig
kisx registry validate registry/manifest.json
```

`kisx pack --sign` 生成的 `.sig` 是 JSON 文件，至少包含 `keyId`、`algorithm`、`publicKey`、`fingerprint`、artifact identity envelope 和 `signature`。`registry add-release --signature` 从 `.sig` 中读取 public key 写入仓库级 `signingKeys`，校验 `.sig` 中 envelope 与将要写入的 release/artifact 字段一致，并把 signature 写入 release artifact。

`registry add-release` 自动完成：

- 读取 `.kisx` 内的 `manifest.json`。
- 提取 `id`、`name`、`version`、`description`、`categories`、`keywords`、`engines.kisaki`。
- 计算 `.kisx` 的 `sha256` 和 size。
- 读取可选 signature，并把 public key 信息写入 `signingKeys`。
- 如果 manifest 中没有该 package，则创建 package。
- 如果 package 已存在，则追加 release。
- 如果同一 package 已存在相同 version，默认拒绝，除非传 `--replace`。
- 输出可部署的静态 `manifest.json`。

CLI 输出：

- `.kisx` 文件。
- `sha256` digest。
- 可选 `signature`。
- 可复制到 registry manifest 的 release snippet。

扩展作者可以把以下文件发布到任意静态托管：

```text
registry/manifest.json
dist/*.kisx
icons/*    # optional, only if manifest icon.url points here
```

官方仓库和第三方仓库使用同一套流程：

1. build extension。
2. pack `.kisx`。
3. 可选：sign artifact identity envelope。
4. upload artifact 和 icon。
5. update manifest。
6. validate manifest。
7. publish static manifest。

## 错误模型

用户可见错误必须简洁，诊断信息保存在日志和操作返回结果中。

错误 code：

```ts
export type ExtensionRegistryErrorCode =
  | 'repository-url-invalid'
  | 'repository-fetch-failed'
  | 'repository-manifest-invalid'
  | 'release-incompatible'
  | 'release-yanked'
  | 'artifact-not-found'
  | 'artifact-download-failed'
  | 'artifact-size-mismatch'
  | 'artifact-checksum-mismatch'
  | 'artifact-signer-untrusted'
  | 'artifact-signature-invalid'
  | 'package-manifest-invalid'
  | 'package-identity-mismatch'
  | 'package-entry-missing'
  | 'install-transaction-failed'
  | 'operation-recovery-failed'
  | 'runtime-activation-failed'
```

Renderer 显示：

- title：操作失败。
- message：人类可读摘要。
- detail：可展开诊断。

日志包含：

- repository id/url。
- extension id/version。
- release id/digest。
- operation id。
- cause stack。

## Implementation Plan

### Phase 1：协议与公共类型

1. 新增 `packages/extension-api/src/registry/`。
2. 新增 `extension-registry.schema.json`。
3. 实现 manifest parser、unknown key 校验、semver 校验、artifact target 选择、release digest canonicalization。
4. 实现 artifact identity envelope 生成和签名 payload 类型。
5. 更新 `packages/extension-api/src/index.ts` 导出 registry 类型。

### Phase 2：数据库与 shared 状态类型

1. 在 Drizzle schema 中新增 `extension_repositories`、`extension_installations` 和 `extension_trusted_signers` 三张表。
2. 生成 migration。
3. 在 shared 层新增 `ExtensionInstallationSource`、parser 和 type guard，并让 DB custom type 与 main service 共用。
4. 新增 `ExtensionInstallationStore`、`ExtensionRepositoryStore` 和 `ExtensionTrustedSignerStore`。

### Phase 3：包操作核心与恢复

1. 拆分旧 `ExtensionInstaller` 为 `packages/`、`installer/`、`installations/` 子目录。
2. 实现 `ExtensionPackageLayout`，所有 package/data/temp 路径都从 extension id 派生并执行 path confinement。
3. 实现 downloader、verifier、extractor 和 transaction。
4. 实现启动 recovery：DB/package 复核、stale temp prune、backup/trash 清理或恢复。
5. 实现内存 `ExtensionPackageOperationRegistry` 和 `extension:cancel-operation`。

### Phase 4：仓库刷新与聚合

1. 实现 `ExtensionRepositoryFetcher`。
2. 实现 `ExtensionRepositoryManager`。
3. 实现 ETag / Last-Modified 缓存。
4. 将规范化 manifest 写入 `extension_repositories.manifest_snapshot`。
5. 实现 `ExtensionRepositoryAggregator`，从 manifest snapshot 聚合内存 catalog。
6. 实现 `ExtensionIconManager`，renderer 只消费 main 提供的 app-local icon URL。
7. 接入 `extension:list-repositories`、`extension:add-repository`、`extension:refresh-repositories` 和 `extension:search-catalog`。

### Phase 5：安装垂直切换

1. 新增 `create-install-plan` 和 `install-release` IPC。
2. 改造 `install-from-file` 为本地导入 install plan。
3. `ExtensionService` 接入新 installer、installation store 和 operation recovery。
4. `ExtensionInstallationCatalog` 从 DB installation、built-in、dev extension 和 package manifest 构建 installed DTO。
5. 安装成功后接入 `RuntimeManager.reconcile()`。
6. 此阶段结束时 `ExtensionService` 启动不再读 `state.json`。

### Phase 6：Renderer 发现与确认 UI

1. 删除 discover store 中的 `selectedRegistry` provider 语义。
2. 改用 `extension:search-catalog`。
3. 新增 repositories page。
4. 新增 package details / release list。
5. 新增 renderer `install-dialog`、`update-dialog` 和 `uninstall-dialog`，替代主进程原生确认 dialog。
6. 显示仓库健康、签名状态、兼容状态和 icon 代理结果。

### Phase 7：更新策略

1. 实现 `ExtensionUpdatePlanner`。
2. 新增 update policy 字段和 IPC。
3. 改造 `checkUpdates`。
4. 改造 `update` 和 `updateAll`，共用 Phase 3 的 transaction。
5. 实现失败回滚 active version。

### Phase 8：卸载与清除数据

1. 改造 `uninstall` 为保留数据。
2. 新增 `purge-data`。
3. UI 增加卸载确认和清除数据确认。
4. 验证 contribution registry release。

### Phase 9：CLI 发布工具

1. `kisx pack` 输出 digest。
2. 加入作者自签名支持，签名 artifact identity envelope。
3. 新增 `kisx key generate`。
4. 新增 `kisx registry init`。
5. 新增 `kisx registry validate`。
6. 新增 `kisx registry add-release`，自动从 `.kisx` 生成或更新仓库 manifest。
7. 更新 extension CLI README 和 create-extension 模板。

### Phase 10：删除旧系统

删除：

```text
apps/desktop/src/main/services/extension/sources/
apps/desktop/src/main/services/extension/state.ts
ExtensionSourceProvider
ExtensionSourceProviderInfo
ExtensionSourceLocator
ExtensionRegistryEntry
extension:get-sources
extension:search
extension:install(source)
ExtensionStateStore
```

替换：

```text
catalog.ts -> installations/catalog.ts
state.ts -> installations/store.ts
manifest.ts -> packages/manifest.ts
installer.ts -> installer/manager.ts
ExtensionCatalogInfo -> ExtensionInstalledPackageInfo
```

### Phase 11：验收与文档

1. 更新 `.codex/skills/kisaki/references/extension-system.md`。
2. 更新 `packages/extension-cli/README.md`。
3. 更新 `packages/extension-api/README.md`。
4. 更新 renderer 文案。
5. 运行类型检查、lint 和扩展契约构建。

## 搜索校验

旧系统删除后以下搜索必须无结果：

```powershell
rg -n "ExtensionSourceProvider|ExtensionSourceLocator|ExtensionSourceProviderInfo" apps packages docs .codex --glob "!docs/extension-distributed-registry-redesign.md"
rg -n "ExtensionRegistryEntry|extension:get-sources|extension:search|extension:install'|extension:install\\\"" apps packages docs .codex --glob "!docs/extension-distributed-registry-redesign.md"
rg -n "state\\.json|ExtensionStateStore|services/extension/sources" apps packages docs .codex --glob "!docs/extension-distributed-registry-redesign.md"
rg -n "provider.*locator|locator.*provider" apps/desktop/src/main/services/extension apps/desktop/src/shared apps/desktop/src/renderer/src/features/extension
```

以下搜索必须有结果：

```powershell
rg -n "ExtensionRegistryManifest|ExtensionRegistryRelease|ExtensionRegistryArtifact" packages/extension-api apps docs
rg -n "extension:search-catalog|extension:list-repositories|extension:install-release" apps/desktop/src/shared apps/desktop/src/main apps/desktop/src/renderer
rg -n "ExtensionRepositoryManager|ExtensionPackageInstaller|ExtensionUpdatePlanner|ExtensionSignerTrustManager" apps/desktop/src/main/services/extension
rg -n "ExtensionPackageTransaction|ExtensionIconManager" apps/desktop/src/main/services/extension
rg -n "extension_repositories|extension_installations|extension_trusted_signers" apps/desktop/src/shared/db apps/desktop/drizzle
```

## 验收标准

- 扩展发现完全基于 repository manifest 聚合 catalog。
- GitHub topic search 不再是发现入口。
- 用户可以管理多个仓库；官方仓库不是唯一来源。
- 仓库 manifest、package release 和 artifact 都有 schema 和 parser。
- 远程安装必须校验 sha256。
- 签名允许扩展作者自签；Kisaki 验证签名，用户决定是否为该 extension 信任 signer fingerprint。
- 未信任 signer、unsigned 或 signer changed 的 release 需要用户手动确认，不能自动更新。
- 本地文件安装有明确 unsigned 标识和 `manual` update policy。
- v1 不新增 `extension_jobs` 和 `extension_package_versions` 表。
- 下载阶段可中断，但取消状态不持久化。
- 提交阶段不写额外 operation JSON；应用异常退出后由 transaction recovery 根据 DB、package、backup/trash/staging 目录恢复到可诊断的一致状态。
- DB 不保存可直接执行加载的绝对 package path；runtime path 必须由 installation id 经 layout 派生。
- 安装、更新、卸载确认 UI 全部由 renderer dialog 承担；main 不使用 Electron 原生确认 dialog。
- 安装、更新、卸载都有事务回滚和错误诊断。
- 更新候选选择遵守 channel、pin、兼容性、yanked 和 signer trust。
- 卸载默认保留扩展数据；清除数据是独立显式操作。
- 安装和更新失败不会留下 active package 指向不存在目录或 staging 目录。
- Runtime 只加载由 DB installation id 派生并经过 path confinement 校验的 active package。
- Renderer 不直接访问远程 manifest 或 `.kisx` 文件。
- Renderer 不直接访问远程 extension icon；图标通过 main 代理或本地缓存提供。
- 旧 `sources/`、`state.json`、`ExtensionSourceProvider`、`ExtensionRegistryEntry`、`extension:search` 全部删除。
- `pnpm build:extension-contracts` 通过。
- `pnpm --filter kisaki typecheck` 通过。
- `pnpm --filter @kisaki/extension-api lint` 通过。
- `pnpm --filter @kisaki/extension-cli lint` 通过。

## 最终边界

重构完成后，Kisaki 扩展系统的边界应当非常清楚：

- Repository 负责声明可安装内容。
- Catalog 负责本地可发现视图。
- Installation 负责本机已安装事实。
- Runtime 负责加载 active package。
- Contribution registry 负责运行后贡献点。
- Renderer 负责展示和发起用户动作。

这套边界让扩展生态可以分布式增长，同时让本机安装行为保持可验证、可回滚、可诊断。
