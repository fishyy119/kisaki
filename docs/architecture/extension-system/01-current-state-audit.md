# 01. 当前插件系统审计

本文件基于当前仓库真实代码进行审计，重点分析旧 `plugin` 系统的结构、耦合点、可复用资产和必须推倒重来的原因。

## 审计范围

本次审计覆盖的关键目录如下：

```text
apps/desktop/src/main/services/plugin/**
apps/desktop/src/renderer/src/core/plugin/**
apps/desktop/src/renderer/src/core/ui-extensions/**
apps/desktop/src/renderer/src/core/theme/**
apps/desktop/src/main/services/scraper/**
apps/desktop/src/main/services/deeplink/**
apps/desktop/src/main/services/event/**
apps/desktop/src/main/services/network/**
apps/desktop/src/main/services/notify/**
apps/desktop/src/main/services/db/**
packages/plugin-sdk/**
packages/plugin-cli/**
packages/create-kisaki-plugin/**
apps/desktop/scripts/build-plugin-types.ts
apps/desktop/rolldown.plugin-types.config.ts
```

## 当前系统结构

## 1. Main 侧：插件在主进程内直接执行

关键文件：

- `apps/desktop/src/main/services/plugin/service.ts`
- `apps/desktop/src/main/services/plugin/loader.ts`
- `apps/desktop/src/main/services/plugin/context.ts`
- `apps/desktop/src/main/services/plugin/installer.ts`
- `apps/desktop/src/main/services/plugin/watcher.ts`

现状特征：

- `PluginService` 负责插件扫描、安装、启停、热重载、registry provider、dev wait。
- `PluginLoader` 通过 `import(file://...)` 直接把插件入口加载进 Electron main process。
- `initializeKisakiGlobal(container)` 把 `ServiceContainer`、`schema`、`electron`、`drizzle`、`log` 直接挂进 `globalThis.kisaki`。
- 插件 `activate()` 在主进程里直接拿容器与所有 service。

这意味着：

- 扩展边界等于没有边界。
- 对外 API 实际上就是宿主内部结构本身。
- 任何 `ServiceContainer` 改动都会变成公开兼容性问题。

## 2. Renderer 侧：插件在渲染进程内直接执行

关键文件：

- `apps/desktop/src/renderer/src/core/plugin/loader.ts`
- `apps/desktop/src/renderer/src/core/plugin/context.ts`
- `apps/desktop/src/renderer/src/core/plugin/ui.ts`
- `apps/desktop/src/renderer/src/core/ui-extensions/*`

现状特征：

- renderer 监听 `plugin:loaded` / `plugin:unloaded` / `plugin:reloaded`，直接动态 import 扩展入口。
- `window.kisaki` / `globalThis.kisaki` 暴露 `app`、`router`、`pinia`、`db`、`schema`、`events`、`themes`、`notify`、`composables`、`stores`、`ui`、`log`。
- 扩展可直接访问内部 UI 组件、内部 composables、内部 Pinia stores。
- 扩展能注册 Sidebar、Detail Tabs、Settings Dialog，并直接注入 Vue 组件。

这意味着：

- 扩展与 renderer 运行时强绑定。
- 扩展公共 API 跟宿主 Vue 内部组织完全耦合。
- renderer 不能作为纯宿主 UI 层存在，而是被迫成为扩展执行环境。

## 3. UI 扩展当前是“组件注入式”

关键文件：

- `apps/desktop/src/renderer/src/core/ui-extensions/sidebar.ts`
- `apps/desktop/src/renderer/src/core/ui-extensions/detail-tabs.ts`
- `apps/desktop/src/renderer/src/core/ui-extensions/settings.ts`
- `apps/desktop/src/renderer/src/core/ui-extensions/menus.ts`

现状特征：

- Sidebar 允许新增导航项和路径。
- Detail Tabs 允许注入任意组件。
- Settings 允许扩展注入完整对话框组件。
- Menu 仅支持 action item，不支持结构化 checkbox/select 状态模型。

问题不在“能不能做”，而在“宿主永远无法收敛”：

- 扩展一旦能注入任意组件，就会把内部 UI 设计系统、状态管理、路由、生命周期全部暴露成公共平台。
- 扩展页面、Tab、Dialog 一旦落地，就会不断要求更多 renderer 内部能力。

## 4. SDK 的本质是“把宿主内部模块重新打包导出”

关键文件：

- `packages/plugin-sdk/src/main/index.ts`
- `packages/plugin-sdk/src/main/electron.ts`
- `packages/plugin-sdk/src/renderer/index.ts`
- `packages/plugin-sdk/src/renderer/ui.ts`
- `packages/plugin-sdk/src/types/*`

现状特征：

- SDK 不是围绕稳定契约设计的，而是围绕 `globalThis/window.kisaki` 的宿主注入对象设计的。
- SDK 暴露主进程 `container`、renderer `db/router/pinia/app`、electron re-export、drizzle re-export、Vue re-export、宿主 UI 组件全集。
- 类型生成不是由 SDK 自己定义，而是从 `apps/desktop` 反推导出到 `plugin-types`，再复制到 SDK。

这意味着：

- SDK 只是宿主内部 API 的镜像层。
- 任何内部重构都会牵动 SDK 与模板。
- 公开平台无法稳定演进，因为它不是先设计再实现，而是先实现再导出。

## 5. 工具链是“多源头拼接”的

关键文件：

- `packages/plugin-cli/src/commands/*.ts`
- `packages/create-kisaki-plugin/templates/default/vite.config.ts`
- `apps/desktop/scripts/build-plugin-types.ts`
- `packages/plugin-sdk/scripts/build.ts`

现状特征：

- 插件模板用 Vite 构建双入口产物。
- CLI `build` / `pack` 实际上直接调用 `npx vite build`。
- Manifest 来源是 `src/shared/manifest.ts`，再由 Vite 插件写成 `dist/manifest.json`。
- 类型系统依赖 `rolldown + dts` 从 app 反向生成，再拷贝进 SDK，再由 tsdown 构建。

问题：

- 工具链不统一。
- Manifest 不是纯元数据文件，而是构建生成产物。
- 模板、CLI、SDK、app 类型管线彼此缠绕。

## 6. 安装包与运行模型仍围绕“插件目录 + 主渲染双入口”

现状特征：

- 包格式本质是 zip。
- `manifest.json` 使用 `main` / `renderer` 双入口字段。
- dev mode 通过 `--dev-plugin`、`@debug.*` 软链接、主进程 watcher 与 renderer 事件联动。

问题：

- 运行模型直接绑定“主进程入口 + 渲染进程入口”。
- 热重载逻辑被拆成 main/renderer 双侧。
- 包结构天然鼓励 renderer 扩展执行。

## 7. 现有项目里已经存在几个很好的“注册式”资产

这部分不是问题，而是新系统的基础。

### 7.1 Scraper 已经是注册式模块

关键文件：

- `apps/desktop/src/main/services/scraper/service.ts`
- `apps/desktop/src/main/services/scraper/handlers/common/registry.ts`

可复用点：

- provider registry
- provider contract validation
- provider info / search / resolve / session 模型

结论：

scraper 很适合作为新的 extension point，改造成“宿主 registry + 扩展 contribution 接线模块”。

### 7.2 Deeplink 已经是注册式路由器

关键文件：

- `apps/desktop/src/main/services/deeplink/service.ts`
- `apps/desktop/src/main/services/deeplink/router.ts`

可复用点：

- route handler registry
- main 统一入口
- renderer 只消费结果事件

结论：

deeplink 适合升级为可注册的扩展点，但当前 `DeeplinkAction` 联合类型太封闭，需要改为开放式 route namespace。

### 7.3 Theme 已经是注册式 registry

关键文件：

- `apps/desktop/src/renderer/src/core/theme/manager.ts`
- `apps/desktop/src/renderer/src/stores/theme.ts`

可复用点：

- theme registry
- active theme 管理
- light/dark/system 模式切换

问题：

- 当前 theme 以原始 CSS 字符串注册，仍然偏自由注入。

结论：

theme 可以保留 registry 思路，但应升级成“语义 token theme”而不是“任意 CSS theme”。

### 7.4 Event / Network / Notify 已经接近 capability 形态

关键文件：

- `apps/desktop/src/main/services/event/service.ts`
- `apps/desktop/src/main/services/network/service.ts`
- `apps/desktop/src/main/services/notify/service.ts`

可复用点：

- 宿主已经有清晰的事件、网络、通知服务。
- 它们天然适合作为扩展 capability，而不是 service container 的一部分被暴露出去。

## 现状问题汇总

| 领域             | 当前实现                               | 根本问题                  | 新系统方向                        |
| ---------------- | -------------------------------------- | ------------------------- | --------------------------------- |
| 主进程扩展执行   | `PluginLoader` 直接在 main import 扩展 | 扩展拿到容器和内部服务    | 共享扩展宿主进程                  |
| 渲染进程扩展执行 | renderer 动态 import 扩展入口          | 扩展与 Vue 运行时强耦合   | renderer 不执行扩展代码           |
| 公开 API         | `globalThis/window.kisaki`             | 公共 API 等于宿主内部对象 | `packages/extension-api` 契约优先 |
| UI 扩展          | 组件注入、页面/Tab/Sidebar 扩展        | 无法收敛 UI 边界          | 受控贡献模型                      |
| SDK              | 反向导出宿主内部模块                   | 公开 API 不稳定           | 共享契约 + SDK 包装               |
| 类型系统         | app 反向生成 `plugin-types`            | 依赖倒置错误              | 类型定义前置到 packages           |
| 构建工具链       | Vite + rolldown + copy + tsdown        | 链路冗长且分裂            | tsdown 统一构建                   |
| Manifest         | TS 文件生成 JSON，双入口               | 不是纯元数据              | 独立最小 `manifest.json`          |
| 运行模型         | main/renderer 双入口                   | 设计天然侵入 renderer     | 单入口 `entry`                    |

## 必须保留的项目级设计资产

新系统不需要继承旧插件 API，但应保留以下项目内在优势：

1. Main 侧 `ServiceContainer` 的生命周期和依赖顺序管理。
2. `ScraperService`、`DeeplinkService`、`ThemeManager` 这些已经具备 registry 形态的模块。
3. `EventService`、`NetworkService`、`NotifyService` 这些适合做 capability 的稳定 service。
4. `DbService` 作为内部实现基础，但不再作为公开扩展 API。
5. Renderer 中围绕菜单、设置、theme 的现有宿主 UI 组件，可以作为“受控渲染器”复用。

## 审计结论

当前系统的问题不是“插件 API 太多”，而是“扩展平台根本不存在，只有宿主内部对象的外泄”。

因此新的 `extension` 系统必须同时完成以下几件事：

1. 切断 renderer 扩展执行。
2. 切断主进程容器直出。
3. 把公开接口定义前置到 `packages`。
4. 把 UI 扩展改为结构化贡献协议。
5. 把宿主能力改为 capability API，而不是 service 暴露。
6. 把现有 scraper / deeplink / theme 注册能力纳入统一扩展模型。

只有这样，Kisaki 的扩展系统才会变成一个真正可以维护和演进的平台。
