<!-- Import Tab configures and launches the MangaDex reading-status import. -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  Button,
  Checkbox,
  Field,
  FieldContent,
  FieldGroup,
  Icon,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SettingsSection,
  Spinner
} from '@kisaki3/extension-ui-vue'
import type { MangadexProfileOption } from '../../../shared/settings'
import { m } from '../i18n'
import { host, toErrorMessage } from '../rpc'
import { useTaskRun } from '../use-task-run'
import TaskRunLine from '../components/task-run-line.vue'

const emit = defineEmits<{
  error: [message: string]
}>()

const profiles = ref<MangadexProfileOption[]>([])
const profileId = ref('')
const updateExisting = ref(true)
const createMissing = ref(false)
const importScores = ref(true)

const importRun = useTaskRun((message) => emit('error', message))

const canImport = computed(
  () =>
    !importRun.active.value && (updateExisting.value || (createMissing.value && !!profileId.value))
)

onMounted(() => {
  void loadProfiles()
})

async function loadProfiles(): Promise<void> {
  try {
    profiles.value = await host.listComicProfiles()
    if (!profileId.value && profiles.value.length > 0) {
      profileId.value = profiles.value[0]!.id
    }
  } catch (error) {
    emit('error', toErrorMessage(error))
  }
}

function startImport(): void {
  importRun.start(() =>
    host.startImport({
      updateExisting: updateExisting.value,
      createMissing: createMissing.value,
      importScores: importScores.value,
      ...(createMissing.value && profileId.value ? { profileId: profileId.value } : {})
    })
  )
}
</script>

<template>
  <div class="space-y-4">
    <SettingsSection
      :title="m.ui.import.title"
      :description="m.ui.import.description"
      surface="rows"
    >
      <FieldGroup>
        <Field
          orientation="horizontal"
          :label="m.ui.import.optionsLabel"
        >
          <FieldContent class="flex-row flex-wrap items-center justify-end gap-x-3 gap-y-2">
            <label class="flex items-center gap-1.5 text-xs">
              <Checkbox v-model="importScores" />
              {{ m.ui.import.importScoresLabel }}
            </label>
            <label class="flex items-center gap-1.5 text-xs">
              <Checkbox v-model="updateExisting" />
              {{ m.ui.import.updateExistingLabel }}
            </label>
            <label class="flex items-center gap-1.5 text-xs">
              <Checkbox v-model="createMissing" />
              {{ m.ui.import.createMissingLabel }}
            </label>
          </FieldContent>
        </Field>

        <Field
          v-if="createMissing"
          orientation="horizontal"
          :label="m.ui.import.profileLabel"
        >
          <Select v-model="profileId">
            <SelectTrigger
              size="sm"
              class="w-52"
            >
              <SelectValue :placeholder="m.ui.import.profilePlaceholder" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="profile in profiles"
                :key="profile.id"
                :value="profile.id"
              >
                {{ profile.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field
          orientation="horizontal"
          :label="m.ui.import.runLabel"
          :description="m.ui.import.runDescription"
        >
          <FieldContent class="flex-row items-center justify-end gap-2">
            <Button
              size="sm"
              type="button"
              :disabled="importRun.starting.value || !canImport"
              @click="startImport"
            >
              <Spinner v-if="importRun.starting.value" />
              <Icon
                v-else
                icon="icon-[mdi--import]"
                class="size-3.5"
              />
              {{ m.ui.import.startImport }}
            </Button>
          </FieldContent>
        </Field>
      </FieldGroup>
    </SettingsSection>

    <TaskRunLine
      :task="importRun.task.value"
      :active="importRun.active.value"
      :percent="importRun.percent.value"
      :status-label="importRun.statusLabel.value"
      @cancel="importRun.cancel()"
    />
  </div>
</template>
