<!--
  AnimeStatusFormDialog
  Dialog for editing anime watch status.
-->
<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { animes, AnimeStatus } from '@shared/db'
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
import { Field, FieldLabel, FieldContent } from '@renderer/components/ui/field'
import { Form } from '@renderer/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
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

const STATUS_OPTIONS = computed<{ value: AnimeStatus; label: string }[]>(() => [
  { value: 'planned', label: m.value.library.animeStatus.planned },
  { value: 'watching', label: m.value.library.animeStatus.watching },
  { value: 'completed', label: m.value.library.animeStatus.completed },
  { value: 'onHold', label: m.value.library.animeStatus.onHold },
  { value: 'dropped', label: m.value.library.animeStatus.dropped }
])

// Form state
interface FormData {
  status: AnimeStatus
}

const formData = ref<FormData>({
  status: 'planned'
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
    formData.value.status = animeData.status
  }
})

async function handleSubmit() {
  isSaving.value = true
  try {
    await db
      .update(animes)
      .set({ status: formData.value.status })
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
          <DialogTitle>{{ m.anime.statusDialog.title }}</DialogTitle>
        </DialogHeader>
        <Form @submit="handleSubmit">
          <DialogBody>
            <Field>
              <FieldLabel>{{ m.anime.detail.watchStatus }}</FieldLabel>
              <FieldContent>
                <Select v-model="formData.status">
                  <SelectTrigger>
                    <SelectValue :placeholder="m.anime.statusDialog.selectStatus" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="option in STATUS_OPTIONS"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
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
