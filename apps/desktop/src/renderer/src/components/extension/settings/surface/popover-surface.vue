<script setup lang="ts">
import { computed } from 'vue'
import { PopoverContent } from '@renderer/components/ui/popover'
import SettingsField from './field.vue'
import type { ExtensionSettingsSessionController, SettingsSurfaceState } from '../session'

defineOptions({
  name: 'ExtensionSettingsPopoverSurface'
})

const props = defineProps<{
  state: SettingsSurfaceState<'popover'>
  controller: ExtensionSettingsSessionController
}>()

const widthClass = computed(() => {
  switch (props.state.view.width) {
    case 'sm':
      return 'w-80'
    case 'lg':
      return 'w-[28rem]'
    case 'md':
    default:
      return 'w-96'
  }
})
</script>

<template>
  <PopoverContent
    align="start"
    side="bottom"
    class="max-w-[calc(100vw-2rem)] space-y-3 p-3"
    :class="widthClass"
  >
    <div
      v-if="props.state.view.title || props.state.view.description"
      class="space-y-1"
    >
      <div
        v-if="props.state.view.title"
        class="text-sm font-medium"
      >
        {{ props.state.view.title }}
      </div>
      <p
        v-if="props.state.view.description"
        class="text-xs text-muted-foreground"
      >
        {{ props.state.view.description }}
      </p>
    </div>

    <SettingsField
      v-for="field in props.state.view.fields"
      :key="field.id"
      :field="field"
      :state="props.state"
      :controller="props.controller"
    />
  </PopoverContent>
</template>
