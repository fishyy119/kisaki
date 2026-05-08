<script setup lang="ts">
import { computed } from 'vue'
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
import { Popover } from '@renderer/components/ui/popover'
import SettingsField from './field.vue'
import PopoverSurface from './popover-surface.vue'
import type { ExtensionSettingsSessionController, SettingsSurfaceState } from '../session'

defineOptions({
  name: 'ExtensionSettingsDialogSurface'
})

const props = defineProps<{
  state: SettingsSurfaceState<'dialog'>
  controller: ExtensionSettingsSessionController
}>()

const popover = computed(() => props.controller.activeDialogPopover.value)
const sizeClass = computed(() => {
  switch (props.state.view.size) {
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
    if (!value && !props.controller.busy.value) {
      void props.controller.closeDialog()
    }
  }
})

function handlePopoverOpenChange(open: boolean): void {
  if (!open && popover.value) {
    void props.controller.closePopover({
      surface: 'dialog',
      dialogId: props.state.view.dialogId
    })
  }
}
</script>

<template>
  <Dialog v-model:open="openModel">
    <DialogContent
      class="max-h-[82vh] flex flex-col"
      :class="sizeClass"
    >
      <DialogHeader>
        <DialogTitle>{{ props.state.view.title ?? '扩展设置' }}</DialogTitle>
        <DialogDescription v-if="props.state.view.description">
          {{ props.state.view.description }}
        </DialogDescription>
      </DialogHeader>

      <Popover
        :open="!!popover"
        @update:open="handlePopoverOpenChange"
      >
        <DialogBody class="min-h-0 flex-1 overflow-auto scrollbar-thin space-y-4">
          <SettingsField
            v-for="field in props.state.view.fields"
            :key="field.id"
            :field="field"
            :state="props.state"
            :controller="props.controller"
          />

          <PopoverSurface
            v-if="popover"
            :state="popover"
            :controller="props.controller"
          />
        </DialogBody>
      </Popover>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          :disabled="props.controller.busy.value"
          @click="props.controller.closeDialog"
        >
          关闭
        </Button>
        <Button
          type="button"
          :disabled="props.controller.busy.value"
          @click="props.controller.submit(props.state)"
        >
          保存
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
