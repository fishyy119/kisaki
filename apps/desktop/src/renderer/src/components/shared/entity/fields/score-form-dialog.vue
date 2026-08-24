<!--
  EntityScoreFormDialog
  Dialog for editing an entity's personal score (0-10 display scale, stored as
  0-100); entity differences arrive as the `entityType` registry key only.
-->
<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { eq } from 'drizzle-orm'
import { db, ENTITY_TABLES } from '@renderer/core/db'
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
import { Field, FieldGroup, FieldLabel, FieldContent } from '@renderer/components/ui/field'
import { Form } from '@renderer/components/ui/form'
import { notify } from '@renderer/core/notify'
import { createLogger } from '@renderer/core/log'
import { useI18n } from '@renderer/composables/use-i18n'
import { dbScoreToDisplay, displayScoreToDb } from '@renderer/utils/format'
import type { ContentEntityType } from '@shared/common'

const { m } = useI18n()

const log = createLogger('Library')

interface Props {
  entityType: ContentEntityType
  entityId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const table = computed(() => ENTITY_TABLES[props.entityType].table)

const score = ref('')
const isSaving = ref(false)

const { data: row, isLoading } = useAsyncData(
  async () => {
    const rows = await db
      .select({ score: table.value.score })
      .from(table.value)
      .where(eq(table.value.id, props.entityId))
      .limit(1)
    return rows[0]
  },
  {
    watch: [() => props.entityId],
    enabled: () => open.value
  }
)

watch(row, (data) => {
  if (data) {
    score.value = dbScoreToDisplay(data.score)
  }
})

// Computed model for score input (validates input pattern)
const scoreModel = computed({
  get: () => score.value,
  set: (value: string) => {
    if (value === '' || /^(\d+\.?\d*)?$/.test(value)) {
      score.value = value
    }
  }
})

async function handleSubmit() {
  const trimmed = score.value.trim()
  if (trimmed !== '') {
    const num = parseFloat(trimmed)
    if (isNaN(num) || num < 0 || num > 10) {
      notify.error(m.value.library.forms.scoreOutOfRange)
      return
    }
  }

  isSaving.value = true
  try {
    await db
      .update(table.value)
      .set({ score: displayScoreToDb(score.value) })
      .where(eq(table.value.id, props.entityId))

    notify.success(m.value.common.saved)
    open.value = false
  } catch (error) {
    log.error('Update failed:', error)
    notify.error(m.value.library.feedback.saveFailedRetry)
  } finally {
    isSaving.value = false
  }
}

function handleClear() {
  score.value = ''
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-md">
      <!-- Loading state -->
      <template v-if="isLoading || !row">
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
          <DialogTitle>{{ m.library.forms.editScore }}</DialogTitle>
        </DialogHeader>
        <Form @submit="handleSubmit">
          <DialogBody>
            <FieldGroup>
              <Field>
                <FieldLabel>{{ m.library.fields.myScore }}</FieldLabel>
                <FieldContent>
                  <div class="flex items-center gap-2">
                    <Input
                      v-model="scoreModel"
                      inputmode="decimal"
                      placeholder="0.0 - 10.0"
                      class="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      :disabled="score === ''"
                      @click="handleClear"
                    >
                      {{ m.common.clear }}
                    </Button>
                  </div>
                  <p class="text-xs text-muted-foreground mt-1.5">
                    {{ m.library.forms.scoreRangeHint }}
                  </p>
                </FieldContent>
              </Field>
            </FieldGroup>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              :disabled="isSaving"
              @click="open = false"
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
