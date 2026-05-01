# 05 Renderer And Components

renderer 的职责是把 `ExtensionUiDocument` 映射到现有 Vue UI 组件，并把用户事件转换成 Extension UI dispatch。它不能执行扩展代码，也不能接受扩展传入的任意 class 或 component。

## 目录结构

```text
apps/desktop/src/renderer/src/core/extensions/ui/
  index.ts
  ipc.ts
  store.ts
  draft.ts
  events.ts
  patch.ts
  types.ts

apps/desktop/src/renderer/src/components/shared/extension/
  index.ts
  renderer/
    document-renderer.vue
    node-renderer.vue
    component-registry.ts
    component-adapter.ts
    fallback-node.vue
  surfaces/
    dialog-outlet/
      extension-dialog-outlet.vue
      extension-dialog-frame.vue
    settings/
      settings-dialog-stack.vue
      settings-dialog-frame.vue
    entity-menu/
      entity-menu-items.vue
      menu-content-group.vue
  adapters/
    layout.ts
    display.ts
    form.ts
    overlay.ts
    menu.ts
```

`components/shared/extension/` 本身就是扩展 renderer 组件边界。迁移完成后删除旧的 settings/entity menu 直连组件，新的 `renderer/`、`surfaces/`、`adapters/` 直接挂在该边界下。

## Renderer core facade

`core/extensions/ui/ipc.ts` 暴露：

- `getExtensionUiContributions()`
- `openExtensionUiSession(request)`: 打开注册 contribution surface。
- `openExtensionUiMountSession(request)`: 从 command/open target 打开同 extension mount session。
- `refreshExtensionUiSession(request)`
- `dispatchExtensionUiEvent(request)`
- `releaseExtensionUiSession(request)`

`events.ts` 或 surface driver 层提供 command dispatcher，用于解释 static command。`open` command 的 `outlet` 决定调用当前 surface stack 还是应用级 dialog outlet；`open`、`notify`、`refresh` 这类需要 owner/session 校验的命令仍要经过 main IPC。document update command 只能来自 host action result，不允许 renderer 从静态 handler 直接执行 replace 或 patch。

renderer 需要提供一个小型 patch applier，但不实现自动 diff。patch applier 只接受 host 已校验的节点级 patch，并在本地再次校验 `baseDocumentId`、目标 nodeId、root 约束和 component allowlist。应用成功后用 patch command 的新 `documentId` 更新当前 document；应用失败时自动 refresh 一次，避免局部状态和 host session 分叉。

`store.ts` 接收 `extension:contributions-changed`，但 snapshot 内使用 Extension UI contribution info。

`draft.ts` 管表单值：

- 按 `Form` scope 收集 `name`。
- `defaultValue` 初始化非受控本地 draft；refresh/replace/patch document 后以新 document 的 `defaultValue` 重新初始化当前 form scope。
- `value` 是受控值，由 document 驱动显示；用户编辑受控控件时必须触发 `onChange` dispatch，等待 host 返回 refresh/replace/patch 后以新 document value 提交。
- 同一个控件不能同时声明 `defaultValue` 和 `value`；renderer adapter 发现冲突时显示局部 fallback 并记录 warning。
- `disabled` 同时阻止本地 draft 更新和 dispatch。
- submit 时发送当前 form scope 的 `values`。
- 非受控 change 缺省只更新本地 draft；显式声明 `onChange` 时才额外 dispatch 到 host。
- 受控 change 如果没有 `onChange`，控件按 read-only 渲染；action pending 时可显示临时 busy/optimistic state，但必须在 action 完成后以 document value 重新对齐。
- Input、Textarea、Select、Checkbox、Switch、RadioGroup、Slider、SegmentedControl 等值控件都遵守同一套 `defaultValue` / `value` 二选一规则。
- dialog footer 中的 submit button 通过 `form` 关联 `Form.id`，不需要把按钮放在 form children 内。
- dispatch payload 不携带 `extensionId`、`runtimeHandle` 或 `surfaceInput`；renderer 只提交 session/document/action ids 和表单值。

## Component registry

`component-registry.ts` 是 Extension UI 的核心白名单：

```ts
export const extensionUiComponentRegistry = {
  Stack: createLayoutAdapter(StackAdapter),
  Inline: createLayoutAdapter(InlineAdapter),
  Section: createLayoutAdapter(SectionAdapter),
  Button: createFormAdapter(ButtonAdapter),
  Input: createFormAdapter(InputAdapter),
  MenuItem: createMenuAdapter(MenuItemAdapter)
} satisfies ExtensionUiComponentRegistry
```

每个 adapter 负责：

- 校验 renderer 层 props fallback。
- 映射 semantic props 到 Vue UI component props。
- 绑定事件到 static command、`dispatchExtensionUiEvent` 或 local draft。
- 渲染 children 和 slots。

未知 component、错误 props、action dispatch failure 都渲染可控错误 UI，并记录 console warning。

## 新增布局组件

Phase 5 MVP 新增 `apps/desktop/src/renderer/src/components/ui/layout/`：

- `stack.vue`
- `inline.vue`
- `grid.vue`
- `scroll-area.vue`
- `section.vue`
- `group.vue`
- `toolbar.vue`
- `index.ts`
- `types.ts`
- `variants.ts`

这些组件是 renderer 自用基础组件，也会由 Extension UI adapter 复用。命名遵循现有 UI 库：folderized、kebab-case 文件、显式 named exports。

`split.vue`、`panel.vue` 可以作为 renderer 内部组件后续追加，但不进入第一版 Extension UI public schema。第一版先服务 settings dialog、entity menu content 和 dialog outlet，避免公开 contract 一次性过大。

### Layout variant 约束

- gap: `none | xs | sm | md | lg`
- density: `compact | default | spacious`
- align: `start | center | end | stretch`
- justify: `start | center | end | between`
- tone/background: `plain | surface | subtle`

不开放 arbitrary Tailwind class。

## Settings surface adapter

settings adapter 复用现有 dialog stack 体验，但内部渲染 Extension UI document：

- root document 必须是 `Dialog`，由扩展声明 `title`、`description`、`size`，并提供 `content`、`footer` slots。
- `ExtensionUiCommand.open` 默认使用 `outlet: 'current'`，返回的 `Dialog` document 由同一个 settings dialog stack 处理。
- `outlet: 'dialog'` 可以显式转交给应用级 Extension UI dialog outlet。
- `close all`、`close current`、`refresh current`、`refresh stack` 由 surface adapter 处理。

这样 settings 始终保留 Dialog 的原生结构、样式和交互语义。

## Entity menu surface adapter

entity menu adapter 把每个 contribution 的 menu content document 映射到调用方传入的 `MenuComponents`。新的 `entity-menu-items.vue` 仍保留调用形态，内部改为：

- open Extension UI sessions for matching contributions。
- 每个 session 返回一个 menu content document，root 是 `MenuNode` 或 `Fragment<MenuNode>`。
- `MenuContentGroup` 将 Extension UI menu content node 映射到主应用已有 entity menu 的 dropdown/context menu primitives。
- entity menu surface 把扩展贡献的 menu content 追加到主应用已有 entity menu 中，并提供 target input 和宿主 menu component set。
- action dispatch 后按 command 决定刷新当前 session、关闭菜单、替换或 patch document，或把 `outlet: 'dialog'` 的 open command 转交给应用级 dialog outlet。

entity menu surface 必须限制组件：

- 允许 `Menu*`、`Icon`、`Text`、`Badge`、`Spinner`、`Separator`、少量 `Inline`。
- 禁止 `Form`、大布局、嵌套 `Dialog`、嵌套 `Popover`。
- 如果扩展需要复杂交互，应从 menu action 使用 `ui.command.open(target, { outlet: 'dialog' })` 打开独立 dialog session。

## Dialog outlet adapter

`dialog-outlet/extension-dialog-outlet.vue` 是应用级 Extension UI dialog 挂载点。它负责：

- 接收来自任意 surface 的 `open` command。
- 调用 `openExtensionUiMountSession` 为 target 创建独立 dialog session，surface 为 `dialog`。
- 校验 target document root 必须是 `Dialog`。
- 复用 renderer `components/ui/dialog` 的 header/body/footer、focus trap、层级和关闭行为。
- 在来源 surface 关闭或释放后继续持有 dialog session，直到 dialog 自身关闭。

## 组件 API 映射（Phase 5 MVP）

Extension UI `Button` 映射到 `components/ui/button`：

- `variant`: `default | destructive | outline | secondary | ghost | link | text`
- `size`: `xs | sm | md | lg | icon`
- `icon`: Kisaki 公共 icon id 或构建期 safelist 内的 Iconify class
- `type`: `button | submit | reset`
- `form`: associated form id for dialog footer submit buttons
- `onClick`: action

Extension UI `Field` 映射到 `components/ui/field`：

- `orientation`: `vertical | horizontal | responsive`
- `label`
- `description`
- `control` slot: 单个表单控件或受控组合

Extension UI `Input` 映射到 `components/ui/input`：

- `name`
- `type`: `text | number | password | email | url | search | tel`
- `defaultValue`
- `value`
- `placeholder`
- `min`、`max`、`step`: `type: 'number'` 时可用
- `onChange`

Extension UI `Select` 映射到 `components/ui/select`：

- `name`
- `defaultValue`
- `value`
- `placeholder`
- `options`
- `onChange`

Extension UI `Dialog` 映射到 `components/ui/dialog`：

- `title`
- `description`
- `size`
- `onOpenChange`
- slots: `content`、`footer`、可选 `trigger`

Extension UI menu content 映射到调用方传入的 `MenuComponents`：

- `MenuGroup`、`MenuItem`、`MenuCheckboxItem`、`MenuRadioGroup`、`MenuRadioItem`、`MenuSub`、`MenuSeparator`、`MenuLabel`
- entity menu contribution 不渲染 `Menu` root；它只渲染 `ui.menu.*` 内容节点，并由 entity menu surface 选择当前宿主正在使用的 dropdown 或 context primitives。

以下 adapter 推迟到后续独立小版本：`Tabs`、`Popover`、完整 `Menu` overlay、`Table`、`Image`、`Markdown`、`Progress`、`Empty`、图表和 VirtualList。renderer 已有组件不等于 Extension UI 第一版必须公开。

## 可访问性和交互状态

- 所有 interactive adapter 必须保留 focus-visible。
- `disabled` 同时阻止 dispatch。
- busy action 的 node 显示 spinner 或禁用状态。
- action dispatch 使用 per-action busy key，不锁整个 surface，除非 command 标记 `blocking`。
- settings dialog close 时如果 busy，遵循当前 renderer dialog pattern：不允许关闭。

## 错误体验

- document render 错误：surface body 显示 “扩展 UI 无法渲染”，附短错误 message。
- action 错误：renderer toast 显示 “扩展 UI 操作失败”。
- unknown component：在局部渲染 muted fallback，避免整个 document 空白。
- stale document：自动 refresh 一次，失败后显示可重试错误。
