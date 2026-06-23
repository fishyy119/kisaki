# 扩展 API 版本与兼容策略设计文档

本文定义 Kisaki 扩展 API、扩展工具链、扩展清单、注册表和主应用之间的版本关系与兼容策略。

本设计不考虑向后兼容：现有 `engines.kisaki` 语义、当前 `>=` 兼容判断、脚手架默认范围、注册表候选过滤和安装校验都可以按本文目标直接调整，不保留旧判断、兼容别名或双轨过渡。

## 核心结论

Kisaki 扩展兼容性以扩展 API 版本为准，不以主应用产品版本为准。

`engines.kisaki` 保留为扩展清单中的兼容声明字段，但它的语义是：

```text
扩展要求的 Kisaki Extension API 版本范围
```

不是：

```text
扩展要求的 Kisaki 桌面应用产品版本范围
```

官方只承诺版本号语义下的 API 契约兼容。实际某个扩展能运行的版本范围可以比官方承诺更宽，但这部分由扩展作者自行判断、测试、声明和适配。宿主只相信扩展 `manifest.json` 中的 `engines.kisaki`，不替扩展作者推断兼容范围。

一句话规则：

```text
官方定义 API 版本兼容承诺；扩展作者定义扩展实际支持范围；宿主只执行 manifest 声明。
```

## 目标

- 将扩展 API 版本从 Kisaki 主应用版本中彻底独立出来。
- 明确 API 版本、主应用版本、工具链版本、扩展版本、注册表 schema 版本和 RPC 协议版本的边界。
- 让兼容判断只依赖 `@kisaki3/extension-api` 版本和 `engines.kisaki` 范围。
- 建立统一的实验版、预发布版、候选版和稳定版策略。
- 允许扩展作者声明比官方承诺更宽的实际支持范围。
- 让 CLI、脚手架、注册表、安装校验、发现目录和运行时暴露同一套版本语义。

## 非目标

- 不承诺任意具体扩展在某个主应用版本上一定可运行。
- 不让主应用产品版本参与扩展兼容判断。
- 不通过宿主静态分析扩展代码来推断兼容范围。
- 不为旧 `engines.kisaki` 产品版本语义提供迁移或兼容逻辑。
- 不把 registry `schemaVersion`、RPC protocol version 或扩展自身版本混入 API 兼容策略。

## 版本边界

### Kisaki 主应用版本

主应用版本来自 `apps/desktop/package.json`。

它表示产品发布版本，用于：

- 应用更新。
- 关于页展示。
- 桌面应用 changelog。
- 安装包和发布产物命名。

它不用于扩展兼容判断。

### Extension API 版本

扩展 API 版本来自 `@kisaki3/extension-api` 的 `package.json` 版本。

这是扩展兼容的唯一官方版本事实源。它表示扩展可见契约，包括：

- `ExtensionContext`。
- `KisakiApi`。
- capabilities。
- contributions。
- public DTO。
- manifest parser 和 validation helper。
- extension host RPC 契约中对扩展公开的部分。

`packages/extension-api/src/version.ts` 中的 `EXTENSION_API_VERSION` 是这个事实源的生成镜像。主应用运行时通过它暴露当前宿主支持的 API 版本。

### Extension Tooling 版本

扩展工具链包括：

- `@kisaki3/extension-api`
- `@kisaki3/extension-registry`
- `@kisaki3/extension-sdk`
- `@kisaki3/extension-ui-vue`
- `@kisaki3/extension-cli`
- `create-kisaki-extension`

这些包继续作为一个工具链套件锁步发布。锁步发布是发布工程策略，不改变 API 兼容事实源：扩展兼容仍以 `@kisaki3/extension-api` 版本为准。

CLI、SDK、UI kit、registry tooling 和脚手架可以因为自身修复导致工具链版本 bump。只要 `extension-api` 公共契约没有破坏，就按 API 版本语义正常 bump patch 或 minor。

### 扩展包版本

扩展包自己的 `manifest.version` 表示该扩展的发布版本。它属于扩展作者，不参与宿主 API 兼容承诺。

扩展包版本用于：

- 安装记录。
- 更新比较。
- 注册表 release 列表。
- 扩展 changelog。
- 用户界面展示。

扩展包版本可以是 `1.2.0`、`1.3.0-beta.1` 等 semver，与宿主 API 版本没有绑定关系。

### Registry Schema 版本

`extension-registry` 的 `schemaVersion` 是注册表 JSON 协议版本。它用于判断远程 repository manifest 是否能被当前工具和主应用解析。

它不参与扩展运行时 API 兼容判断。

### RPC Protocol 版本

`EXTENSION_RPC_PROTOCOL_VERSION` 是主进程与 extension host 进程之间的内部通信协议版本。

它用于宿主内部进程握手，不是扩展作者声明兼容的版本，不写入扩展 manifest。

## 事实源

| 事项                  | 事实源                                | 说明                       |
| --------------------- | ------------------------------------- | -------------------------- |
| 当前扩展 API 版本     | `packages/extension-api/package.json` | 唯一官方事实源             |
| 运行时暴露的 API 版本 | `EXTENSION_API_VERSION`               | 由 API 包版本生成或校验    |
| 扩展要求的 API 范围   | `manifest.json` 的 `engines.kisaki`   | 扩展作者事实源             |
| 主应用产品版本        | `apps/desktop/package.json`           | 不参与扩展兼容             |
| 注册表 schema         | `schemaVersion`                       | 只约束 repository manifest |
| RPC 内部协议          | `EXTENSION_RPC_PROTOCOL_VERSION`      | 只约束 main/host 握手      |

## 官方兼容承诺

官方兼容策略是保守下限，不是可运行上限。

官方承诺的是：在某个版本号策略下，Kisaki 扩展 API 公共契约是否保持兼容。

官方不承诺的是：

- 某个第三方扩展是否覆盖所有业务行为。
- 扩展是否正确处理 API 差异。
- 扩展是否能在超出官方推荐范围的版本上运行。
- 扩展是否因为外部服务、数据格式、网络、权限或自身 bug 而失败。

扩展作者可以根据官方 changelog、类型定义、运行时 API、实际测试或自己的兼容分支声明更宽范围。超出官方承诺范围的部分由扩展作者负责。

## 版本阶段

### 总表

| API 版本形态    | 阶段     | 官方兼容承诺    | 官方推荐 `engines.kisaki` | 推荐 dist-tag  |
| --------------- | -------- | --------------- | ------------------------- | -------------- |
| `0.y.z`         | 内部实验 | 只承诺严格等于  | `=0.y.z`                  | `experimental` |
| `N.M.P-alpha.n` | 实验线   | 只承诺严格等于  | `=N.M.P-alpha.n`          | `alpha`        |
| `N.M.P-beta.n`  | 验证线   | 只承诺严格等于  | `=N.M.P-beta.n`           | `beta`         |
| `N.M.P-rc.n`    | 候选线   | rc 内部向后兼容 | `>=N.M.P-rc.1 <N.M.P`     | `rc`           |
| `N.M.P`         | 稳定线   | 严格 SemVer     | `^N.M.P`                  | `latest`       |

`N.M.P` 是目标稳定版本。对于破坏性大版本，目标通常是 `N.0.0`，例如 `2.0.0-alpha.1`、`2.0.0-beta.1`、`2.0.0-rc.1`、`2.0.0`。

如果未来需要为 minor 或 patch 发布预发布版本，规则完全相同。例如 `2.3.0-beta.1` 仍然是 `2.3.0` 的 beta 验证线，并且 beta 内部只承诺严格等于。

### `0.y.z`

`0.y.z` 属于“测试中的测试”。该阶段用于快速试错、重构和内部扩展开发。

规则：

- 官方只承诺精确版本兼容。
- `0.y.z` 的 patch 不代表兼容修复，可以包含破坏性变更。
- `0.y.z` 的 minor 不代表兼容添加，可以包含任意重构。
- 不推荐第三方扩展长期依赖 `0.y.z`。
- 脚手架默认生成精确范围。

示例：

```json
{
  "engines": {
    "kisaki": "=0.4.0"
  }
}
```

所有 `0.*` 都按实验阶段处理。即使出现 `0.4.0-alpha.1`，也不单独进入 alpha/beta/rc 承诺体系，而是继续按 `0.*` 实验策略处理。

### Alpha

`alpha` 是公开实验线。它用于验证 API 形状，不承诺内部兼容。

规则：

- `alpha.2` 可以破坏 `alpha.1`。
- `alpha` 可以删除、重命名、改参数、改返回结构、改变语义。
- 官方推荐精确范围。
- 扩展作者如果声明跨 alpha 范围，表示作者自己承担适配责任。

示例：

```json
{
  "engines": {
    "kisaki": "=2.0.0-alpha.3"
  }
}
```

### Beta

`beta` 是验证线。它表示 API 比 alpha 更接近冻结，但仍不提供内部兼容承诺。

规则：

- `beta.2` 可以破坏 `beta.1`。
- beta 阶段可以修正设计级问题。
- 官方推荐精确范围。
- beta 不是兼容承诺阶段，只是稳定前验证阶段。

示例：

```json
{
  "engines": {
    "kisaki": "=2.0.0-beta.2"
  }
}
```

### Release Candidate

`rc` 是候选发布线。它表示目标 API 已经冻结。

规则：

- `rc.2` 必须兼容 `rc.1`。
- rc 阶段只修阻断问题，不添加新 API，不删除 API，不改变既有语义。
- 如果发现必须破坏 API 的问题，应退出 rc，回到新的 alpha 或 beta 线，而不是继续发布不兼容 rc。
- rc 扩展不自动兼容最终稳定版，除非扩展作者声明覆盖最终稳定版。

示例：

```json
{
  "engines": {
    "kisaki": ">=2.0.0-rc.1 <2.0.0"
  }
}
```

该范围覆盖 `2.0.0-rc.1`、`2.0.0-rc.2` 等 rc 版本，但不覆盖最终 `2.0.0`。

### Stable

稳定线从 `1.0.0` 及后续非 prerelease 版本开始执行严格 SemVer。

规则：

- `MAJOR` 允许破坏 API。
- `MINOR` 只能兼容添加 API。
- `PATCH` 只能修复 bug、文档、构建或类型问题，不能改变公共契约。
- 稳定线不得删除 API、重命名 API、收紧已有输入、改变返回结构或改变既有语义，除非 bump major。

示例：

```json
{
  "engines": {
    "kisaki": "^2.0.0"
  }
}
```

`^2.0.0` 表示兼容 `>=2.0.0 <3.0.0` 的稳定 API 线。

## 扩展作者实际支持范围

官方推荐范围只是官方兼容承诺覆盖的保守范围。扩展作者可以声明更宽范围。

例如，官方对稳定线的推荐是：

```json
{
  "engines": {
    "kisaki": "^2.1.0"
  }
}
```

如果扩展作者测试并适配了多个 major，可以声明：

```json
{
  "engines": {
    "kisaki": ">=2.1.0 <4.0.0"
  }
}
```

这不是官方替扩展作者担保 `3.x` 兼容，而是扩展作者自己的声明。扩展可以通过运行时 API 版本分支处理差异：

```ts
const info = await kisaki.runtime.getInfo()

if (semver.satisfies(info.apiVersion, '^2.1.0')) {
  // API v2 behavior
} else if (semver.satisfies(info.apiVersion, '^3.0.0')) {
  // API v3 behavior
}
```

宿主不检查这些分支是否存在，也不检查扩展是否真正适配。宿主只做一件事：

```ts
semver.satisfies(currentApiVersion, manifest.engines.kisaki)
```

## `engines.kisaki` 规则

`engines.kisaki` 必须是 semver range。

硬规则：

- 字段名继续使用 `engines.kisaki`。
- 字段值必须能被 `semver.validRange(...)` 接受。
- 安装、发现、更新和本地包加载都必须使用当前 Extension API 版本做判断。
- 不允许再用 `app.getVersion()` 判断扩展兼容。
- 不允许把主应用版本和扩展 API 版本混合比较。

推荐规则：

- `0.y.z` 使用精确范围。
- `alpha` 使用精确范围。
- `beta` 使用精确范围。
- `rc` 使用目标版本的 rc 范围。
- stable 使用 caret 范围。
- 不推荐裸 `>=x.y.z`，因为它默认宣称兼容所有未来 major。

## SemVer prerelease 判断

兼容判断应使用 semver 默认 prerelease 行为，不应全局开启 `includePrerelease`。

原因：

- 稳定范围 `^2.0.0` 不应匹配 `3.0.0-alpha.1`。
- 预发布版本只有在 range 显式包含对应 prerelease comparator 时才应匹配。
- `>=2.0.0-rc.1 <2.0.0` 可以覆盖 `2.0.0-rc.2`，但不会覆盖最终 `2.0.0`。

推荐实现形态：

```ts
semver.satisfies(apiVersion, enginesKisakiRange)
```

不要写：

```ts
semver.satisfies(apiVersion, enginesKisakiRange, { includePrerelease: true })
```

## 工具链策略

### 版本发布

扩展工具链继续锁步发布。发布脚本必须保证：

- 所有扩展工具链包使用同一个版本。
- 内部依赖继续使用 `workspace:*`。
- `EXTENSION_API_VERSION` 与 `@kisaki3/extension-api` 版本一致。
- 脚手架模板依赖注入当前工具链版本。

工具链版本可以等于 API 版本。该策略简单、可审计，并避免 SDK、CLI 与 API 包组合漂移。

### dist-tag

推荐 dist-tag：

- `0.y.z` 发布到 `experimental`。
- `alpha` 发布到 `alpha`。
- `beta` 发布到 `beta`。
- `rc` 发布到 `rc`。
- stable 发布到 `latest`。

如果 npm 发布流程暂时只支持 `next` 和 `latest`，应以本文为目标调整，而不是让 `next` 成为长期语义事实源。

### CLI 与脚手架

`create-kisaki-extension` 和 `kisx` 应根据当前 API 版本阶段生成推荐范围：

| 当前 API 版本   | 默认生成范围          |
| --------------- | --------------------- |
| `0.4.0`         | `=0.4.0`              |
| `2.0.0-alpha.3` | `=2.0.0-alpha.3`      |
| `2.0.0-beta.2`  | `=2.0.0-beta.2`       |
| `2.0.0-rc.1`    | `>=2.0.0-rc.1 <2.0.0` |
| `2.0.0`         | `^2.0.0`              |

`kisx validate` 应做两层检查：

- 错误：`engines.kisaki` 缺失、不是合法 semver range，或包发布时 manifest 与 registry release 不一致。
- 警告：范围超出官方推荐承诺，例如 alpha/beta 使用跨版本范围、stable 使用无上界 `>=`。

警告不阻止扩展作者声明更宽实际支持范围。

## 主应用策略

主应用必须在所有扩展兼容判断中使用 Extension API 版本。

需要统一的判断点：

- repository catalog 中的 `release.compatible`。
- install candidate 选择。
- `.kisx` archive 校验。
- active package directory 校验。
- update candidate 选择。
- runtime metadata 暴露。
- `kisaki.runtime.getInfo()` 返回值。

判断输入：

```text
currentApiVersion = EXTENSION_API_VERSION
requiredRange = manifest.engines.kisaki 或 registry release engines.kisaki
```

判断规则：

```ts
semver.satisfies(currentApiVersion, requiredRange)
```

主应用产品版本仍可通过 `kisaki.runtime.getInfo().appVersion` 暴露给扩展，但它只用于产品行为判断，不用于 API 兼容判断。

## 注册表策略

Registry release 的 `engines.kisaki` 与扩展包 manifest 的 `engines.kisaki` 必须一致。

原因：

- registry 是远程发现事实。
- `.kisx` manifest 是包内事实。
- 两者不一致会让发现页与实际安装校验产生不同结果。

注册表兼容判断使用 API 版本：

```text
release.compatible = semver.satisfies(currentApiVersion, release.engines.kisaki)
```

Registry 不根据主应用版本过滤扩展。

## 更新策略

扩展更新选择需要同时考虑两个维度：

- 扩展包版本是否更新。
- 候选 release 的 `engines.kisaki` 是否满足当前 API 版本。

扩展包的 stable/preview release kind 与 Extension API 的 stable/prerelease 版本阶段是两个概念，不应混淆。

默认策略：

- 自动更新只选择兼容当前 API 版本的候选 release。
- 自动更新默认偏向扩展包 stable release。
- 是否接收扩展包 preview release 由扩展安装状态或用户更新策略决定。
- 如果主应用内置的是 prerelease API，只有显式声明匹配该 API prerelease 的扩展才会被视为兼容。

宿主不得因为“看起来可能兼容”而安装 `engines.kisaki` 不满足的 release。

## Changelog 策略

官方 API changelog 是扩展作者判断兼容的主要依据之一。

每次 Extension API 发布必须标注：

- API version。
- 阶段：experimental、alpha、beta、rc、stable。
- 是否破坏公共契约。
- 新增 API。
- 删除 API。
- 行为变化。
- 校验变化。
- 迁移提示。

稳定线中：

- `minor` changelog 不应包含破坏性变更。
- `patch` changelog 不应包含公共契约变化。
- 破坏性变更必须进入下一个 major。

预发布线中：

- alpha/beta 可以破坏，但必须记录。
- rc 不应破坏。如果破坏，说明该版本不应作为 rc 发布。

## API 变更分类

### Breaking

以下变化必须进入 major，或只出现在 `0.y.z`、alpha、beta 阶段：

- 删除 public export。
- 重命名 public export。
- 改变 public function 参数。
- 改变 public function 返回结构。
- 收紧已有字段校验。
- 把 optional 字段改为 required。
- 改变已有 capability 或 contribution 的语义。
- 改变 RPC method 字符串。
- 删除 contribution point。
- 删除 capability。
- 改变事件 topic。

### Compatible Additive

以下变化可以进入 stable minor：

- 新增 capability。
- 新增 contribution point。
- 新增 optional 字段。
- 新增 enum 值，但仅当消费者已经被设计为可忽略未知值。
- 新增 helper。
- 新增 validation helper。
- 新增非强制 manifest 字段。

### Patch

以下变化可以进入 stable patch：

- 修复类型声明与实现不一致。
- 修复文档。
- 修复构建产物。
- 修复不改变公共契约的运行时 bug。
- 修复错误消息，但不改变错误分类和可观察语义。

## 运行时暴露

`kisaki.runtime.getInfo()` 必须继续暴露：

```ts
interface RuntimeInfo {
  appVersion: string
  apiVersion: string
  mode: 'development' | 'production'
  platform: 'windows' | 'macos' | 'linux'
  arch: string
}
```

语义：

- `apiVersion` 用于扩展 API 分支和 feature compatibility。
- `appVersion` 用于产品版本判断，不用于 API 兼容。
- `mode` 可用于开发行为分支。
- `platform` 和 `arch` 可用于平台能力判断。

## 安全边界

兼容判断不是安全授权。

即使 `engines.kisaki` 满足当前 API 版本，宿主仍必须执行：

- 包路径限制。
- `.kisx` sha256 校验。
- artifact 签名校验。
- signer trust 判断。
- manifest 结构校验。
- package identity 校验。
- registry URL policy。

API 兼容只回答“这个扩展声明的 API 范围是否包含当前宿主 API 版本”。

## 文案策略

面向扩展作者的文档和 CLI 输出应使用：

- `Kisaki Extension API version`
- `扩展 API 版本`
- `engines.kisaki`
- `API compatibility range`
- `API 兼容范围`

普通用户界面可以显示：

- `需要扩展 API：^2.0.0`
- `当前扩展 API：2.1.0`
- `不兼容当前扩展 API`

不要把 `engines.kisaki` 展示成“需要 Kisaki 版本”，避免用户误以为它比较的是桌面应用版本。

## 实施要求

### Manifest 与 Schema

- `ExtensionManifestEngines.kisaki` 保留。
- schema description 改为 Extension API version range。
- manifest README 示例不再使用裸 `>=`。
- registry release `engines.kisaki` 说明改为 Extension API version range。

### Main Process

- 替换所有 `semver.satisfies(app.getVersion(), engines.kisaki)`。
- catalog aggregation 使用 `EXTENSION_API_VERSION`。
- install candidate selection 使用 `EXTENSION_API_VERSION`。
- archive/package verifier 使用 `EXTENSION_API_VERSION`。
- 错误消息使用“Extension API”语义。

### Tooling

- `tools/extension-tooling/cli.ts` 继续校验 `EXTENSION_API_VERSION`。
- `kisx validate` 增加官方推荐范围 warning。
- `create-kisaki-extension` 根据 API 版本阶段生成默认 range。
- 发布脚本支持 `experimental`、`alpha`、`beta`、`rc`、`latest` dist-tag。

### Documentation

- `packages/extension-api/README.md` 更新 manifest 语义。
- `packages/extension-cli/README.md` 更新签名和 registry 发布说明。
- 扩展作者文档增加版本阶段和推荐 range 表。
- 用户界面文案避免把 `engines.kisaki` 说成主应用版本。

## 验收搜索

实施完成后，以下搜索应不再出现主应用版本参与扩展兼容判断：

```powershell
rg -n "semver\.satisfies\(app\.getVersion\(\)|app\.getVersion\(\).*engines\.kisaki|engines\.kisaki.*app\.getVersion\(\)" apps packages
```

以下搜索应定位到 API 版本事实源和兼容判断：

```powershell
rg -n "EXTENSION_API_VERSION|apiVersion|engines\.kisaki|Extension API" apps packages docs
```

以下命令应保持通过：

```powershell
pnpm check:extension-tooling
pnpm build:extension-tooling
pnpm --filter @kisaki3/extension-api typecheck
pnpm --filter @kisaki3/extension-api lint
```

## 示例矩阵

| 当前 API 版本   | 扩展声明              | 是否兼容 | 说明                    |
| --------------- | --------------------- | -------- | ----------------------- |
| `0.4.0`         | `=0.4.0`              | 是       | experimental 精确匹配   |
| `0.4.1`         | `=0.4.0`              | 否       | `0.*` 无 patch 兼容承诺 |
| `2.0.0-alpha.3` | `=2.0.0-alpha.3`      | 是       | alpha 精确匹配          |
| `2.0.0-alpha.4` | `=2.0.0-alpha.3`      | 否       | alpha 内部无兼容承诺    |
| `2.0.0-beta.2`  | `=2.0.0-beta.2`       | 是       | beta 精确匹配           |
| `2.0.0-beta.3`  | `=2.0.0-beta.2`       | 否       | beta 内部无兼容承诺     |
| `2.0.0-rc.2`    | `>=2.0.0-rc.1 <2.0.0` | 是       | rc 内部兼容             |
| `2.0.0`         | `>=2.0.0-rc.1 <2.0.0` | 否       | rc 扩展不自动进入 final |
| `2.1.0`         | `^2.0.0`              | 是       | stable minor 兼容       |
| `3.0.0`         | `^2.0.0`              | 否       | major 可破坏            |
| `3.0.0`         | `>=2.0.0 <4.0.0`      | 是       | 作者声明跨 major 支持   |

## 最终原则

1. 主应用版本是产品版本，不是扩展 API 版本。
2. `@kisaki3/extension-api` 包版本是扩展 API 版本事实源。
3. `engines.kisaki` 是扩展作者声明的 Extension API range。
4. 官方兼容策略是保守承诺，不是运行上限。
5. 扩展作者可以声明更宽范围，但风险和适配逻辑归扩展作者。
6. `0.y.z`、alpha、beta 只承诺严格等于。
7. rc 内部兼容，但不自动兼容 final。
8. stable 执行严格 SemVer。
9. 宿主只执行 manifest 声明，不推断、不补救、不按产品版本兜底。
10. 所有发现、安装、更新、包校验和运行时暴露必须使用同一套 API 版本语义。
