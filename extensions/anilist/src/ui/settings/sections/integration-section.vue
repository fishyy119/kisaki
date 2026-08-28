<!--
Integration Section owns the AniList list connection: automatic push
preferences, the manual full push, and the list import across the anime and
manga lists. Long operations run as app task runs; this section starts them
and polls a small projection until they settle.
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  Button,
  Checkbox,
  Field,
  FieldContent,
  FieldGroup,
  Icon,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SettingsSection,
  Spinner,
  Switch
} from '@kisaki3/extension-ui-vue'
import type { AnilistProfileOptions, AnilistTaskStateView } from '../../../shared/settings'
import { settingsForm } from '../form'
import { m } from '../i18n'
import { host, toErrorMessage } from '../rpc'

const emit = defineEmits<{
  error: [message: string]
}>()

const ACTIVE_STATUSES = ['queued', 'running', 'pausing', 'paused', 'cancelling']

const profiles = ref<AnilistProfileOptions>({ anime: [], comic: [], novel: [] })
const includeAnimeList = ref(true)
const includeMangaList = ref(true)
const updateExisting = ref(true)
const createMissing = ref(false)
const animeProfileId = ref('')
const comicProfileId = ref('')
const novelProfileId = ref('')

const task = ref<AnilistTaskStateView | null>(null)
const starting = ref(false)
let pollTimer: ReturnType<typeof setInterval> | undefined

const taskActive = computed(
  () => task.value !== null && ACTIVE_STATUSES.includes(task.value.status)
)
const taskPercent = computed<number | null>(() => {
  if (!task.value?.total || task.value.current === undefined) {
    return null
  }
  return Math.round((task.value.current / task.value.total) * 100)
})
const taskStatusLabel = computed(() => {
  switch (task.value?.status) {
    case 'completed':
      return m.value.ui.integration.taskCompleted
    case 'failed':
      return m.value.ui.integration.taskFailed
    case 'cancelled':
      return m.value.ui.integration.taskCancelled
    default:
      return m.value.ui.integration.taskRunning
  }
})
// Creating missing entries needs a profile for every kind the read lists can
// produce; the manga list carries both comics and light novels.
const createProfilesReady = computed(() => {
  if (!createMissing.value) {
    return true
  }
  const animeReady = !includeAnimeList.value || !!animeProfileId.value
  const mangaReady = !includeMangaList.value || (!!comicProfileId.value && !!novelProfileId.value)
  return animeReady && mangaReady
})
const canImport = computed(
  () =>
    !taskActive.value &&
    (includeAnimeList.value || includeMangaList.value) &&
    (updateExisting.value || createMissing.value) &&
    createProfilesReady.value
)

onMounted(() => {
  void loadProfiles()
})

onUnmounted(() => {
  stopPolling()
})

async function loadProfiles(): Promise<void> {
  try {
    profiles.value = await host.listProfileOptions()
    if (!animeProfileId.value && profiles.value.anime.length > 0) {
      animeProfileId.value = profiles.value.anime[0]!.id
    }
    if (!comicProfileId.value && profiles.value.comic.length > 0) {
      comicProfileId.value = profiles.value.comic[0]!.id
    }
    if (!novelProfileId.value && profiles.value.novel.length > 0) {
      novelProfileId.value = profiles.value.novel[0]!.id
    }
  } catch (error) {
    emit('error', toErrorMessage(error))
  }
}

function startImport(): void {
  const lists: ('anime' | 'manga')[] = []
  if (includeAnimeList.value) {
    lists.push('anime')
  }
  if (includeMangaList.value) {
    lists.push('manga')
  }

  void startTask(() =>
    host.startImport({
      lists,
      updateExisting: updateExisting.value,
      createMissing: createMissing.value,
      ...(createMissing.value && animeProfileId.value
        ? { animeProfileId: animeProfileId.value }
        : {}),
      ...(createMissing.value && comicProfileId.value
        ? { comicProfileId: comicProfileId.value }
        : {}),
      ...(createMissing.value && novelProfileId.value
        ? { novelProfileId: novelProfileId.value }
        : {})
    })
  )
}

function startPushAll(): void {
  void startTask(() => host.startPushAll())
}

async function startTask(start: () => Promise<{ runId: string }>): Promise<void> {
  if (starting.value || taskActive.value) {
    return
  }

  starting.value = true
  try {
    const { runId } = await start()
    task.value = { runId, status: 'queued' }
    startPolling(runId)
  } catch (error) {
    emit('error', toErrorMessage(error))
  } finally {
    starting.value = false
  }
}

function startPolling(runId: string): void {
  stopPolling()
  pollTimer = setInterval(() => {
    void host
      .getTaskState(runId)
      .then((state) => {
        if (state) {
          task.value = state
        }
        if (!state || !ACTIVE_STATUSES.includes(state.status)) {
          stopPolling()
        }
      })
      .catch(() => {
        // Polling is cosmetic; the task run itself reports its outcome.
      })
  }, 1000)
}

function stopPolling(): void {
  if (pollTimer !== undefined) {
    clearInterval(pollTimer)
    pollTimer = undefined
  }
}

function cancelTask(): void {
  const runId = task.value?.runId
  if (!runId) {
    return
  }

  void host.cancelTask(runId).catch((error) => {
    emit('error', toErrorMessage(error))
  })
}
</script>

<template>
  <SettingsSection
    :title="m.ui.integration.title"
    surface="rows"
  >
    <FieldGroup>
      <Field
        orientation="horizontal"
        :label="m.ui.integration.syncEnabledLabel"
        :description="m.ui.integration.syncEnabledDescription"
      >
        <Switch v-model="settingsForm.syncEnabled" />
      </Field>

      <Field
        orientation="horizontal"
        :label="m.ui.integration.pushScoreLabel"
        :description="m.ui.integration.pushScoreDescription"
      >
        <Switch v-model="settingsForm.syncPushScore" />
      </Field>

      <Field
        orientation="horizontal"
        :label="m.ui.integration.importTitle"
        :description="m.ui.integration.importDescription"
      >
        <FieldContent class="items-end gap-2">
          <div class="flex flex-row items-center gap-3">
            <label class="flex items-center gap-1.5 text-xs">
              <Checkbox v-model="includeAnimeList" />
              {{ m.ui.integration.listAnime }}
            </label>
            <label class="flex items-center gap-1.5 text-xs">
              <Checkbox v-model="includeMangaList" />
              {{ m.ui.integration.listManga }}
            </label>
            <label class="flex items-center gap-1.5 text-xs">
              <Checkbox v-model="updateExisting" />
              {{ m.ui.integration.updateExistingLabel }}
            </label>
            <label class="flex items-center gap-1.5 text-xs">
              <Checkbox v-model="createMissing" />
              {{ m.ui.integration.createMissingLabel }}
            </label>
          </div>
        </FieldContent>
      </Field>

      <Field
        v-if="createMissing && includeAnimeList"
        orientation="horizontal"
        :label="m.ui.integration.animeProfileLabel"
      >
        <Select v-model="animeProfileId">
          <SelectTrigger
            size="sm"
            class="w-52"
          >
            <SelectValue :placeholder="m.ui.integration.profilePlaceholder" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="profile in profiles.anime"
              :key="profile.id"
              :value="profile.id"
            >
              {{ profile.name }}
            </SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field
        v-if="createMissing && includeMangaList"
        orientation="horizontal"
        :label="m.ui.integration.comicProfileLabel"
      >
        <Select v-model="comicProfileId">
          <SelectTrigger
            size="sm"
            class="w-52"
          >
            <SelectValue :placeholder="m.ui.integration.profilePlaceholder" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="profile in profiles.comic"
              :key="profile.id"
              :value="profile.id"
            >
              {{ profile.name }}
            </SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field
        v-if="createMissing && includeMangaList"
        orientation="horizontal"
        :label="m.ui.integration.novelProfileLabel"
      >
        <Select v-model="novelProfileId">
          <SelectTrigger
            size="sm"
            class="w-52"
          >
            <SelectValue :placeholder="m.ui.integration.profilePlaceholder" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="profile in profiles.novel"
              :key="profile.id"
              :value="profile.id"
            >
              {{ profile.name }}
            </SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field
        v-if="task"
        orientation="horizontal"
        :label="taskStatusLabel"
        :description="task.summary ?? task.error"
      >
        <FieldContent class="flex-row items-center justify-end gap-2">
          <template v-if="taskActive">
            <span
              v-if="task.current !== undefined && task.total !== undefined"
              class="text-xs text-muted-foreground"
            >
              {{ m.ui.integration.taskProgress({ current: task.current, total: task.total }) }}
            </span>
            <Progress
              :model-value="taskPercent"
              class="w-40"
            />
            <Button
              variant="outline"
              size="sm"
              type="button"
              @click="cancelTask"
            >
              {{ m.ui.integration.cancelTask }}
            </Button>
          </template>
        </FieldContent>
      </Field>
    </FieldGroup>

    <template #actions>
      <Button
        variant="outline"
        size="sm"
        type="button"
        :disabled="starting || taskActive"
        @click="startPushAll"
      >
        <Spinner v-if="starting" />
        <Icon
          v-else
          icon="icon-[mdi--cloud-upload]"
          class="size-3.5"
        />
        {{ m.ui.integration.pushAll }}
      </Button>
      <Button
        size="sm"
        type="button"
        :disabled="starting || !canImport"
        @click="startImport"
      >
        <Icon
          icon="icon-[mdi--import]"
          class="size-3.5"
        />
        {{ m.ui.integration.startImport }}
      </Button>
    </template>
  </SettingsSection>
</template>
