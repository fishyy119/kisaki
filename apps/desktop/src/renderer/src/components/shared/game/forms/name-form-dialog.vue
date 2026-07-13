<!--
  GameNameFormDialog
  Dialog for editing game name.
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

const log = createLogger('Game')

interface Props {
  gameId: string
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
    formData.value.name = gameData.name || ''
  }
})

async function handleSubmit() {
  isSaving.value = true
  try {
    await db
      .update(games)
      .set({ name: formData.value.name.trim() || 'unknown game' })
      .where(eq(games.id, props.gameId))
    notify.success('已保存')
    open.value = false
  } catch (error) {
    log.error('Update failed:', error)
    notify.error('保存失败，请重试')
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
          <DialogTitle>编辑名称</DialogTitle>
        </DialogHeader>
        <Form @submit="handleSubmit">
          <DialogBody>
            <Field>
              <FieldLabel>名称</FieldLabel>
              <FieldContent>
                <Input
                  v-model="formData.name"
                  placeholder="游戏名称"
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
              取消
            </Button>
            <Button
              type="submit"
              :disabled="isSaving"
            >
              保存
            </Button>
          </DialogFooter>
        </Form>
      </template>
    </DialogContent>
  </Dialog>
</template>
