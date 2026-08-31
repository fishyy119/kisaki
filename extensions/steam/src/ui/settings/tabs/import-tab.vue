<!-- Import Tab configures and launches the owned-games import. -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  Button,
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
import type { SteamProfileOption } from '../../../shared/settings'
import { m } from '../i18n'
import { host, toErrorMessage } from '../rpc'
import { useTaskRun } from '../use-task-run'
import TaskRunLine from '../components/task-run-line.vue'

const emit = defineEmits<{
  error: [message: string]
}>()

const profiles = ref<SteamProfileOption[]>([])
const profileId = ref('')

const importRun = useTaskRun((message) => emit('error', message))

const canImport = computed(() => !importRun.active.value && !!profileId.value)

onMounted(() => {
  void loadProfiles()
})

async function loadProfiles(): Promise<void> {
  try {
    profiles.value = await host.listGameProfiles()
    if (!profileId.value && profiles.value.length > 0) {
      profileId.value = profiles.value[0]!.id
    }
  } catch (error) {
    emit('error', toErrorMessage(error))
  }
}

function startImport(): void {
  if (!profileId.value) {
    return
  }

  importRun.start(() => host.startImport({ profileId: profileId.value }))
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
