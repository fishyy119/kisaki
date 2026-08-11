<!-- Sync Tab edits persistent sync preferences and launches sync jobs. -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  Button,
  Checkbox,
  Field,
  FieldContent,
  FieldGroup,
  Icon,
  Label,
  Spinner,
  Switch
} from '@kisaki3/extension-ui-vue'
import type { BangumiAutoSyncItem, BangumiSettingsOverview } from '../../../shared/settings'
import { settingsForm } from '../form'
import { m } from '../i18n'
import { host, toErrorMessage } from '../rpc'
import { useScopeSelection } from '../scope'
import MediaScopeSelect from '../components/media-scope-select.vue'
import SettingsSection from '../components/settings-section.vue'
import FullSyncDialog from '../flows/full-sync-dialog.vue'

interface Props {
  overview: BangumiSettingsOverview
}

const props = defineProps<Props>()

const emit = defineEmits<{
  refresh: []
  error: [message: string]
}>()

const autoSyncItems = computed<readonly { value: BangumiAutoSyncItem; label: string }[]>(() => [
  { value: 'create', label: m.value.ui.sync.itemCreate },
  { value: 'status', label: m.value.ui.sync.itemStatus },
  { value: 'score', label: m.value.ui.sync.itemScore },
  { value: 'episodes', label: m.value.ui.sync.itemEpisodes }
])

const syncing = ref(false)
const fullSyncOpen = ref(false)
const { scope, options: scopeOptions } = useScopeSelection(() => props.overview.scopes)

function toggleAutoSyncItem(item: BangumiAutoSyncItem, checked: boolean): void {
  const next = new Set(settingsForm.autoSyncItems)
  if (checked) {
    next.add(item)
  } else {
    next.delete(item)
  }
  settingsForm.autoSyncItems = [...next]
}

async function runChangedSync(): Promise<void> {
  if (!scope.value) {
    return
  }

  syncing.value = true
  try {
    await host.runChangedSync(scope.value)
    emit('refresh')
  } catch (error) {
    emit('error', toErrorMessage(error))
  } finally {
    syncing.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <SettingsSection
      :title="m.ui.sync.preferencesTitle"
      surface="rows"
    >
      <FieldGroup>
        <Field
          orientation="horizontal"
          :label="m.ui.sync.autoSync"
          :description="m.ui.sync.autoSyncDescription"
        >
          <Switch v-model="settingsForm.autoSyncEnabled" />
        </Field>

        <Field
          orientation="horizontal"
          :label="m.ui.sync.syncItems"
        >
          <FieldContent class="flex-row flex-wrap items-center gap-x-3 gap-y-2">
            <Label
              v-for="item in autoSyncItems"
              :key="item.value"
              class="font-normal"
            >
              <Checkbox
                :model-value="settingsForm.autoSyncItems.includes(item.value)"
                :disabled="!settingsForm.autoSyncEnabled"
                @update:model-value="(checked) => toggleAutoSyncItem(item.value, checked === true)"
              />
              {{ item.label }}
            </Label>
          </FieldContent>
        </Field>

        <Field
          orientation="horizontal"
          :label="m.ui.sync.clearRemoteScore"
          :description="m.ui.sync.clearRemoteScoreDescription"
        >
          <Switch
            v-model="settingsForm.clearRemoteScoreWhenEmpty"
            :disabled="
              !settingsForm.autoSyncEnabled || !settingsForm.autoSyncItems.includes('score')
            "
          />
        </Field>
      </FieldGroup>
    </SettingsSection>

    <SettingsSection
      :title="m.ui.sync.manualTitle"
      :description="m.ui.sync.manualDescription"
    >
      <div class="flex flex-wrap items-center gap-2">
        <MediaScopeSelect
          v-model="scope"
          :scopes="scopeOptions"
        />
        <Button
          variant="outline"
          size="sm"
          type="button"
          :disabled="!scope || syncing || props.overview.activeJobs.syncChangedItems"
          @click="runChangedSync"
        >
          <Spinner v-if="syncing || props.overview.activeJobs.syncChangedItems" />
          <Icon
            v-else
            icon="icon-[mdi--sync]"
            class="size-3.5"
          />
          {{ m.ui.sync.syncChangedNow }}
        </Button>
        <Button
          size="sm"
          type="button"
          :disabled="!scope || props.overview.activeJobs.syncFull"
          @click="fullSyncOpen = true"
        >
          <Icon
            icon="icon-[mdi--playlist-check]"
            class="size-3.5"
          />
          {{ m.ui.sync.fullSync }}
        </Button>
      </div>
    </SettingsSection>

    <FullSyncDialog
      v-if="fullSyncOpen && scope"
      v-model:open="fullSyncOpen"
      :overview="props.overview"
      :scope="scope"
      @refresh="emit('refresh')"
      @error="(message) => emit('error', message)"
    />
  </div>
</template>
