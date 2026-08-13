<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { AllEntityType } from '@shared/common'
import type { EntityMergeResult } from '@shared/entity-merge'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Icon } from '@renderer/components/ui/icon'
import { notify } from '@renderer/core/notify'
import { useAsyncData, useEntityMerge, useI18n } from '@renderer/composables'
import { fetchEntityMergeSummary } from './summary'
import TargetSummary from './target-summary.vue'
import SourcePicker from './source-picker.vue'
import SourceSummary from './source-summary.vue'
import ConfirmSummary from './confirm-summary.vue'

interface Props {
  entityType: AllEntityType
  targetId: string
}

const props = defineProps<Props>()
const { m } = useI18n()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{
  merged: [result: EntityMergeResult]
}>()

const sourceId = ref('')

const { data: targetSummary } = useAsyncData(
  () => fetchEntityMergeSummary(props.entityType, props.targetId),
  {
    watch: [() => props.entityType, () => props.targetId],
    enabled: () => open.value
  }
)

const { data: sourceSummary } = useAsyncData(
  async () => (sourceId.value ? fetchEntityMergeSummary(props.entityType, sourceId.value) : null),
  {
    watch: [() => props.entityType, sourceId],
    enabled: () => open.value
  }
)

const { submitting, mergeEntities } = useEntityMerge({
  entityType: () => props.entityType,
  targetId: () => props.targetId,
  sourceId
})

const openModel = computed({
  get: () => open.value,
  set: (value: boolean) => {
    if (!submitting.value) open.value = value
  }
})

const canSubmit = computed(
  () => Boolean(sourceId.value && targetSummary.value && sourceSummary.value) && !submitting.value
)

watch(open, (value) => {
  if (!value) {
    sourceId.value = ''
  }
})

async function handleSubmit() {
  if (!canSubmit.value) return

  try {
    const result = await mergeEntities()
    notify.success(
      m.value.merge.merged({ name: targetSummary.value?.name ?? m.value.merge.fallbackTargetName })
    )
    emit('merged', result)
    open.value = false
  } catch {
    notify.error(m.value.merge.failed)
  }
}
</script>

<template>
  <Dialog v-model:open="openModel">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ m.merge.title }}</DialogTitle>
      </DialogHeader>

      <DialogBody class="space-y-3">
        <TargetSummary :summary="targetSummary" />

        <SourcePicker
          v-model="sourceId"
          :entity-type="props.entityType"
          :target-id="props.targetId"
          :disabled="submitting"
        />

        <SourceSummary
          v-if="sourceId && sourceSummary"
          :summary="sourceSummary"
        />

        <ConfirmSummary
          v-if="targetSummary && sourceSummary"
          :target-name="targetSummary.name"
          :source-name="sourceSummary.name"
        />
      </DialogBody>

      <DialogFooter>
        <Button
          variant="secondary"
          :disabled="submitting"
          @click="openModel = false"
        >
          {{ m.common.cancel }}
        </Button>
        <Button
          :disabled="!canSubmit"
          @click="handleSubmit"
        >
          <Icon
            v-if="submitting"
            icon="icon-[mdi--loading]"
            class="size-4 animate-spin"
          />
          {{ m.merge.action }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
