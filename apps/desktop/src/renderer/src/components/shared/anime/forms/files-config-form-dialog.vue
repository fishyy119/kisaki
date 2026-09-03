<!--
  AnimeFilesConfigFormDialog
  Dialog for the anime's file-system configuration: the library directory file
  sync scans and the episode file-number offset it matches with (films number
  from the entry, so they show no offset). Saving a change re-syncs files so the
  new configuration takes effect immediately; clearing the directory switches
  the entry to fully manual file management.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { Icon } from '@renderer/components/ui/icon'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { animes } from '@shared/db'
import { useLiveQuery, useAnimeFileSync } from '@renderer/composables'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { StateView } from '@renderer/components/ui/state-view'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import {
  Field,
  FieldLabel,
  FieldContent,
  FieldGroup,
  FieldDescription
} from '@renderer/components/ui/field'
import { Form } from '@renderer/components/ui/form'
import { notify } from '@renderer/core/notify'
import { createLogger } from '@renderer/core/log'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

const log = createLogger('Library')

interface Props {
  animeId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const { syncFiles } = useAnimeFileSync()

// Form state
interface FormData {
  dirPath: string
  offsetText: string
}

const formData = ref<FormData>({
  dirPath: '',
  offsetText: '0'
})
const isSaving = ref(false)

// Fetch anime data when dialog opens
const { data: anime, isLoading } = useLiveQuery(
  () => db.query.animes.findFirst({ where: eq(animes.id, props.animeId) }),
  {
    watch: [() => props.animeId],
    enabled: () => open.value
  }
)

// Initialize form state when data loads
watch(anime, (animeData) => {
  if (animeData) {
    formData.value.dirPath = animeData.dirPath ?? ''
    formData.value.offsetText = String(animeData.episodeFileNumberOffset)
  }
})

const isFilm = computed(() => anime.value?.format === 'movie')

async function handleSelectDir() {
  const result = await ipcManager.invoke('native:open-dialog', {
    properties: ['openDirectory']
  })
  if (result.success && result.data && !result.data.canceled && result.data.filePaths[0]) {
    formData.value.dirPath = result.data.filePaths[0]
  }
}

function handleClearDir() {
  formData.value.dirPath = ''
}

async function handleSubmit() {
  const current = anime.value
  if (!current) return

  const offset = Number(formData.value.offsetText.trim() || '0')
  if (!Number.isInteger(offset)) {
    notify.error(m.value.anime.filesConfig.offsetInvalid)
    return
  }
  const dirPath = formData.value.dirPath.trim() || null

  isSaving.value = true
  try {
    const changed = dirPath !== current.dirPath || offset !== current.episodeFileNumberOffset

    await db
      .update(animes)
      .set({ dirPath: dirPath, episodeFileNumberOffset: offset })
      .where(eq(animes.id, props.animeId))

    notify.success(m.value.feedback.saved)
    open.value = false

    // The new configuration only shows once files re-reconcile against it.
    if (changed && dirPath) {
      await syncFiles(props.animeId)
    }
  } catch (error) {
    log.error('Files config update failed:', error)
    notify.error(m.value.library.feedback.saveFailedRetry)
  } finally {
    isSaving.value = false
  }
}

function handleCancel() {
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent size="md">
      <!-- Loading state -->
      <template v-if="isLoading || !anime">
        <DialogBody>
          <StateView
            state="loading"
            class="py-8"
          />
        </DialogBody>
      </template>

      <!-- Form content -->
      <template v-else>
        <DialogHeader>
          <DialogTitle>{{ m.anime.filesConfig.title }}</DialogTitle>
        </DialogHeader>
        <Form @submit="handleSubmit">
          <DialogBody>
            <FieldGroup>
              <Field>
                <FieldLabel>{{ m.anime.filesConfig.animeDirLabel }}</FieldLabel>
                <FieldContent>
                  <div class="flex gap-2">
                    <Input
                      v-model="formData.dirPath"
                      class="flex-1"
                      :placeholder="m.anime.filesConfig.animeDirPlaceholder"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      :tooltip="m.anime.filesConfig.selectDir"
                      @click="handleSelectDir"
                    >
                      <Icon
                        icon="icon-[mdi--folder-open-outline]"
                        class="size-4"
                      />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      :disabled="!formData.dirPath"
                      @click="handleClearDir"
                    >
                      {{ m.actions.clear }}
                    </Button>
                  </div>
                </FieldContent>
                <FieldDescription>{{ m.anime.filesConfig.animeDirHint }}</FieldDescription>
              </Field>

              <!-- A film reads its numbering from the entry, so it has no
                   file numbering to shift. -->
              <Field v-if="!isFilm">
                <FieldLabel>{{ m.anime.filesConfig.offsetLabel }}</FieldLabel>
                <FieldContent>
                  <Input
                    v-model="formData.offsetText"
                    type="number"
                    step="1"
                  />
                </FieldContent>
                <FieldDescription>{{ m.anime.filesConfig.offsetHint }}</FieldDescription>
              </Field>
            </FieldGroup>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              :disabled="isSaving"
              @click="handleCancel"
            >
              {{ m.actions.cancel }}
            </Button>
            <Button
              type="submit"
              :disabled="isSaving"
            >
              {{ m.actions.save }}
            </Button>
          </DialogFooter>
        </Form>
      </template>
    </DialogContent>
  </Dialog>
</template>
