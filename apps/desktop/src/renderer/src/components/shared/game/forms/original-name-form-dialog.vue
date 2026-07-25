<!--
  GameOriginalNameFormDialog
  Dialog for editing game original name.
-->
<script setup lang="ts">
import { ref, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { games } from '@shared/db'
import { useAsyncData } from '@renderer/composables'
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
import { Field, FieldLabel, FieldContent } from '@renderer/components/ui/field'
import { Form } from '@renderer/components/ui/form'
import { notify } from '@renderer/core/notify'
import { createLogger } from '@renderer/core/log'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

const log = createLogger('Game')

interface Props {
  gameId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

// Form state
interface FormData {
  originalName: string
}

const formData = ref<FormData>({
  originalName: ''
})
const isSaving = ref(false)

// Fetch game data when dialog opens
const { data: game, isLoading } = useAsyncData(
  () => db.query.games.findFirst({ where: eq(games.id, props.gameId) }),
  {
    watch: [() => props.gameId],
    enabled: () => open.value
  }
)

// Initialize form state when data loads
watch(game, (gameData) => {
  if (gameData) {
    formData.value.originalName = gameData.originalName || ''
  }
})

async function handleSubmit() {
  isSaving.value = true
  try {
    await db
      .update(games)
      .set({ originalName: formData.value.originalName.trim() || null })
      .where(eq(games.id, props.gameId))

    notify.success(m.value.common.saved)
    open.value = false
  } catch (error) {
    log.error('Update failed:', error)
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
    <DialogContent class="max-w-md">
      <!-- Loading state -->
      <template v-if="isLoading || !game">
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
          <DialogTitle>{{ m.library.forms.editOriginalName }}</DialogTitle>
        </DialogHeader>
        <Form @submit="handleSubmit">
          <DialogBody>
            <Field>
              <FieldLabel>{{ m.library.fields.originalName }}</FieldLabel>
              <FieldContent>
                <Input
                  v-model="formData.originalName"
                  :placeholder="m.library.forms.originalNamePlaceholder"
                />
              </FieldContent>
            </Field>
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
