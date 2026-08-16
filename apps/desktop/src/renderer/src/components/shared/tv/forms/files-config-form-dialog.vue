<!--
  TvFilesConfigFormDialog
  Dialog for the show's file-system configuration: the library directory file
  sync scans for SxxEyy-numbered episode files. Saving a change re-syncs files
  so the new configuration takes effect immediately; clearing the directory
  switches the entry to fully manual file management.
-->
<script setup lang="ts">
import { ref, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { Icon } from '@renderer/components/ui/icon'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { tvs } from '@shared/db'
import { useAsyncData, useTvFileSync } from '@renderer/composables'
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

const log = createLogger('Tv')

interface Props {
  tvId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const { syncFiles } = useTvFileSync()

const dirPath = ref('')
const isSaving = ref(false)

// Fetch series data when dialog opens
const { data: tv, isLoading } = useAsyncData(
  () => db.query.tvs.findFirst({ where: eq(tvs.id, props.tvId) }),
  {
    watch: [() => props.tvId],
    enabled: () => open.value
  }
)

// Initialize form state when data loads
watch(tv, (tvData) => {
  if (tvData) {
    dirPath.value = tvData.tvDirPath ?? ''
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

async function handleSubmit() {
  const current = tv.value
  if (!current) return

  const nextDirPath = dirPath.value.trim() || null

  isSaving.value = true
  try {
    const changed = nextDirPath !== current.tvDirPath

    await db.update(tvs).set({ tvDirPath: nextDirPath }).where(eq(tvs.id, props.tvId))

    notify.success(m.value.common.saved)
    open.value = false

    // The new configuration only shows once files re-reconcile against it.
    if (changed && nextDirPath) {
      await syncFiles(props.tvId)
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
      <template v-if="isLoading || !tv">
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
          <DialogTitle>{{ m.tv.filesConfig.title }}</DialogTitle>
        </DialogHeader>
        <Form @submit="handleSubmit">
          <DialogBody>
            <FieldGroup>
              <Field>
                <FieldLabel>{{ m.tv.filesConfig.tvDirLabel }}</FieldLabel>
                <FieldContent>
                  <div class="flex gap-2">
                    <Input
                      v-model="dirPath"
                      class="flex-1"
                      :placeholder="m.tv.filesConfig.tvDirPlaceholder"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      :tooltip="m.tv.filesConfig.selectDir"
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
                      @click="dirPath = ''"
                    >
                      {{ m.common.clear }}
                    </Button>
                  </div>
                </FieldContent>
                <FieldDescription>{{ m.tv.filesConfig.tvDirHint }}</FieldDescription>
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
              {{ m.common.cancel }}
            </Button>
            <Button
              type="submit"
              :disabled="isSaving"
            >
              {{ m.common.save }}
            </Button>
          </DialogFooter>
        </Form>
      </template>
    </DialogContent>
  </Dialog>
</template>
