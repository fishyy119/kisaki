<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import SettingsField from './field.vue'
import type { ExtensionSettingsPanelSessionController, SettingsPanelSurfaceState } from '../session'
import type { ExtensionResolvedSettingsPanelRoot } from '@shared/extension'

defineOptions({
  name: 'ExtensionSettingsPanelTabs'
})

const props = defineProps<{
  state: SettingsPanelSurfaceState<'root'>
  controller: ExtensionSettingsPanelSessionController
}>()

const rootView = computed(() => props.state.view as ExtensionResolvedSettingsPanelRoot)
const tabs = computed(() => ('tabs' in rootView.value ? (rootView.value.tabs ?? []) : []))
const activeTabId = ref('')

watch(
  tabs,
  (nextTabs) => {
    if (nextTabs.some((tab) => tab.id === activeTabId.value)) {
      return
    }

    activeTabId.value = resolveInitialTabId(nextTabs)
  },
  { immediate: true }
)

function resolveInitialTabId(nextTabs: typeof tabs.value): string {
  return rootView.value.activeTabId && nextTabs.some((tab) => tab.id === rootView.value.activeTabId)
    ? rootView.value.activeTabId
    : (nextTabs[0]?.id ?? '')
}
</script>

<template>
  <Tabs
    v-if="tabs.length > 0"
    v-model="activeTabId"
    class="min-h-0 flex flex-col gap-4"
  >
    <TabsList class="w-fit max-w-full overflow-x-auto">
      <TabsTrigger
        v-for="tab in tabs"
        :key="tab.id"
        :value="tab.id"
      >
        {{ tab.label }}
      </TabsTrigger>
    </TabsList>

    <TabsContent
      v-for="tab in tabs"
      :key="tab.id"
      :value="tab.id"
      class="mt-0 space-y-4"
    >
      <div
        v-if="tab.description"
        class="text-sm text-muted-foreground"
      >
        {{ tab.description }}
      </div>
      <SettingsField
        v-for="field in tab.fields"
        :key="field.id"
        :field="field"
        :state="props.state"
        :controller="props.controller"
      />
    </TabsContent>
  </Tabs>
</template>
