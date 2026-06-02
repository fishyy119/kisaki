# 05 Renderer Task Center UI

## 入口

侧边栏下半部分新增任务中心按钮，放在 `AdderTrigger` 和设置按钮之间或 `AdderTrigger` 上方。

位置：

```text
apps/desktop/src/renderer/src/components/layout/sidebar.vue
```

按钮：

- icon: `icon-[mdi--progress-clock]` 或 `icon-[mdi--format-list-checks]`
- tooltip: `任务中心`
- active count badge: 当前 active task run 数。
- 点击打开 dialog，不跳转路由。

旧 `/background-task` 页面改为 `/automation` 页面，入口在主导航或设置菜单中根据产品取舍保留。它不再叫“后台任务”。

## Feature 目录

新增：

```text
apps/desktop/src/renderer/src/features/task-center/
  index.ts
  components/
    task-center-trigger.vue
    task-center-dialog.vue
    tabs/
      active/
        details-dialog.vue
        progress.vue
        row.vue
        toolbar.vue
        index.ts
      completed/
        details-dialog.vue
        row.vue
        toolbar.vue
        index.ts
      index.ts
    index.ts
  utils/
    display.ts
    index.ts
  types.ts
```

如果 store 被全应用初始化，也可以放在 `renderer/src/stores/task-run.ts`，但 task-center feature 应只通过 public store entry 使用。

## Store

Pinia store：

```ts
export const useTaskRunStore = defineStore('task-run', () => {
  const runs = ref(new Map<string, TaskRun>())
  const initialized = ref(false)

  const activeRuns = computed(...)
  const completedRuns = computed(...)

  async function init() { ... }
  async function refresh() { ... }
  function updateRun(run: TaskRun) { ... }
  function removeRun(runId: string) { ... }

  return { runs, activeRuns, completedRuns, init, refresh, updateRun, removeRun }
})
```

规则：

- `Map` 更新时必须 reassign 新 Map。
- 初始化时分别调用 `task-run:list-active` 和 `task-run:list-history`。active 列表来自 main 内存中的 runs manager，history 列表来自 persisted final rows。
- 订阅 `task-run:changed` 和 `task-run:deleted`。
- `task-run:changed` 可能已经在 main process 节流合并，但每条事件仍然是完整 snapshot，store 只按 `run.id` 替换。
- store 可以把 active/history 两条 IPC 结果组合成进行中和已完成两个 tab；这是 UI 状态组合，不是 renderer 直接查询 DB，也不是把 history 当作 active run 来源。
- 自动化页面、scanner 页面可以从同一 store 派生运行态，不各自维护第二份 progress。

在 `main.ts` idle init 中初始化：

```ts
await useTaskRunStore().init()
```

## Dialog

`TaskCenterDialog` 使用现有 Dialog 组件。

结构：

```text
DialogHeader
  title: 任务中心
DialogBody
  Tabs: 进行中 (n) / 已完成 (m)
  Active toolbar/list/detail dialog or completed toolbar/list/detail dialog
DialogFooter optional
```

建议 desktop 尺寸：

- 宽弹窗，例如 `w-[min(calc(100vw-2rem),980px)] max-w-none`。
- body height `min(72vh, 660px)`。
- 不使用左右分栏，主视图只保留单列表。
- header 只显示“任务中心”，数量放在 tab label 中。
- tab 和 toolbar 分两行，每个 tab 有自己的 toolbar、row 和 details dialog。
- 搜索结果数量只在搜索框有内容时显示。

移动/窄窗口：

- 单列列表。
- 详情入口仍使用信息图标按钮，不改成整行点击。

## Tabs

两个主视图：

### 进行中

包含 status：

```text
queued
running
pausing
paused
cancelling
```

排序：

1. cancelling。
2. paused/pausing。
3. running。
4. queued。
5. updatedAt desc。

### 已完成

包含 status：

```text
completed
failed
cancelled
```

排序：

```text
finishedAt desc
```

任务中心不提供 per-run dismissed 状态。用户需要清理历史时使用清理动作，清理策略由 main process 的 `TaskRunHistoryStore` 统一执行。

## Row

每行固定高度，避免 progress 更新引发布局跳动。

建议字段：

```text
icon/category
title + category/operation
phase position/label + work progress bar
count/rate/eta or duration/counters under the progress/result column
status badge
active controls + details action
```

`owner`、`initiator`、`subject`、operation id、完整 warnings 和 output 只放详情中。列表里的 warning 仅作为带数量的图标提示，并通过 tooltip 展示少量摘要。不单开指标列，进度/结果列承担进度条和轻量指标摘要。

row 不整体点击打开详情；详情入口只放在信息图标按钮中。active row 的操作列展示一排 pause/resume/cancel/details 图标按钮，completed row 只保留 details。controls 不放在详情 dialog 中，详情只承担元数据、警告和结果展示。

动作按钮：

- pause: `icon-[mdi--pause]`
- resume: `icon-[mdi--play]`
- cancel: `icon-[mdi--stop]`
- details: `icon-[mdi--information-outline]`

按钮必须有 tooltip 和 aria label。

## Progress display

Phase label：

```text
4/6 · 正在写入游戏
```

Determinate：

```text
work progress bar
42 / 100
42%
12 items/s
约 5 分钟
```

Indeterminate：

```text
spinner or animated compact bar
当前 phase label
已运行 1 分 20 秒
```

Live summary：

```text
succeeded / failed / skipped / warnings
最近 warning 摘要
```

规则：

- `phase.current/phase.total` 只渲染为 phase label 前的 `x/y`，不驱动下方 progress bar。
- 下方 progress bar 只表达 `work.percent` 或 `work.current/work.total`。
- phase 有 total 但 work 没有 total 时，progress bar 仍然是 indeterminate。
- active row 可以展示计数、速度、剩余时间等紧凑指标，但指标必须有清晰标签，不混在一段文本里。
- active row 不直接展开 warning 文本，只显示 warning 图标和 tooltip 摘要，完整列表放详情。
- completed row 使用 `result.counters` 和 `result.warnings`，不从最后一条 progress 推断结果。
- row 不按状态染底色，状态颜色只由 badge 表达；只有 failed 使用 destructive 状态色，cancelling 不使用 destructive。
- counters key 的展示文案由 `features/task-center/utils/display.ts` 统一映射。

格式化逻辑放在：

```text
features/task-center/utils/display.ts
```

不要在组件中散落时间、字节、速度格式化。

## Details

详情展示：

- 标题和状态。
- category、operation、owner、initiator、subject。
- startedAt、finishedAt、duration。
- detail 不展示运行状态 section。
- final detail 不展示 updatedAt。
- final detail 使用一个结果区展示 result summary、counters、error 和 output。
- 结果区不使用 badge，不单独展示“计数”标题。
- 结果区里 title 是主文案，summary/error 使用更小字号；summary 用 muted，error 保留 destructive 但弱化强度。
- warnings。

结果区中的 output：

- 使用 `pre`。
- 不与结果分成两个独立 section。
- 最大高度和滚动。
- 长文本 `whitespace-pre-wrap break-words`。
- 不默认展开非常大的 output。

首版不展示 event timeline，因为核心合同不建立 `task_run_events`。若后续新增低频 timeline，再作为详情增强。

## Empty states

进行中为空：

```text
暂无进行中的任务
```

已完成为空：

```text
暂无完成记录
```

不要写大段功能说明，不做营销式空状态。

## Filters

首版建议：

- search by title/subject/owner/initiator。
- category filter。
- active tab 使用 active statuses 的 status filter。
- completed tab 使用 final statuses 的 status filter。
- operation filter 作为后续增强。

不建议首版做复杂日期筛选；后续可加。

## Interaction rules

### Active controls

active row 的控制按钮：

1. pause 调用 `task-run:pause`，成功后等待状态变 `pausing` 或 `paused`。
2. resume 调用 `task-run:resume`，成功后等待状态回到 `running`。
3. cancel 调用 `task-run:cancel`，成功后等待 `task-run:changed` 更新为 `cancelling` 或 final 状态。
4. 控制请求 pending 时禁用该 row 的控制按钮，不在 renderer 伪造最终状态。
5. 如果返回 false，显示轻量 notify 提示。

### Clear completed

点击清理历史：

1. 调用 `task-run:clear-completed`。
2. main process 按统一 retention policy 删除可清理 run。
3. store 通过 `task-run:deleted` 移除对应 snapshot。

清理不是 dismissed。被删除的 task run 不再作为任务中心历史存在；automation history 不引用 run id，因此是否保留 automation invocation record 只由 AutomationService retention 决定。

## Sidebar badge

badge 显示 active count。

规则：

- 0 时隐藏。
- 1-9 显示数字。
- 10+ 显示 `9+`。
- failed completed 的红点可以基于 renderer 本地 `lastViewedTaskRunFinishedAt` 推导，不写入 TaskRun。

## Design system

遵循专业桌面软件风格：

- 高信息密度。
- 使用 `bg-popover`、`bg-background`、`border-border`。
- 列表使用 divider，不把页面 section 做成卡片。
- 单个 task row 可以用 hover background，不嵌套卡片。
- 控件高度保持 compact。
- icon button 全部有 tooltip。
- 不用大 hero、渐变背景或装饰性图形。

## Accessibility

- Dialog 打开后 focus 到第一个可操作控件或列表。
- row action button 有 tooltip 和 aria label。
- progress bar 提供 `aria-valuenow`/`aria-valuemax`。
- 状态不要只靠颜色表达，badge 文案必须明确。

## Notifications and task center

任务中心和 toast 是并行 presentation：

- toast 适合短暂提醒和轻量进度。
- task center 适合查看详情、结果和历史。
- loading toast 应可关闭。
- 关闭 toast 不取消 task。
- toast 上的取消必须是明确 action。
- renderer 用户关闭 toast 时必须发送 `notify:closed`，触发 main 的 notify close callback；TaskRunNotificationCoordinator 记录该 run 已关闭，后续 progress 不重新创建 loading toast。
- 关闭 loading toast 不影响 final result toast；是否显示 final toast 由 `presentation.notify.showResult` 决定。

用户点击 task toast 可打开 task center 并选中对应 run。此能力可作为后续增强，但 task run id 必须在 toast action handler 中可用。
