<!--
ExtensionSettingsPanelDialog renders one structured extension settings panel.
Boundary: panel resolution and callbacks always round-trip through main IPC.
-->
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Form } from '@renderer/components/ui/form'
import { Spinner } from '@renderer/components/ui/spinner'
import { FieldGroup } from '@renderer/components/ui/field'
import { notify } from '@renderer/core/notify'
import {
  createSettingsPanelDraft,
  getSettingsControlCallbackId,
  invokeExtensionSettingsPanel,
  releaseExtensionSettingsPanelSession,
  resolveExtensionSettingsPanel,
  submitExtensionSettingsPanel,
  type SettingsPanelDraft
} from '@renderer/core/extensions'
import SettingsPanelControl from './settings-panel-control.vue'
import type { SerializableValue, SettingsPanelResolvedControlNode } from '@kisaki/extension-api'
import type { ExtensionResolvedSettingsPanel, ExtensionSettingsPanelInfo } from '@shared/extension'

interface Props {
  panel: ExtensionSettingsPanelInfo
}

const props = defineProps<Props>()
const open = defineModel<boolean>('open', { required: true })

const resolvedPanel = ref<ExtensionResolvedSettingsPanel | null>(null)
const formData = ref<SettingsPanelDraft>({})
const resolving = ref(false)
const submitting = ref(false)
const error = ref<string | null>(null)
const invokingCallbacks = ref<Set<string>>(new Set())
let resolveRequestId = 0

const visibleNodes = computed(() =>
  (resolvedPanel.value?.nodes ?? []).filter((node) => !node.hidden)
)
const busy = computed(() => resolving.value || submitting.value || invokingCallbacks.value.size > 0)
const openModel = computed({
  get: () => open.value,
  set: (value: boolean) => {
    if (!busy.value) {
      open.value = value
    }
  }
})

watch(
  [open, () => props.panel.extensionId, () => props.panel.panelId],
  ([isOpen], oldValue) => {
    const wasOpen = oldValue?.[0]
    if (isOpen) {
      void resolvePanel()
    } else if (wasOpen) {
      releaseCurrentSession()
    }
  },
  { immediate: true }
)

async function resolvePanel(): Promise<void> {
  const requestId = ++resolveRequestId
  releaseCurrentSession(false)
  resolving.value = true
  error.value = null

  try {
    const panel = await resolveExtensionSettingsPanel(props.panel.extensionId, props.panel.panelId)
    if (requestId === resolveRequestId && open.value) {
      applyResolvedPanel(panel)
    } else {
      void releaseExtensionSettingsPanelSession(
        panel.extensionId,
        panel.panelId,
        panel.sessionId
      ).catch((e) => {
        console.warn('[ExtensionSettingsPanelDialog] Failed to release stale session:', e)
      })
    }
  } catch (e) {
    if (requestId === resolveRequestId) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  } finally {
    if (requestId === resolveRequestId) {
      resolving.value = false
    }
  }
}

async function handleSubmit(): Promise<void> {
  if (!resolvedPanel.value) {
    return
  }

  submitting.value = true

  try {
    const response = await submitExtensionSettingsPanel({
      sessionId: resolvedPanel.value.sessionId,
      extensionId: props.panel.extensionId,
      panelId: props.panel.panelId,
      values: formData.value
    })

    if (!response.result.success) {
      notify.error('扩展设置保存失败', response.result.error.message)
      return
    }

    if (response.refreshed) {
      applyResolvedPanel(response.refreshed)
      notify.success('扩展设置已刷新')
      return
    }

    notify.success('扩展设置已保存')
    open.value = false
  } catch (e) {
    notify.error('扩展设置保存失败', e instanceof Error ? e.message : String(e))
  } finally {
    submitting.value = false
  }
}

async function handleControlInvoke(
  control: SettingsPanelResolvedControlNode,
  value?: SerializableValue
): Promise<void> {
  const callbackId = getSettingsControlCallbackId(control)
  if (!callbackId || !resolvedPanel.value) {
    return
  }

  beginCallback(callbackId)

  try {
    const response = await invokeExtensionSettingsPanel({
      sessionId: resolvedPanel.value.sessionId,
      extensionId: props.panel.extensionId,
      panelId: props.panel.panelId,
      callbackId,
      value
    })

    if (!response.result.success) {
      notify.error('扩展设置操作失败', response.result.error.message)
      return
    }

    if (response.refreshed) {
      applyResolvedPanel(response.refreshed)
      notify.success('扩展设置已刷新')
    }
  } catch (e) {
    notify.error('扩展设置操作失败', e instanceof Error ? e.message : String(e))
  } finally {
    endCallback(callbackId)
  }
}

function applyResolvedPanel(panel: ExtensionResolvedSettingsPanel): void {
  if (resolvedPanel.value?.sessionId && resolvedPanel.value.sessionId !== panel.sessionId) {
    releaseCurrentSession()
  }

  resolvedPanel.value = panel
  formData.value = createSettingsPanelDraft(panel.nodes)
}

function updateDraftValue(controlId: string, value: SerializableValue): void {
  formData.value = {
    ...formData.value,
    [controlId]: value
  }
}

function visibleControls(
  controls: readonly SettingsPanelResolvedControlNode[]
): readonly SettingsPanelResolvedControlNode[] {
  return controls.filter((control) => !control.hidden)
}

function isCallbackBusy(control: SettingsPanelResolvedControlNode): boolean {
  const callbackId = getSettingsControlCallbackId(control)
  return callbackId ? invokingCallbacks.value.has(callbackId) : false
}

function beginCallback(callbackId: string): void {
  invokingCallbacks.value = new Set([...invokingCallbacks.value, callbackId])
}

function endCallback(callbackId: string): void {
  const next = new Set(invokingCallbacks.value)
  next.delete(callbackId)
  invokingCallbacks.value = next
}

function releaseCurrentSession(cancelPending = true): void {
  if (cancelPending) {
    resolveRequestId += 1
  }

  const session = resolvedPanel.value
  if (!session) {
    return
  }

  resolvedPanel.value = null
  formData.value = {}
  void releaseExtensionSettingsPanelSession(
    session.extensionId,
    session.panelId,
    session.sessionId
  ).catch((e) => {
    console.warn('[ExtensionSettingsPanelDialog] Failed to release settings panel session:', e)
  })
}

onBeforeUnmount(() => {
  releaseCurrentSession()
})
</script>

<template>
  <Dialog v-model:open="openModel">
    <DialogContent class="max-w-xl max-h-[82vh] flex flex-col">
      <DialogHeader>
        <DialogTitle>{{ props.panel.title }}</DialogTitle>
        <DialogDescription v-if="props.panel.description">
          {{ props.panel.description }}
        </DialogDescription>
      </DialogHeader>

      <DialogBody
        v-if="resolving && !resolvedPanel"
        class="flex items-center justify-center py-10"
      >
        <Spinner class="size-7" />
      </DialogBody>

      <DialogBody
        v-else-if="error"
        class="space-y-3"
      >
        <p class="text-sm text-destructive">{{ error }}</p>
        <div class="flex justify-end">
          <Button
            type="button"
            variant="outline"
            @click="resolvePanel"
          >
            重试
          </Button>
        </div>
      </DialogBody>

      <Form
        v-else
        class="min-h-0 flex flex-col"
        @submit="handleSubmit"
      >
        <DialogBody class="min-h-0 flex-1 overflow-auto scrollbar-thin space-y-4">
          <template
            v-for="node in visibleNodes"
            :key="node.id"
          >
            <section
              v-if="node.kind === 'section'"
              class="space-y-3"
            >
              <div>
                <h3 class="text-sm font-medium">{{ node.title }}</h3>
                <p
                  v-if="node.description"
                  class="text-xs text-muted-foreground mt-1"
                >
                  {{ node.description }}
                </p>
              </div>

              <FieldGroup>
                <SettingsPanelControl
                  v-for="control in visibleControls(node.controls)"
                  :key="control.id"
                  :node="control"
                  :model-value="formData[control.id]"
                  :busy="isCallbackBusy(control)"
                  @update:model-value="updateDraftValue(control.id, $event)"
                  @invoke="handleControlInvoke(control, $event)"
                />
              </FieldGroup>
            </section>

            <SettingsPanelControl
              v-else
              :node="node"
              :model-value="formData[node.id]"
              :busy="false"
              @update:model-value="updateDraftValue(node.id, $event)"
              @invoke="handleControlInvoke(node, $event)"
            />
          </template>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            :disabled="busy"
            @click="open = false"
          >
            取消
          </Button>
          <Button
            type="submit"
            :disabled="busy"
          >
            <Spinner
              v-if="submitting"
              class="size-3.5"
            />
            保存
          </Button>
        </DialogFooter>
      </Form>
    </DialogContent>
  </Dialog>
</template>
