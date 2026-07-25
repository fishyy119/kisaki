<!--
  GameStatusFormDialog
  Dialog for editing game status.
-->
<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { games, Status } from '@shared/db'
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

const log = createLogger('Game')

interface Props {
  gameId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const STATUS_OPTIONS = computed<{ value: Status; label: string }[]>(() => [
  { value: 'notStarted', label: m.value.library.status.notStarted },
  { value: 'inProgress', label: m.value.library.status.inProgress },
  { value: 'partial', label: m.value.library.status.partial },
  { value: 'completed', label: m.value.library.status.completed },
  { value: 'multiple', label: m.value.library.status.multiple },
  { value: 'shelved', label: m.value.library.status.shelved }
])

// Form state
interface FormData {
  status: Status
}

const formData = ref<FormData>({
  status: 'notStarted'
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
    formData.value.status = gameData.status
  }
})

async function handleSubmit() {
  isSaving.value = true
  try {
    await db.update(games).set({ status: formData.value.status }).where(eq(games.id, props.gameId))

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
          <DialogTitle>{{ m.game.statusDialog.title }}</DialogTitle>
        </DialogHeader>
        <Form @submit="handleSubmit">
          <DialogBody>
            <Field>
              <FieldLabel>{{ m.library.menu.playStatus }}</FieldLabel>
              <FieldContent>
                <Select v-model="formData.status">
                  <SelectTrigger>
                    <SelectValue :placeholder="m.game.statusDialog.selectStatus" />
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
