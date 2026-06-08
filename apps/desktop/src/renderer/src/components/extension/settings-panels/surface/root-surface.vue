<script setup lang="ts">
import { computed } from 'vue'
import { DialogBody, DialogFooter } from '@renderer/components/ui/dialog'
import { Popover } from '@renderer/components/ui/popover'
import SettingsField from './field.vue'
import PopoverSurface from './popover-surface.vue'
import SettingsTabs from './tabs.vue'
import FooterActions from './footer-actions.vue'
import type { ExtensionSettingsPanelSessionController, SettingsPanelSurfaceState } from '../session'

defineOptions({
  name: 'ExtensionSettingsPanelRootSurface'
})

const props = defineProps<{
  state: SettingsPanelSurfaceState<'root'>
  controller: ExtensionSettingsPanelSessionController
}>()

const view = computed(() => props.state.view)
const fields = computed(() => ('fields' in view.value ? view.value.fields : []))
const popover = computed(() => props.controller.activeRootPopover.value)

function handlePopoverOpenChange(open: boolean): void {
  if (!open && popover.value) {
    void props.controller.closePopover({ surface: 'root' })
  }
}
</script>

<template>
  <Popover
    :open="!!popover"
    @update:open="handlePopoverOpenChange"
  >
    <DialogBody class="min-h-0 flex-1 overflow-auto scrollbar-thin space-y-4">
      <SettingsTabs
        v-if="'tabs' in view && view.tabs"
        :state="props.state"
        :controller="props.controller"
      />

      <SettingsField
        v-for="field in fields"
        v-else
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
</template>
