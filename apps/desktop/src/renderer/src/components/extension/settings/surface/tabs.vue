<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import SettingsField from './field.vue'
import type { ExtensionSettingsSessionController, SettingsSurfaceState } from '../session'
import type { ExtensionResolvedSettingsRoot } from '@shared/extension'

defineOptions({
  name: 'ExtensionSettingsTabs'
})

const props = defineProps<{
  state: SettingsSurfaceState<'root'>
  controller: ExtensionSettingsSessionController
}>()

const rootView = computed(() => props.state.view as ExtensionResolvedSettingsRoot)
const tabs = computed(() => ('tabs' in rootView.value ? (rootView.value.tabs ?? []) : []))
const activeTabId = ref('')

watch(
  tabs,
  (nextTabs) => {
    activeTabId.value =
      rootView.value.activeTabId && nextTabs.some((tab) => tab.id === rootView.value.activeTabId)
        ? rootView.value.activeTabId
        : (nextTabs[0]?.id ?? '')
  },
  { immediate: true }
)
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
