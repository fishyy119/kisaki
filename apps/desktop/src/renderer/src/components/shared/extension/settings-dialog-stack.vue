<!--
ExtensionSettingsDialogStack owns one extension settings session and its dialog frames.
-->
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Spinner } from '@renderer/components/ui/spinner'
import { notify } from '@renderer/core/notify'
import {
  getSettingsNodeCallbackId,
  invokeExtensionSettingsNode,
  openExtensionSettingsFrame,
  openExtensionSettingsSession,
  refreshExtensionSettingsFrame,
  releaseExtensionSettingsFrame,
  releaseExtensionSettingsSession,
  submitExtensionSettingsFrame,
  type SettingsDraft
} from '@renderer/core/extensions'
import SettingsDialogFrame from './settings-dialog-frame.vue'
import type {
  SerializableValue,
  SettingsCommand,
  SettingsDialogTarget,
  SettingsRefreshScope,
  SettingsResolvedNode
} from '@kisaki/extension-api'
import type {
  ExtensionResolvedSettingsFrame,
  ExtensionSettingsContributionInfo,
  ExtensionSettingsInteractionResponse
} from '@shared/extension'

interface Props {
  contribution: ExtensionSettingsContributionInfo
}

const MAX_STACK_DEPTH = 6

const props = defineProps<Props>()
const open = defineModel<boolean>('open', { required: true })

const sessionId = ref<string | null>(null)
const activeExtensionId = ref<string | null>(null)
const activeContributionId = ref<string | null>(null)
const frames = ref<ExtensionResolvedSettingsFrame[]>([])
const openingSession = ref(false)
const openingFrame = ref(false)
const error = ref<string | null>(null)
const submittingFrameId = ref<string | null>(null)
const busyCallbacks = ref<Set<string>>(new Set())
let sessionRequestId = 0

const busy = computed(
  () =>
    openingSession.value ||
    openingFrame.value ||
    submittingFrameId.value !== null ||
    busyCallbacks.value.size > 0
)
const openModel = computed({
  get: () => open.value,
  set: (value: boolean) => {
    if (!value && !busy.value) {
      open.value = false
    }
  }
})

watch(
  [open, () => props.contribution.extensionId, () => props.contribution.contributionId],
  ([isOpen], oldValue) => {
    const wasOpen = oldValue?.[0]
    if (isOpen) {
      void openSession()
    } else if (wasOpen) {
      releaseCurrentSession()
    }
  },
  { immediate: true }
)

async function openSession(): Promise<void> {
  const requestId = ++sessionRequestId
  releaseCurrentSession(false)
  openingSession.value = true
  error.value = null

  try {
    const session = await openExtensionSettingsSession(
      props.contribution.extensionId,
      props.contribution.contributionId
    )
    if (requestId === sessionRequestId && open.value) {
      sessionId.value = session.sessionId
      activeExtensionId.value = session.extensionId
      activeContributionId.value = session.contributionId
      frames.value = [session.frame]
    } else {
      void releaseExtensionSettingsSession(
        session.extensionId,
        session.contributionId,
        session.sessionId
      ).catch((e) => {
        console.warn('[ExtensionSettingsDialogStack] Failed to release stale session:', e)
      })
    }
  } catch (e) {
    if (requestId === sessionRequestId) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  } finally {
    if (requestId === sessionRequestId) {
      openingSession.value = false
    }
  }
}

async function pushFrame(target: SettingsDialogTarget): Promise<void> {
  if (!sessionId.value) {
    return
  }

  if (frames.value.length >= MAX_STACK_DEPTH) {
    notify.error('扩展设置层级过深', `最多支持 ${MAX_STACK_DEPTH} 层设置弹窗`)
    return
  }

  openingFrame.value = true
  try {
    const frame = await openExtensionSettingsFrame({
      sessionId: sessionId.value,
      extensionId: props.contribution.extensionId,
      contributionId: props.contribution.contributionId,
      target
    })
    frames.value = [...frames.value, frame]
  } catch (e) {
    notify.error('打开扩展设置失败', e instanceof Error ? e.message : String(e))
  } finally {
    openingFrame.value = false
  }
}

async function closeFrame(frame: ExtensionResolvedSettingsFrame, force = false): Promise<void> {
  const index = frames.value.findIndex((item) => item.frameId === frame.frameId)
  if (index < 0) {
    return
  }

  if (!force && index !== frames.value.length - 1) {
    return
  }

  if (frames.value.length === 1) {
    open.value = false
    return
  }

  frames.value = frames.value.filter((item) => item.frameId !== frame.frameId)
  await releaseExtensionSettingsFrame({
    sessionId: frame.sessionId,
    extensionId: frame.extensionId,
    contributionId: frame.contributionId,
    frameId: frame.frameId
  }).catch((e) => {
    console.warn('[ExtensionSettingsDialogStack] Failed to release settings frame:', e)
  })
}

async function refreshFrame(frame: ExtensionResolvedSettingsFrame): Promise<void> {
  const refreshed = await refreshExtensionSettingsFrame({
    sessionId: frame.sessionId,
    extensionId: frame.extensionId,
    contributionId: frame.contributionId,
    frameId: frame.frameId
  })
  applyRefreshedFrame(refreshed)
}

async function handleSubmitFrame(
  frame: ExtensionResolvedSettingsFrame,
  values: SettingsDraft
): Promise<void> {
  if (submittingFrameId.value) {
    return
  }

  submittingFrameId.value = frame.frameId
  try {
    const response = await submitExtensionSettingsFrame({
      sessionId: frame.sessionId,
      extensionId: frame.extensionId,
      contributionId: frame.contributionId,
      frameId: frame.frameId,
      values
    })
    await handleInteractionResponse(response, frame, 'submit')
  } catch (e) {
    notify.error('扩展设置保存失败', e instanceof Error ? e.message : String(e))
  } finally {
    submittingFrameId.value = null
  }
}

async function handleInvokeFrame(
  frame: ExtensionResolvedSettingsFrame,
  node: SettingsResolvedNode,
  value?: SerializableValue
): Promise<void> {
  const callbackId = getSettingsNodeCallbackId(node)
  if (!callbackId) {
    return
  }

  beginCallback(callbackId)
  try {
    const response = await invokeExtensionSettingsNode({
      sessionId: frame.sessionId,
      extensionId: frame.extensionId,
      contributionId: frame.contributionId,
      frameId: frame.frameId,
      callbackId,
      value
    })
    await handleInteractionResponse(response, frame, 'invoke')
  } catch (e) {
    notify.error('扩展设置操作失败', e instanceof Error ? e.message : String(e))
  } finally {
    endCallback(callbackId)
  }
}

async function handleInteractionResponse(
  response: ExtensionSettingsInteractionResponse,
  sourceFrame: ExtensionResolvedSettingsFrame,
  action: 'submit' | 'invoke'
): Promise<void> {
  for (const frame of response.refreshedFrames) {
    applyRefreshedFrame(frame)
  }

  if (!response.result.success) {
    notify.error('扩展设置操作失败', response.result.error.message)
    await executeCommands(response.result.commands ?? [], sourceFrame)
    return
  }

  if (response.result.message) {
    notify.success(response.result.message)
  } else if (action === 'submit' && (response.result.commands?.length ?? 0) === 0) {
    notify.success('扩展设置已保存')
  }

  await executeCommands(response.result.commands ?? [], sourceFrame)
}

async function executeCommands(
  commands: readonly SettingsCommand[],
  sourceFrame: ExtensionResolvedSettingsFrame
): Promise<void> {
  for (const command of commands) {
    if (command.type === 'refresh') {
      await refreshByScope(command.scope, sourceFrame)
    } else if (command.type === 'open') {
      await pushFrame(command.target)
    } else if (command.scope === 'all') {
      open.value = false
      return
    } else {
      await closeFrame(sourceFrame, true)
    }
  }
}

async function refreshByScope(
  scope: SettingsRefreshScope,
  sourceFrame: ExtensionResolvedSettingsFrame
): Promise<void> {
  const sourceIndex = frames.value.findIndex((frame) => frame.frameId === sourceFrame.frameId)
  if (sourceIndex < 0) {
    return
  }

  if (scope === 'current') {
    await refreshFrame(frames.value[sourceIndex])
    return
  }

  if (scope === 'parent') {
    const parent = frames.value[sourceIndex - 1]
    if (parent) {
      await refreshFrame(parent)
    }
    return
  }

  for (const frame of [...frames.value]) {
    await refreshFrame(frame)
  }
}

function applyRefreshedFrame(frame: ExtensionResolvedSettingsFrame): void {
  frames.value = frames.value.map((item) => (item.frameId === frame.frameId ? frame : item))
}

function beginCallback(callbackId: string): void {
  busyCallbacks.value = new Set([...busyCallbacks.value, callbackId])
}

function endCallback(callbackId: string): void {
  const next = new Set(busyCallbacks.value)
  next.delete(callbackId)
  busyCallbacks.value = next
}

function releaseCurrentSession(cancelPending = true): void {
  if (cancelPending) {
    sessionRequestId += 1
  }

  const currentSessionId = sessionId.value
  const currentExtensionId = activeExtensionId.value
  const currentContributionId = activeContributionId.value
  sessionId.value = null
  activeExtensionId.value = null
  activeContributionId.value = null
  frames.value = []
  busyCallbacks.value = new Set()
  submittingFrameId.value = null

  if (!currentSessionId || !currentExtensionId || !currentContributionId) {
    return
  }

  void releaseExtensionSettingsSession(
    currentExtensionId,
    currentContributionId,
    currentSessionId
  ).catch((e) => {
    console.warn('[ExtensionSettingsDialogStack] Failed to release settings session:', e)
  })
}

onBeforeUnmount(() => {
  releaseCurrentSession()
})
</script>

<template>
  <Dialog
    v-if="openingSession && frames.length === 0"
    v-model:open="openModel"
  >
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>{{ props.contribution.title }}</DialogTitle>
      </DialogHeader>
      <DialogBody class="flex items-center justify-center py-10">
        <Spinner class="size-7" />
      </DialogBody>
    </DialogContent>
  </Dialog>

  <Dialog
    v-else-if="error"
    v-model:open="openModel"
  >
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>{{ props.contribution.title }}</DialogTitle>
      </DialogHeader>
      <DialogBody class="space-y-3">
        <p class="text-sm text-destructive">{{ error }}</p>
      </DialogBody>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          @click="open = false"
        >
          关闭
        </Button>
        <Button
          type="button"
          @click="openSession"
        >
          重试
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <template v-else>
    <SettingsDialogFrame
      v-for="(frame, index) in frames"
      :key="frame.frameId"
      :frame="frame"
      :fallback-title="props.contribution.title"
      :stack-level="index"
      :is-top="index === frames.length - 1"
      :busy="busy"
      :submitting="submittingFrameId === frame.frameId"
      :busy-callbacks="busyCallbacks"
      @close="closeFrame"
      @submit="handleSubmitFrame"
      @invoke="handleInvokeFrame"
      @open="pushFrame"
    />
  </template>
</template>
