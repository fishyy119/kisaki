<!--
Vnite Import Wizard App is the import webview document root: step navigation,
options form, preview/run/done views, and modals.
Boundary: all flow state lives in the extension host; the UI renders
`VniteWizardState` and drives transitions through `host` RPC.
-->
<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { TaskRunStatus, GameUpdateSurface } from '@kisaki3/extension-sdk'
import type { VniteImportFieldSelection } from '../../shared/import-wizard'
import type { VniteImportOptionsForm, VniteWizardState } from '../../shared/import-wizard'
import { countSelectedFields, countTotalFields } from './fields'
import { host, toErrorMessage } from './rpc'
import Modal from './components/modal.vue'
import FieldsModal from './components/fields-modal.vue'

const STEP_LABELS: Record<VniteWizardState['step'], string> = {
  pickBackup: '选择备份包',
  config: '导入配置',
  preview: '预览',
  running: '导入中',
  done: '完成'
}

const SUBMIT_LABELS: Record<VniteWizardState['step'], string> = {
  pickBackup: '下一步',
  config: '生成预览',
  preview: '开始导入',
  running: '刷新状态',
  done: '导入另一个备份包'
}

const RUN_STATUS_LABELS: Record<TaskRunStatus, string> = {
  queued: '排队中',
  running: '运行中',
  pausing: '暂停中',
  paused: '已暂停',
  cancelling: '取消中',
  completed: '已完成',
  failed: '已失败',
  cancelled: '已取消'
}

const STEP_ORDER: readonly VniteWizardState['step'][] = [
  'pickBackup',
  'config',
  'preview',
  'running',
  'done'
]

const CONFLICT_MODE_OPTIONS = [
  { value: 'skipExisting', label: '跳过现有' },
  { value: 'mergeSelected', label: '合并缺失字段' },
  { value: 'overwriteSelected', label: '覆盖所选字段' }
] as const

const COMPLETION_PRESET_OPTIONS = [
  { value: 'missingCoreAndMedia', label: '补全缺失的核心资料与媒体' },
  { value: 'missingAll', label: '补全所有缺失字段' },
  { value: 'custom', label: '自定义字段' }
] as const

const COMPLETION_SURFACE_OPTIONS: readonly { value: GameUpdateSurface; label: string }[] = [
  { value: 'name', label: '名称' },
  { value: 'originalName', label: '原名' },
  { value: 'releaseDate', label: '发售日期' },
  { value: 'description', label: '简介' },
  { value: 'relatedSites', label: '相关网站' },
  { value: 'externalIds', label: '外部 ID' },
  { value: 'tags', label: '标签' },
  { value: 'person', label: '人员' },
  { value: 'company', label: '公司' },
  { value: 'character', label: '角色' },
  { value: 'covers', label: '封面' },
  { value: 'backdrops', label: '背景图' },
  { value: 'logos', label: 'Logo' },
  { value: 'icons', label: '图标' }
]

const state = ref<VniteWizardState | null>(null)
const options = reactive<VniteImportOptionsForm>({
  completeMetadata: false,
  scraperProfileId: '',
  completionSurfacePreset: 'missingCoreAndMedia',
  completionSurfaces: [],
  conflictMode: 'mergeSelected',
  strictAttachments: false
})
const loading = ref(true)
const busy = ref(false)
const error = ref<string | null>(null)
const fieldsOpen = ref(false)
const diagnosticsOpen = ref(false)
const savingFields = ref(false)

const stepIndex = computed(() => (state.value ? STEP_ORDER.indexOf(state.value.step) : 0))
const totalFieldCount = countTotalFields()
const selectedFieldCount = computed(() =>
  state.value ? countSelectedFields(state.value.fieldSelection) : 0
)
const runStatusText = computed(() => {
  const run = state.value?.run
  if (!run) {
    return RUN_STATUS_LABELS.running
  }

  return run.phaseLabel ?? RUN_STATUS_LABELS[run.status]
})

onMounted(() => {
  void runHostAction(() => host.getState())
})

function applyState(next: VniteWizardState): void {
  state.value = next
  Object.assign(options, next.options)
}

async function runHostAction(action: () => Promise<VniteWizardState>): Promise<void> {
  if (busy.value) {
    return
  }

  busy.value = true
  error.value = null
  try {
    applyState(await action())
  } catch (cause) {
    error.value = toErrorMessage(cause)
  } finally {
    busy.value = false
    loading.value = false
  }
}

function submit(): void {
  const current = state.value
  if (!current) {
    return
  }

  switch (current.step) {
    case 'pickBackup':
      void runHostAction(() => host.goToConfig())
      return
    case 'config':
      void runHostAction(() => host.generatePreview(snapshotOptions()))
      return
    case 'preview':
      void runHostAction(() => host.startImport(snapshotOptions()))
      return
    case 'running':
      void runHostAction(() => host.getState())
      return
    case 'done':
      void runHostAction(() => host.resetFlow())
  }
}

function snapshotOptions(): VniteImportOptionsForm {
  return { ...options, completionSurfaces: [...options.completionSurfaces] }
}

function pickFile(): void {
  void runHostAction(() => host.pickBackupFile())
}

function resetFlow(): void {
  void runHostAction(() => host.resetFlow())
}

function backToConfig(): void {
  void runHostAction(() => host.backToConfig())
}

function saveFields(selection: VniteImportFieldSelection): void {
  savingFields.value = true
  void runHostAction(() => host.saveFieldSelection(selection)).finally(() => {
    savingFields.value = false
    fieldsOpen.value = false
  })
}

function toggleSurface(surface: GameUpdateSurface, checked: boolean): void {
  const next = new Set(options.completionSurfaces)
  if (checked) {
    next.add(surface)
  } else {
    next.delete(surface)
  }
  options.completionSurfaces = [...next]
}

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`
  }

  const units = ['KB', 'MB', 'GB'] as const
  let current = value / 1024
  for (const unit of units) {
    if (current < 1024 || unit === 'GB') {
      return `${current.toFixed(current >= 10 ? 0 : 1)} ${unit}`
    }
    current /= 1024
  }

  return `${value} B`
}
</script>

<template>
  <div class="flex h-screen flex-col">
    <nav class="flex gap-3 border-b border-border px-4 py-3 text-xs">
      <span
        v-for="(step, index) in STEP_ORDER"
        :key="step"
        :class="
          index === stepIndex
            ? 'font-semibold text-primary'
            : index < stepIndex
              ? 'text-foreground'
              : 'text-muted-foreground'
        "
      >
        {{ index + 1 }}. {{ STEP_LABELS[step] }}
      </span>
    </nav>

    <p
      v-if="error"
      class="notice notice-danger mx-4 mt-2"
    >
      {{ error }}
    </p>

    <main
      v-if="state"
      class="flex-1 overflow-y-auto px-4 py-3"
    >
      <!-- pickBackup -->
      <section v-if="state.step === 'pickBackup'">
        <div class="field">
          <div class="field-info">
            <span class="field-label">备份包</span>
            <span class="field-hint">选择从 Vnite 导出的数据库备份 zip。</span>
          </div>
          <div class="field-control">
            <span :class="state.file ? '' : 'text-muted-foreground'">
              {{
                state.file ? `${state.file.name}（${formatBytes(state.file.sizeBytes)}）` : '未选择'
              }}
            </span>
            <button
              type="button"
              :disabled="busy"
              @click="pickFile"
            >
              {{ state.file ? '更换文件' : '选择文件' }}
            </button>
          </div>
        </div>
      </section>

      <!-- config -->
      <section v-else-if="state.step === 'config'">
        <div class="field">
          <div class="field-info">
            <span class="field-label">字段</span>
            <span class="field-hint">选择从备份包写入资料库的字段。</span>
          </div>
          <div class="field-control">
            <span>{{ selectedFieldCount }}/{{ totalFieldCount }}</span>
            <button
              type="button"
              @click="fieldsOpen = true"
            >
              编辑字段
            </button>
          </div>
        </div>

        <p
          v-if="state.profiles.length === 0"
          class="notice"
        >
          尚未配置游戏刮削配置，无法启用元数据补全。
        </p>

        <div class="field">
          <div class="field-info">
            <span class="field-label">元数据补全</span>
            <span class="field-hint">导入后使用刮削配置补全缺失资料。</span>
          </div>
          <div class="field-control">
            <input
              v-model="options.completeMetadata"
              type="checkbox"
              :disabled="state.profiles.length === 0"
            />
          </div>
        </div>

        <div
          v-if="options.completeMetadata"
          class="field"
        >
          <div class="field-info"><span class="field-label">刮削配置</span></div>
          <div class="field-control">
            <select v-model="options.scraperProfileId">
              <option
                v-for="profile in state.profiles"
                :key="profile.value"
                :value="profile.value"
              >
                {{ profile.label }}
              </option>
            </select>
          </div>
        </div>

        <div
          v-if="options.completeMetadata"
          class="field"
        >
          <div class="field-info"><span class="field-label">补全范围</span></div>
          <div class="field-control check-group">
            <label
              v-for="preset in COMPLETION_PRESET_OPTIONS"
              :key="preset.value"
            >
              <input
                v-model="options.completionSurfacePreset"
                type="radio"
                :value="preset.value"
              />
              {{ preset.label }}
            </label>
          </div>
        </div>

        <div
          v-if="options.completeMetadata && options.completionSurfacePreset === 'custom'"
          class="field"
        >
          <div class="field-info"><span class="field-label">自定义字段</span></div>
          <div class="field-control check-group">
            <label
              v-for="surface in COMPLETION_SURFACE_OPTIONS"
              :key="surface.value"
            >
              <input
                type="checkbox"
                :checked="options.completionSurfaces.includes(surface.value)"
                @change="toggleSurface(surface.value, ($event.target as HTMLInputElement).checked)"
              />
              {{ surface.label }}
            </label>
          </div>
        </div>

        <div class="field">
          <div class="field-info">
            <span class="field-label">冲突策略</span>
            <span class="field-hint">命中现有游戏时的写入方式。</span>
          </div>
          <div class="field-control">
            <select v-model="options.conflictMode">
              <option
                v-for="mode in CONFLICT_MODE_OPTIONS"
                :key="mode.value"
                :value="mode.value"
              >
                {{ mode.label }}
              </option>
            </select>
          </div>
        </div>

        <div class="field">
          <div class="field-info">
            <span class="field-label">附件失败时中止</span>
            <span class="field-hint">关闭时附件失败仅记录诊断。</span>
          </div>
          <div class="field-control">
            <input
              v-model="options.strictAttachments"
              type="checkbox"
            />
          </div>
        </div>
      </section>

      <!-- preview -->
      <section v-else-if="state.step === 'preview' && state.preview">
        <div class="stat-grid">
          <div class="stat">
            <span class="stat-label">新增</span>
            <span class="stat-value">{{ state.preview.summary.created }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">更新</span>
            <span class="stat-value">{{ state.preview.summary.updated }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">跳过</span>
            <span
              class="stat-value"
              :class="state.preview.summary.skipped > 0 ? 'text-accent' : ''"
            >
              {{ state.preview.summary.skipped }}
            </span>
          </div>
          <div class="stat">
            <span class="stat-label">Error</span>
            <span
              class="stat-value"
              :class="state.preview.summary.errors > 0 ? 'text-danger' : ''"
            >
              {{ state.preview.summary.errors }}
            </span>
          </div>
          <div class="stat">
            <span class="stat-label">Warning</span>
            <span
              class="stat-value"
              :class="state.preview.summary.warnings > 0 ? 'text-accent' : ''"
            >
              {{ state.preview.summary.warnings }}
            </span>
          </div>
        </div>

        <div class="field">
          <div class="field-info">
            <span class="field-label">写入计划</span>
            <span class="field-hint">
              {{
                state.preview.writePlanTotal > state.preview.writePlan.length
                  ? `前 ${state.preview.writePlan.length} / ${state.preview.writePlanTotal}`
                  : `共 ${state.preview.writePlanTotal} 个游戏`
              }}
            </span>
          </div>
        </div>
        <ul class="mt-1 mb-2 columns-2 list-disc pl-[18px] text-xs">
          <li
            v-for="title in state.preview.writePlan"
            :key="title"
          >
            {{ title }}
          </li>
        </ul>

        <template v-if="state.preview.updates.length > 0">
          <div class="field">
            <div class="field-info">
              <span class="field-label">已有游戏更新计划</span>
              <span class="field-hint">
                {{
                  state.preview.updatesTotal > state.preview.updates.length
                    ? `前 ${state.preview.updates.length} / ${state.preview.updatesTotal}`
                    : `共 ${state.preview.updatesTotal} 个游戏`
                }}
              </span>
            </div>
          </div>
          <article
            v-for="group in state.preview.updates"
            :key="group.id"
            class="mb-2 rounded-md border border-border px-2.5 py-2"
          >
            <h3 class="mt-0 mb-1.5 text-xs font-semibold">{{ group.title }}</h3>
            <table class="table-plain">
              <tbody>
                <tr
                  v-for="(row, index) in group.rows"
                  :key="index"
                >
                  <td class="whitespace-nowrap text-muted-foreground">{{ row.label }}</td>
                  <td class="text-muted-foreground">{{ row.before }}</td>
                  <td class="text-muted-foreground">→</td>
                  <td>{{ row.after }}</td>
                </tr>
              </tbody>
            </table>
          </article>
        </template>

        <div
          v-if="state.diagnosticsTotal > 0"
          class="field"
        >
          <div class="field-info">
            <span class="field-label">诊断</span>
            <span class="field-hint">需要处理 {{ state.diagnosticsTotal }} 项。</span>
          </div>
          <div class="field-control">
            <button
              type="button"
              @click="diagnosticsOpen = true"
            >
              查看诊断
            </button>
          </div>
        </div>
      </section>

      <!-- running -->
      <section v-else-if="state.step === 'running'">
        <div class="field">
          <div class="field-info">
            <span class="field-label">运行状态</span>
          </div>
          <div class="field-control">
            <span>{{ runStatusText }}</span>
          </div>
        </div>
        <p class="notice">导入运行中，取消请到任务中心处理。</p>
        <table
          v-if="state.run && Object.keys(state.run.counters).length > 0"
          class="table-plain"
        >
          <thead>
            <tr>
              <th>项目</th>
              <th>数量</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="[key, value] in Object.entries(state.run.counters)"
              :key="key"
            >
              <td>{{ key }}</td>
              <td>{{ value }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- done -->
      <section v-else-if="state.step === 'done'">
        <template v-if="state.doneSummary">
          <div class="stat-grid">
            <div class="stat">
              <span class="stat-label">新增</span>
              <span class="stat-value">{{ state.doneSummary.created }}</span>
            </div>
            <div class="stat">
              <span class="stat-label">更新</span>
              <span class="stat-value">{{ state.doneSummary.updated }}</span>
            </div>
            <div class="stat">
              <span class="stat-label">补全成功</span>
              <span
                class="stat-value"
                :class="state.doneSummary.completionFailed > 0 ? 'text-accent' : ''"
              >
                {{ state.doneSummary.completionCompleted }}
              </span>
            </div>
            <div class="stat">
              <span class="stat-label">Error</span>
              <span
                class="stat-value"
                :class="state.doneSummary.errors > 0 ? 'text-danger' : ''"
              >
                {{ state.doneSummary.errors }}
              </span>
            </div>
            <div class="stat">
              <span class="stat-label">Warning</span>
              <span
                class="stat-value"
                :class="state.doneSummary.warnings > 0 ? 'text-accent' : ''"
              >
                {{ state.doneSummary.warnings }}
              </span>
            </div>
          </div>
          <div
            v-if="state.diagnosticsTotal > 0"
            class="field"
          >
            <div class="field-info">
              <span class="field-label">诊断</span>
              <span class="field-hint">需要处理 {{ state.diagnosticsTotal }} 项。</span>
            </div>
            <div class="field-control">
              <button
                type="button"
                @click="diagnosticsOpen = true"
              >
                查看诊断
              </button>
            </div>
          </div>
        </template>
        <p
          v-else
          class="notice"
        >
          导入任务已结束。
        </p>
      </section>
    </main>
    <main
      v-else
      class="flex flex-1 items-center justify-center text-muted-foreground"
    >
      {{ loading ? '正在加载...' : '向导不可用' }}
    </main>

    <footer
      v-if="state"
      class="flex items-center gap-2 border-t border-border px-4 py-2.5"
    >
      <button
        v-if="state.step === 'config' || state.step === 'preview'"
        type="button"
        :disabled="busy"
        @click="resetFlow"
      >
        重新选择
      </button>
      <button
        v-if="state.step === 'preview'"
        type="button"
        :disabled="busy"
        @click="backToConfig"
      >
        返回修改
      </button>
      <span class="flex-1" />
      <button
        type="button"
        class="border-transparent bg-primary text-primary-foreground"
        :disabled="busy || (state.step === 'pickBackup' && !state.file)"
        @click="submit"
      >
        {{ busy ? '处理中...' : SUBMIT_LABELS[state.step] }}
      </button>
    </footer>

    <FieldsModal
      v-if="fieldsOpen && state"
      :selection="state.fieldSelection"
      :saving="savingFields"
      @close="fieldsOpen = false"
      @save="saveFields"
    />

    <Modal
      v-if="diagnosticsOpen && state"
      title="需要处理的诊断"
      @close="diagnosticsOpen = false"
    >
      <table class="table-plain">
        <thead>
          <tr>
            <th>级别</th>
            <th>对象</th>
            <th>说明</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(diagnostic, index) in state.diagnostics"
            :key="index"
          >
            <td>{{ diagnostic.level }}</td>
            <td>{{ diagnostic.subject }}</td>
            <td>{{ diagnostic.message }}</td>
          </tr>
        </tbody>
      </table>
    </Modal>
  </div>
</template>
