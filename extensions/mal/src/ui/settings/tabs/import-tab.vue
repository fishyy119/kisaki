<!-- Import Tab configures and launches the MyAnimeList list import. -->
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
import type { MalProfileOptions } from '../../../shared/settings'
import { m } from '../i18n'
import { host, toErrorMessage } from '../rpc'
import { useTaskRun } from '../use-task-run'
import TaskRunLine from '../components/task-run-line.vue'

const emit = defineEmits<{
  error: [message: string]
}>()

const profiles = ref<MalProfileOptions>({ anime: [], comic: [], novel: [] })
const includeAnimeList = ref(true)
const includeMangaList = ref(true)
const updateExisting = ref(true)
const createMissing = ref(false)
const animeProfileId = ref('')
const comicProfileId = ref('')
const novelProfileId = ref('')

const importRun = useTaskRun((message) => emit('error', message))

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
    !importRun.active.value &&
    (includeAnimeList.value || includeMangaList.value) &&
    (updateExisting.value || createMissing.value) &&
    createProfilesReady.value
)

onMounted(() => {
  void loadProfiles()
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

  importRun.start(() =>
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
              <Checkbox v-model="includeAnimeList" />
              {{ m.ui.import.listAnime }}
            </label>
            <label class="flex items-center gap-1.5 text-xs">
              <Checkbox v-model="includeMangaList" />
              {{ m.ui.import.listManga }}
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
          v-if="createMissing && includeAnimeList"
          orientation="horizontal"
          :label="m.ui.import.animeProfileLabel"
        >
          <Select v-model="animeProfileId">
            <SelectTrigger
              size="sm"
              class="w-52"
            >
              <SelectValue :placeholder="m.ui.import.profilePlaceholder" />
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
          :label="m.ui.import.comicProfileLabel"
        >
          <Select v-model="comicProfileId">
            <SelectTrigger
              size="sm"
              class="w-52"
            >
              <SelectValue :placeholder="m.ui.import.profilePlaceholder" />
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
          :label="m.ui.import.novelProfileLabel"
        >
          <Select v-model="novelProfileId">
            <SelectTrigger
              size="sm"
              class="w-52"
            >
              <SelectValue :placeholder="m.ui.import.profilePlaceholder" />
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
