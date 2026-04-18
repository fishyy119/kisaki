# 06. 实施方案

本文件给出一次性切换到新 `extension` 系统的具体实施方案。由于本次重构不考虑向后兼容和迁移成本，因此采用“清晰优先”的大重构路径。

## 实施原则

1. 不做旧 `plugin` 与新 `extension` 的长期共存层。
2. 不保留旧 renderer 扩展执行链路。
3. 不保留旧 SDK 和旧脚手架。
4. 所有公开契约先在 `packages` 定义，再落宿主实现。
5. 以可测试的中间里程碑推进，每一步都可单独验收。

## 仓库级重构目标

## 删除

```text
apps/desktop/src/main/services/plugin/**
apps/desktop/src/renderer/src/core/plugin/**
apps/desktop/src/renderer/src/core/ui-extensions/**
apps/desktop/plugin-types/**
apps/desktop/scripts/build-plugin-types.ts
apps/desktop/rolldown.plugin-types.config.ts
packages/plugin-sdk/**
packages/plugin-cli/**
packages/create-kisaki-plugin/**
```

## 新增

```text
apps/desktop/src/main/services/extension/**
apps/desktop/src/main/extension-host/**
apps/desktop/src/renderer/src/core/extensions/**
packages/extension-api/**
packages/extension-sdk/**
packages/extension-cli/**
packages/create-kisaki-extension/**
```

## 重命名与替换

| 旧对象                 | 新对象                    |
| ---------------------- | ------------------------- |
| `PluginService`        | `ExtensionService`        |
| `plugin` 目录          | `extension` 目录          |
| `--dev-plugin`         | `--dev-extension`         |
| `.zip` 插件包          | `.kisx` 扩展包            |
| `@kisaki/plugin-sdk`   | `@kisaki/extension-sdk`   |
| `@kisaki/plugin-cli`   | `@kisaki/extension-cli`   |
| `create-kisaki-plugin` | `create-kisaki-extension` |

## 分阶段实施

## Phase 1：建立公开契约包

### 目标

先建立新平台的公开边界，切断“从 app 反向生成类型”的旧链路。

### 任务

1. 创建 `packages/extension-api/`
2. 定义以下核心契约：
   - `ExtensionManifest`
   - `ExtensionCategory`
   - `ExtensionContext`
   - `KisakiApi`
   - `HostEvents`
   - `library` DTO、entity query/patch 类型、relation query/command 类型
   - `EntityMenuContribution`、`SettingsPanelContribution`、theme/scraper/deeplink contribution 类型
   - `extension-manifest.schema.json`
   - 底层 protocol 类型
3. 创建 `packages/extension-sdk/`
4. 实现：
   - `defineExtension`
   - `kisaki` 全局 API
   - `context.contributes.entityMenus` / `settingsPanels` 域内 UI helpers
   - context / storage / logger 等作者侧 helper
5. 所有包使用 `tsdown`

### 验收标准

- `extension-api` 与 `extension-sdk` 可以独立构建
- 官方 manifest JSON Schema 可被 CLI 与宿主复用
- 宿主不再依赖 `plugin-types`
- 扩展模板可以只依赖这两个包拿到完整类型

## Phase 2：实现 Core Extension Runtime

### 目标

一次性打通 main 侧 `ExtensionService` 与共享 `extension-host`，形成自包含的核心运行时闭环。

### 任务

1. 新建 `apps/desktop/src/main/services/extension/`
2. 收敛 main 侧模块边界：
   - `service.ts`
   - `types.ts`
   - `manifest.ts`
   - `state.ts`
   - `catalog.ts`
   - `installer.ts`
   - `sources/`
   - `runtime/`
   - `contributions/`
   - `capabilities/`
3. 细化来源与安装职责：
   - `sources/manager.ts` 负责 source resolve/search/download/getLatestVersion
   - `sources/github.ts`、`sources/local-file.ts` 负责具体来源 provider
   - `installer.ts` 只负责 `.kisx` 安装、卸载、更新流程编排
4. 细化 runtime 职责：
   - `runtime/`
   - `runtime/manager.ts`
   - `runtime/host-controller.ts`
   - `runtime/rpc.ts`
   - `runtime/crash-policy.ts`
   - contribution 模块内聚接线逻辑，不再单独设 `adapters/`
5. 新建 `apps/desktop/src/main/extension-host/`
6. 实现 host 侧模块：
   - `index.ts`
   - `bridge.ts`
   - `loader.ts`
   - `rpc.ts`
   - `sdk-bootstrap.ts`
7. host 侧能力要求：
   - 进程入口
   - 基于 protocol message envelope 的 RPC 消息处理与 SDK bridge 适配
   - 多扩展 entry loader
   - extension runtime registry
   - callback registry
   - deactivate 清理流程
8. 实现安装状态存储：
   - `userData/extensions/state.json`
9. 实现 `.kisx` 安装、卸载、更新
10. 实现 `--dev-extension`
11. `RuntimeManager` 能：

- startHost
- handshake
- loadExtension
- unloadExtension
- reloadExtension
- restartHost
- shutdownHost
- 收集宿主崩溃状态并重建已启用扩展

### 验收标准

- main 可以扫描并安装 `.kisx`
- main 可以启用/禁用/卸载扩展
- main 侧 `catalog.ts` 可以稳定聚合已安装扩展与宿主状态
- main 能建立 contribution registry
- 多个扩展能在共享宿主进程中成功执行 `activate(context)`
- 扩展可以注册 contribution
- 扩展可以调用 capability API
- UI 回调统一返回结构化 `UiCallbackResult`
- 单扩展回调异常会被归一化为结构化失败结果，不会直接中断主应用
- 共享宿主崩溃后可恢复已启用扩展
- 旧 `PluginService` 不再参与启动流程

## Phase 3：替换 renderer 扩展模型

### 目标

删除 renderer 扩展执行链路，只保留贡献消费层。

### 任务

1. 删除：
   - `src/renderer/src/core/plugin/**`
   - `src/renderer/src/core/ui-extensions/**`
2. 新建：
   - `src/renderer/src/core/extensions/**`
3. 把现有 UI 替换为：
   - 通过 IPC 获取 entity menu contributions
   - 通过 IPC 获取 settings panels
   - 通过 IPC 获取 theme contributions
4. 扩展管理页从“组件存在判断”改成“结构化 panel 存在判断”

### 验收标准

- renderer 内不再 import 扩展入口
- renderer 内不存在 `window.kisaki`
- 菜单和设置面板均由结构化数据驱动

## Phase 4：迁移正式扩展点

### 目标

把当前零散的注册式能力统一纳入 `ExtensionService`。

### 任务

1. Scraper：
   - 在 `contributions/scrapers.ts` 中实现扩展 provider 注册与宿主接线
   - 让内建 provider 与扩展 provider 共用 registry
2. Deeplink：
   - 把 `DeeplinkAction` 改为 route namespace
   - 在 `contributions/deeplinks.ts` 中实现扩展 handler 注册与宿主路由接线
3. Theme：
   - 把 theme 改为 token-based
   - renderer theme manager 改为消费 token map
4. Events：
   - 形成公开 `HostEvents`
   - 支持扩展命名空间事件

### 验收标准

- 扩展可以注册 scraper provider 并被宿主使用
- 扩展可以注册 deeplink route 并被主应用路由
- 扩展可以注册 theme 并在 UI 中切换
- 扩展可以订阅宿主事件和发送扩展事件

## Phase 5：替换工具链与脚手架

### 目标

彻底删除旧插件工具链，改成统一 tsdown 模型。

### 任务

1. 新建 `packages/extension-cli/`
2. 提供 `kisx` 命令：
   - `build`
   - `dev`
   - `validate`
   - `pack`
3. 新建 `packages/create-kisaki-extension/`
4. 生成新的模板项目：
   - 单 `manifest.json`
   - 单 `src/index.ts`
   - 单 `tsdown.config.ts`
5. 删除旧：
   - Vite 模板
   - plugin type build pipeline
   - `plugin-sdk/scripts/build.ts`

### 验收标准

- 新扩展模板不依赖 Vite
- 新扩展可通过 `kisx pack` 产出 `.kisx`
- 主应用可安装并运行该 `.kisx`

## Phase 6：清理旧系统并统一命名

### 目标

把仓库从 `plugin` 语义彻底切到 `extension`。

### 任务

1. 删除旧包与旧目录
2. 更新 root scripts：
   - `build:plugin-*` -> `build:extension-*`
3. 更新文档与 README
4. 更新 app 内所有 `plugin:*` IPC/event/channel 命名
5. 更新 UI 文案：插件 -> 扩展

### 验收标准

- 仓库中不存在旧 `plugin-sdk`、`plugin-cli`、`create-kisaki-plugin`
- 启动链路不再引用任何旧 `plugin` runtime
- UI 与文档都统一为 `extension`

## 测试策略

## 1. 单元测试

覆盖：

- manifest 校验
- manifest categories 枚举与唯一性校验
- protocol message codec
- contribution model 校验
- theme token 校验
- entity menu / settings panel resolve 归一化逻辑
- `UiCallbackResult` 校验与归一化
- success / error / refresh 语义
- settings panel submit 与草稿重建逻辑
- storage/log/capability wrapper

## 2. 集成测试

至少准备一个 fixture extension，覆盖：

- `activate(context)`
- entity menu action
- entity menu checkbox
- entity menu select
- entity menu callback failure result
- settings panel submit
- settings panel action button
- settings panel explicit refresh
- settings panel structured error result
- event subscribe/emit
- theme contribution
- scraper provider
- deeplink handler

## 3. 端到端测试

覆盖：

- 安装 `.kisx`
- 启用/禁用扩展
- 卸载扩展
- 共享宿主崩溃恢复
- dev hot reload
- renderer 菜单与设置 UI 正常刷新

## 4. 回归测试

重点检查：

- 原有内建 scraper 不回退
- 原有 theme 切换不回退
- 原有通知、事件、网络 service 不回退
- 主应用启动和关闭流程不回退

## 里程碑验收

## M1：契约与 SDK 完成

判断标准：

- `packages/extension-api` 与 `packages/extension-sdk` 定型
- 不再生成 `plugin-types`

## M2：Core Runtime 跑通

判断标准：

- main 侧 `ExtensionService` 与共享宿主进程可端到端协作
- 多个示例扩展能在共享宿主进程中激活并输出独立前缀日志

## M3：受控 UI 跑通

判断标准：

- 示例扩展能提供菜单项与设置面板
- renderer 无扩展代码执行

## M4：正式扩展点跑通

判断标准：

- scraper/deeplink/theme 至少各有一个扩展示例成功运行

## M5：旧系统完全移除

判断标准：

- 仓库不存在旧 plugin runtime/tooling
- 所有命名统一为 extension

## 最终完成定义

以下条件全部满足时，重构视为完成：

1. 扩展只使用 `manifest.json + entry + activate(context)`。
2. 扩展运行时与主应用为独立进程，且全部扩展共享单一 `extension host`。
3. renderer 不再执行扩展代码。
4. 扩展 API 全部由 `packages/extension-api` / `packages/extension-sdk` 定义。
5. 菜单、设置、events、scraper、deeplink、theme 全部纳入统一扩展模型。
6. `.kisx` 成为唯一官方分发格式。
7. `tsdown` 成为唯一官方扩展工具链。
8. 旧 `plugin` 系统与相关构建链路被完全删除。
