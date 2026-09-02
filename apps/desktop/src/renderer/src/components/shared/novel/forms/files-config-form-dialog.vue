<!--
  NovelFilesConfigFormDialog
  Dialog for the novel's file-system configuration: the library directory file
  sync scans for readable book files. Saving a change re-syncs files so the
  new configuration takes effect immediately; clearing the directory switches
  the entry to fully manual file management.
-->
<script setup lang="ts">
import { ref, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { Icon } from '@renderer/components/ui/icon'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { novels } from '@shared/db'
import { useAsyncData, useNovelFileSync } from '@renderer/composables'
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
  novelId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const { syncFiles } = useNovelFileSync()

const dirPath = ref('')
const isSaving = ref(false)

// Fetch novel data when dialog opens
const { data: novel, isLoading } = useAsyncData(
  () => db.query.novels.findFirst({ where: eq(novels.id, props.novelId) }),
  {
    watch: [() => props.novelId],
    enabled: () => open.value
  }
)

// Initialize form state when data loads
watch(novel, (novelData) => {
  if (novelData) {
    dirPath.value = novelData.dirPath ?? ''
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
  const current = novel.value
  if (!current) return

  const nextDirPath = dirPath.value.trim() || null

  isSaving.value = true
  try {
    const changed = nextDirPath !== current.dirPath

    await db.update(novels).set({ dirPath: nextDirPath }).where(eq(novels.id, props.novelId))

    notify.success(m.value.feedback.saved)
    open.value = false

    // The new configuration only shows once files re-reconcile against it.
    if (changed && nextDirPath) {
      await syncFiles(props.novelId)
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
      <template v-if="isLoading || !novel">
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
          <DialogTitle>{{ m.novel.filesConfig.title }}</DialogTitle>
        </DialogHeader>
        <Form @submit="handleSubmit">
          <DialogBody>
            <FieldGroup>
              <Field>
                <FieldLabel>{{ m.novel.filesConfig.novelDirLabel }}</FieldLabel>
                <FieldContent>
                  <div class="flex gap-2">
                    <Input
                      v-model="dirPath"
                      class="flex-1"
                      :placeholder="m.novel.filesConfig.novelDirPlaceholder"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      :tooltip="m.novel.filesConfig.selectDir"
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
                <FieldDescription>{{ m.novel.filesConfig.novelDirHint }}</FieldDescription>
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
