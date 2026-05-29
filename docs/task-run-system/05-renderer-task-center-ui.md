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
    task-run-row.vue
    task-run-details.vue
    task-run-progress.vue
    task-run-result.vue
    task-run-toolbar.vue
    index.ts
  stores/
    task-run-store.ts
    index.ts
  utils/
    display.ts
    layout.ts
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
- 初始化时调用 `task-run:list { status: 'all', limit }`。
- 订阅 `task-run:changed` 和 `task-run:deleted`。
- store 只保存 UI 需要的 snapshot，不直接查询 DB。
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
  summary: n 个进行中 / m 个已完成
DialogBody
  Tabs: 进行中 / 已完成
  Toolbar: search, category filter, status filter, clear completed
  List
  Details pane or nested details dialog
DialogFooter optional
```

建议 desktop 尺寸：

- `DialogContent class="max-w-5xl"`
- body height `min(76vh, 720px)`
- 左右分栏：左列表，右详情。

移动/窄窗口：

- 单列列表。
- 点击 row 打开详情内层 dialog。

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

任务中心不提供 per-run dismissed 状态。用户需要清理历史时使用清理动作，清理策略由 main process 的 `TaskRunStore` 统一执行。

## Row

每行固定高度，避免 progress 更新引发布局跳动。

建议字段：

```text
icon/category
title + subject.labelSnapshot
phase/message
progress bar + count + live counters
rate/eta/duration
status badge
actions
```

动作按钮：

- pause: `icon-[mdi--pause]`
- resume: `icon-[mdi--play]`
- cancel: `icon-[mdi--stop]`
- details: `icon-[mdi--information-outline]`

按钮必须有 tooltip。

## Progress display

Determinate：

```text
progress bar
42 / 100
42%
12 items/s
约 5 分钟
```

Indeterminate：

```text
spinner or animated compact bar
当前 message
已运行 1 分 20 秒
```

Live summary：

```text
succeeded / failed / skipped / warnings
最近 warning 摘要
```

规则：

- active row 可以展示 `progress.counters` 的有限摘要，例如成功、失败、跳过、警告数。
- active row 最多展示 1 条 `progress.warnings` 摘要，完整列表放详情。
- completed row 使用 `result.counters` 和 `result.warnings`，不从最后一条 progress 推断结果。
- counters key 的展示文案由 `features/task-center/utils/display.ts` 统一映射。

格式化逻辑放在：

```text
features/task-center/utils/display.ts
```

不要在组件中散落时间、字节、速度格式化。

## Details

详情展示：

- 标题和状态。
- category、operation、initiator、subject。
- startedAt、finishedAt、duration。
- 当前 progress。
- result summary。
- counters。
- warnings。
- error。
- output JSON 预览。

输出区域：

- 使用 `pre`。
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

- search by title/subject/initiator。
- category filter。
- status filter for completed。
- operation filter 作为后续增强。

不建议首版做复杂日期筛选；后续可加。

## Interaction rules

### Cancel

点击取消：

1. 若 task `cancelable`，调用 `task-run:cancel`。
2. 按钮进入 disabled/loading。
3. store 等待 `task-run:changed` 更新为 `cancelling`。
4. 如果返回 false，提示任务已结束或不可取消。

### Pause

点击暂停：

1. 调用 `task-run:pause`。
2. 成功后等待状态变 `pausing` 或 `paused`。
3. 不直接在 renderer 伪造 paused。

### Resume

点击继续：

1. 调用 `task-run:resume`。
2. 成功后等待状态回到 `running`。

### Clear completed

点击清理历史：

1. 调用 `task-run:clear-completed`。
2. main process 按统一 retention policy 删除可清理 run。
3. store 通过 `task-run:deleted` 移除对应 snapshot。

清理不是 dismissed。被删除的 task run 就不再作为自动化历史、命令历史或任务中心历史存在。

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
- renderer 关闭 toast 时必须通知 main 的 notify close callback；TaskRunNotificationCoordinator 记录该 run 已关闭，后续 progress 不重新创建 loading toast。
- 关闭 loading toast 不影响 final result toast；是否显示 final toast 由 `presentation.notify.showResult` 决定。

用户点击 task toast 可打开 task center 并选中对应 run。此能力可作为后续增强，但 task run id 必须在 toast action handler 中可用。
