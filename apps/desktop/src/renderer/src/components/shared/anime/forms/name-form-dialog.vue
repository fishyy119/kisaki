<!--
  AnimeNameFormDialog
  Dialog for editing anime name.
-->
<script setup lang="ts">
import { ref, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { animes } from '@shared/db'
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

const log = createLogger('Anime')

interface Props {
  animeId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

// Form state
interface FormData {
  name: string
}

const formData = ref<FormData>({
  name: ''
})
const isSaving = ref(false)

// Fetch anime data when dialog opens
const { data: anime, isLoading } = useAsyncData(
  () => db.query.animes.findFirst({ where: eq(animes.id, props.animeId) }),
  {
    watch: [() => props.animeId],
    enabled: () => open.value
  }
)

// Initialize form state when data loads
watch(anime, (animeData) => {
  if (animeData) {
    formData.value.name = animeData.name || ''
  }
})

async function handleSubmit() {
  isSaving.value = true
  try {
    await db
      .update(animes)
      .set({ name: formData.value.name.trim() || 'unknown anime' })
      .where(eq(animes.id, props.animeId))
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
          <DialogTitle>{{ m.library.forms.editName }}</DialogTitle>
        </DialogHeader>
        <Form @submit="handleSubmit">
          <DialogBody>
            <Field>
              <FieldLabel>{{ m.library.fields.name }}</FieldLabel>
              <FieldContent>
                <Input
                  v-model="formData.name"
                  :placeholder="m.library.forms.namePlaceholder({ label: m.library.entities.anime })"
                  required
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
