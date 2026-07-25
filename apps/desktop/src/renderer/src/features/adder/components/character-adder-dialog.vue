<!--
  CharacterAdderDialog
  Dialog for adding characters to the library.
  Uses CharacterSearcher component for search and identification.
-->
<script setup lang="ts">
import { computed, ref, toRaw } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { getEntityIcon } from '@renderer/utils/format'
import { ipcManager } from '@renderer/core/ipc'
import { notify } from '@renderer/core/notify'
import { useI18n } from '@renderer/composables/use-i18n'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import {
  CharacterSearcher,
  type CharacterSearcherSelection
} from '@renderer/components/shared/character'
import type { IngestAddCharacterFromScraperResult } from '@shared/ingest/add'

interface Props {
  /** Target collection ID to add the character to */
  targetCollectionId?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  /** Called after character is successfully added */
  success: [characterId: string]
}>()

const { m } = useI18n()

const addFailedTitle = computed(() =>
  m.value.adder.addFailed({ label: m.value.library.entities.character })
)

const open = defineModel<boolean>('open', { required: true })

const isSubmitting = ref(false)
const selection = ref<CharacterSearcherSelection>({
  profileId: '',
  characterId: '',
  characterName: '',
  originalName: '',
  knownIds: [],
  canSubmit: false
})

function handleSelectionChange(newSelection: CharacterSearcherSelection) {
  selection.value = newSelection
}

async function handleSubmit() {
  if (!selection.value.canSubmit) return

  isSubmitting.value = true

  const profileId = selection.value.profileId
  const name = selection.value.originalName ?? selection.value.characterName
  const knownIds = toRaw(selection.value.knownIds)
  const targetCollectionId = props.targetCollectionId

  open.value = false
  try {
    const result = await ipcManager.invoke(
      'ingest:add-character-from-scraper',
      profileId,
      {
        name,
        knownIds
      },
      {
        targetCollectionId
      }
    )

    if (!result.success) {
      notify.error(addFailedTitle.value, result.error)
      return
    }

    const waitResult = await ipcManager.invoke('task-run:wait', result.data.runId)
    if (!waitResult.success) {
      notify.error(addFailedTitle.value, waitResult.error)
      return
    }

    const run = waitResult.data
    if (run.status === 'cancelled') {
      notify.info(m.value.adder.addCancelled({ label: m.value.library.entities.character }))
      return
    }
    if (run.status !== 'completed') {
      notify.error(addFailedTitle.value, run.result?.error)
      return
    }

    const output = run.result?.output as IngestAddCharacterFromScraperResult | undefined
    if (!output?.characterId) {
      notify.error(
        addFailedTitle.value,
        m.value.adder.missingEntityId({ label: m.value.library.entities.character })
      )
      return
    }

    emit('success', output.characterId)
  } catch (error) {
    notify.error(addFailedTitle.value, (error as Error).message)
  } finally {
    isSubmitting.value = false
  }
}

const openModel = computed({
  get: () => open.value,
  set: (newOpen: boolean) => {
    open.value = newOpen
  }
})
</script>

<template>
  <Dialog v-model:open="openModel">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Icon
            :icon="getEntityIcon('character')"
            class="size-4"
          />
          {{ m.library.forms.addEntityTitle({ label: m.library.entities.character }) }}
        </DialogTitle>
      </DialogHeader>
      <DialogBody>
        <CharacterSearcher
          :is-submitting="isSubmitting"
          @selection-change="handleSelectionChange"
        />
      </DialogBody>
      <DialogFooter>
        <div class="flex items-center gap-1.5 text-[11px] text-muted-foreground mr-auto">
          <Icon
            icon="icon-[mdi--lightbulb-outline]"
            class="size-3.5"
          />
          <span>{{ m.adder.autofillHint }}</span>
        </div>
        <Button
          variant="outline"
          :disabled="isSubmitting"
          @click="openModel = false"
        >
          {{ m.common.cancel }}
        </Button>
        <Button
          :disabled="!selection.canSubmit || isSubmitting"
          @click="handleSubmit"
        >
          <template v-if="isSubmitting">
            <Icon
              icon="icon-[mdi--loading]"
              class="size-4 animate-spin"
            />
            {{ m.adder.adding }}
          </template>
          <template v-else>
            <Icon
              icon="icon-[mdi--plus]"
              class="size-4"
            />
            {{ m.adder.submit }}
          </template>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
