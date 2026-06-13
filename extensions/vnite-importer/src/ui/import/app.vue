<!--
Vnite Import Wizard App is the import webview document root: step navigation,
step views, and modals.
Boundary: all flow state lives in the extension host; the UI renders
`VniteWizardState`, drives transitions through `host` RPC, and receives live
state pushes while an import runs.
-->
<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Alert, Button, Spinner } from '@kisaki3/extension-ui-vue'
import type {
  VniteImportFieldSelection,
  VniteImportOptionsForm,
  VniteWizardState
} from '../../shared/import-wizard'
import { countSelectedFields, countTotalFields } from './fields'
import { host, onHostStateChanged, toErrorMessage } from './rpc'
import StepIndicator from './components/step-indicator.vue'
import PickBackupStep from './components/pick-backup-step.vue'
import ConfigStep from './components/config-step.vue'
import PreviewStep from './components/preview-step.vue'
import RunningStep from './components/running-step.vue'
import DoneStep from './components/done-step.vue'
import FieldsDialog from './components/fields-dialog.vue'
import DiagnosticsDialog from './components/diagnostics-dialog.vue'

const STEPS: readonly { key: VniteWizardState['step']; label: string }[] = [
  { key: 'pickBackup', label: '选择备份包' },
  { key: 'config', label: '导入配置' },
  { key: 'preview', label: '预览' },
  { key: 'running', label: '导入中' },
  { key: 'done', label: '完成' }
]

const SUBMIT_LABELS: Partial<Record<VniteWizardState['step'], string>> = {
  pickBackup: '下一步',
  config: '生成预览',
  preview: '开始导入',
  done: '导入另一个备份包'
}

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

const stepIndex = computed(() =>
  state.value ? STEPS.findIndex((step) => step.key === state.value?.step) : 0
)
const submitLabel = computed(() => (state.value ? SUBMIT_LABELS[state.value.step] : undefined))
const totalFieldCount = countTotalFields()
const selectedFieldCount = computed(() =>
  state.value ? countSelectedFields(state.value.fieldSelection) : 0
)

onHostStateChanged((next) => {
  // Pushed states never carry user edits, so the form only syncs outside of
  // an editing step to avoid clobbering in-progress input.
  state.value = next
  if (next.step !== 'config') {
    Object.assign(options, next.options)
  }
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
    case 'done':
      void runHostAction(() => host.resetFlow())
      return
    case 'running':
      return
  }
}

function snapshotOptions(): VniteImportOptionsForm {
  return { ...options, completionSurfaces: [...options.completionSurfaces] }
}

function saveFields(selection: VniteImportFieldSelection): void {
  savingFields.value = true
  void runHostAction(() => host.saveFieldSelection(selection)).finally(() => {
    savingFields.value = false
    fieldsOpen.value = false
  })
}
</script>

<template>
  <div class="flex h-screen flex-col">
    <header class="border-b border-border px-4 py-3">
      <StepIndicator
        :steps="STEPS"
        :current-index="stepIndex"
      />
    </header>

    <main
      v-if="state"
      class="flex-1 space-y-3 overflow-y-auto px-4 py-3"
    >
      <Alert
        v-if="error"
        variant="destructive"
      >
        {{ error }}
      </Alert>

      <PickBackupStep
        v-if="state.step === 'pickBackup'"
        :file="state.file"
        :busy="busy"
        @pick="() => void runHostAction(() => host.pickBackupFile())"
      />

      <ConfigStep
        v-else-if="state.step === 'config'"
        v-model:options="options"
        :profiles="state.profiles"
        :selected-field-count="selectedFieldCount"
        :total-field-count="totalFieldCount"
        @edit-fields="fieldsOpen = true"
      />

      <PreviewStep
        v-else-if="state.step === 'preview' && state.preview"
        :preview="state.preview"
        :diagnostics-total="state.diagnosticsTotal"
        @open-diagnostics="diagnosticsOpen = true"
      />

      <RunningStep
        v-else-if="state.step === 'running'"
        :run="state.run"
      />

      <DoneStep
        v-else-if="state.step === 'done'"
        :summary="state.doneSummary"
        :diagnostics-total="state.diagnosticsTotal"
        @open-diagnostics="diagnosticsOpen = true"
      />
    </main>
    <main
      v-else
      class="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground"
    >
      <Spinner v-if="loading" />
      {{ loading ? '正在加载…' : '向导不可用' }}
    </main>

    <footer
      v-if="state"
      class="flex items-center gap-2 border-t border-border px-4 py-2.5"
    >
      <Button
        v-if="state.step === 'config' || state.step === 'preview'"
        variant="outline"
        type="button"
        :disabled="busy"
        @click="() => void runHostAction(() => host.resetFlow())"
      >
        重新选择
      </Button>
      <Button
        v-if="state.step === 'preview'"
        variant="outline"
        type="button"
        :disabled="busy"
        @click="() => void runHostAction(() => host.backToConfig())"
      >
        返回修改
      </Button>
      <span class="flex-1" />
      <Button
        v-if="submitLabel"
        type="button"
        :disabled="busy || (state.step === 'pickBackup' && !state.file)"
        @click="submit"
      >
        <Spinner v-if="busy" />
        {{ busy ? '处理中…' : submitLabel }}
      </Button>
    </footer>

    <FieldsDialog
      v-if="fieldsOpen && state"
      v-model:open="fieldsOpen"
      :selection="state.fieldSelection"
      :saving="savingFields"
      @save="saveFields"
    />

    <DiagnosticsDialog
      v-if="state"
      v-model:open="diagnosticsOpen"
      :diagnostics="state.diagnostics"
      :total="state.diagnosticsTotal"
    />
  </div>
</template>
