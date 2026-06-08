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
import { Popover } from '@renderer/components/ui/popover'
import SettingsField from './field.vue'
import PopoverSurface from './popover-surface.vue'
import FooterActions from './footer-actions.vue'
import { getSettingsPanelDialogWidthClass } from '../dialog-width'
import type { ExtensionSettingsPanelSessionController, SettingsPanelSurfaceState } from '../session'

defineOptions({
  name: 'ExtensionSettingsPanelDialogSurface'
})

const props = defineProps<{
  state: SettingsPanelSurfaceState<'dialog'>
  controller: ExtensionSettingsPanelSessionController
}>()

const popover = computed(() => props.controller.activeDialogPopover.value)
const sizeClass = computed(() => getSettingsPanelDialogWidthClass(props.state.view.size))

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
        <FooterActions
          :state="props.state"
          :controller="props.controller"
        />
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
