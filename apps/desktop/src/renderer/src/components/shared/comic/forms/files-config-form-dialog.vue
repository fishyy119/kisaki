<!--
  ComicFilesConfigFormDialog
  Dialog for the comic's file-system configuration: the library directory file
  sync scans for readable unit containers. Saving a change re-syncs files so
  the new configuration takes effect immediately; clearing the directory
  switches the entry to fully manual file management.
-->
<script setup lang="ts">
import { ref, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { Icon } from '@renderer/components/ui/icon'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { comics } from '@shared/db'
import { useAsyncData, useComicFileSync } from '@renderer/composables'
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
  comicId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const { syncFiles } = useComicFileSync()

const dirPath = ref('')
const isSaving = ref(false)

// Fetch comic data when dialog opens
const { data: comic, isLoading } = useAsyncData(
  () => db.query.comics.findFirst({ where: eq(comics.id, props.comicId) }),
  {
    watch: [() => props.comicId],
    enabled: () => open.value
  }
)

// Initialize form state when data loads
watch(comic, (comicData) => {
  if (comicData) {
    dirPath.value = comicData.dirPath ?? ''
  }
})

async function handleSelectDir() {
  const result = await ipcManager.invoke('native:open-dialog', {
    properties: ['openDirectory']
  })
  if (result.success && result.data && !result.data.canceled && result.data.filePaths[0]) {
    dirPath.value = result.data.filePaths[0]
  }
}

function handleClearDir() {
  dirPath.value = ''
}

async function handleSubmit() {
  const current = comic.value
  if (!current) return

  const nextDirPath = dirPath.value.trim() || null

  isSaving.value = true
  try {
    const changed = nextDirPath !== current.dirPath

    await db.update(comics).set({ dirPath: nextDirPath }).where(eq(comics.id, props.comicId))

    notify.success(m.value.feedback.saved)
    open.value = false

    // The new configuration only shows once files re-reconcile against it.
    if (changed && nextDirPath) {
      await syncFiles(props.comicId)
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
    <DialogContent class="max-w-lg">
      <!-- Loading state -->
      <template v-if="isLoading || !comic">
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
          <DialogTitle>{{ m.comic.filesConfig.title }}</DialogTitle>
        </DialogHeader>
        <Form @submit="handleSubmit">
          <DialogBody>
            <FieldGroup>
              <Field>
                <FieldLabel>{{ m.comic.filesConfig.comicDirLabel }}</FieldLabel>
                <FieldContent>
                  <div class="flex gap-2">
                    <Input
                      v-model="dirPath"
                      class="flex-1"
                      :placeholder="m.comic.filesConfig.comicDirPlaceholder"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      :tooltip="m.comic.filesConfig.selectDir"
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
                      :disabled="!dirPath"
                      @click="handleClearDir"
                    >
                      {{ m.actions.clear }}
                    </Button>
                  </div>
                </FieldContent>
                <FieldDescription>{{ m.comic.filesConfig.comicDirHint }}</FieldDescription>
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
