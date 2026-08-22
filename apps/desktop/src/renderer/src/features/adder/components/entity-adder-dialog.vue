<!--
  EntityAdderDialog
  Dialog for adding an entity to the library through a scraper searcher;
  entity differences arrive via the adder spec registry.
-->
<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
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
import { EntitySearcher, type EntitySearcherSelection } from '@renderer/components/shared/entity'
import type { ContentEntityType } from '@shared/common'
import { ADDER_SPECS } from './adder-specs'

interface Props {
  entityType: ContentEntityType
  /** Target collection ID to add the entry to */
  targetCollectionId?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  /** Called after the entry is successfully added */
  success: [entityId: string]
}>()

const { m } = useI18n()

const spec = computed(() => ADDER_SPECS[props.entityType])
const entityLabel = computed(() => m.value.library.entities[props.entityType])
const addFailedTitle = computed(() => m.value.adder.addFailed({ label: entityLabel.value }))

const open = defineModel<boolean>('open', { required: true })

const isSubmitting = ref(false)

const selection = shallowRef<EntitySearcherSelection>({
  profileId: '',
  lookup: { name: '', knownIds: [] },
  canSubmit: false
})

function handleSelectionChange(newSelection: EntitySearcherSelection) {
  selection.value = newSelection
}

async function handleSubmit() {
  if (!selection.value.canSubmit) return

  isSubmitting.value = true

  const { profileId, lookup } = selection.value
  const targetCollectionId = props.targetCollectionId

  open.value = false
  try {
    const result = await spec.value.submit(profileId, lookup, { targetCollectionId })

    if (!result.success || !result.data) {
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
      notify.info(m.value.adder.addCancelled({ label: entityLabel.value }))
      return
    }
    if (run.status !== 'completed') {
      notify.error(addFailedTitle.value, run.result?.error)
      return
    }

    const entityId = spec.value.extractId(run.result?.output)
    if (!entityId) {
      notify.error(
        addFailedTitle.value,
        m.value.adder.missingEntityId({ label: entityLabel.value })
      )
      return
    }

    emit('success', entityId)
  } catch (error) {
    notify.error(addFailedTitle.value, (error as Error).message)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Icon
            :icon="getEntityIcon(props.entityType)"
            class="size-4"
          />
          {{ m.library.forms.addEntityTitle({ label: entityLabel }) }}
        </DialogTitle>
      </DialogHeader>
      <DialogBody>
        <EntitySearcher
          :entity-type="props.entityType"
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
          @click="open = false"
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
