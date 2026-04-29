<!--
ExtensionSettingsDialogFrame renders one frame in a settings dialog stack.
-->
<script setup lang="ts">
import { computed, ref, toRaw, watch } from 'vue'
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
import { createSettingsDraft, type SettingsDraft } from '@renderer/core/extensions'
import SettingsNode from './settings-node.vue'
import type {
  SerializableValue,
  SettingsDialogTarget,
  SettingsResolvedNode
} from '@kisaki/extension-api'
import type { ExtensionResolvedSettingsFrame } from '@shared/extension'

interface Props {
  frame: ExtensionResolvedSettingsFrame
  fallbackTitle: string
  stackLevel: number
  isTop: boolean
  busy: boolean
  submitting: boolean
  busyCallbacks: ReadonlySet<string>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: [frame: ExtensionResolvedSettingsFrame]
  submit: [frame: ExtensionResolvedSettingsFrame, values: SettingsDraft]
  invoke: [
    frame: ExtensionResolvedSettingsFrame,
    node: SettingsResolvedNode,
    value?: SerializableValue
  ]
  open: [target: SettingsDialogTarget]
}>()

const formData = ref<SettingsDraft>({})
const visibleNodes = computed(() => props.frame.screen.nodes.filter((node) => !node.hidden))
const title = computed(() => props.frame.screen.title ?? props.fallbackTitle)
const sizeClass = computed(() => {
  switch (props.frame.screen.size) {
    case 'sm':
      return 'max-w-md'
    case 'lg':
      return 'max-w-2xl'
    case 'xl':
      return 'max-w-4xl'
    case 'md':
    default:
      return 'max-w-xl'
  }
})
const openModel = computed({
  get: () => true,
  set: (value: boolean) => {
    if (!value && props.isTop && !props.busy) {
      emit('close', props.frame)
    }
  }
})

watch(
  () => props.frame,
  (frame) => {
    formData.value = createSettingsDraft(frame.screen.nodes)
  },
  { immediate: true }
)

function updateDraftValue(nodeId: string, value: SerializableValue): void {
  formData.value = {
    ...formData.value,
    [nodeId]: value
  }
}

function handleSubmit(): void {
  emit('submit', props.frame, { ...toRaw(formData.value) })
}
</script>

<template>
  <Dialog v-model:open="openModel">
    <DialogContent
      :stack-level="props.stackLevel"
      :show-close-button="props.isTop"
      class="max-h-[82vh] flex flex-col"
      :class="sizeClass"
    >
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription v-if="props.frame.screen.description">
          {{ props.frame.screen.description }}
        </DialogDescription>
      </DialogHeader>

      <Form
        class="min-h-0 flex flex-col"
        @submit="handleSubmit"
      >
        <DialogBody class="min-h-0 flex-1 overflow-auto scrollbar-thin space-y-4">
          <SettingsNode
            v-for="node in visibleNodes"
            :key="node.id"
            :node="node"
            :draft="formData"
            :busy-callbacks="props.busyCallbacks"
            @value-change="updateDraftValue"
            @invoke="(resolvedNode, value) => emit('invoke', props.frame, resolvedNode, value)"
            @open="emit('open', $event)"
          />
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            :disabled="props.busy"
            @click="emit('close', props.frame)"
          >
            关闭
          </Button>
          <Button
            type="submit"
            :disabled="props.busy"
          >
            <Spinner
              v-if="props.submitting"
              class="size-3.5"
            />
            保存
          </Button>
        </DialogFooter>
      </Form>
    </DialogContent>
  </Dialog>
</template>
