<!--
  RelationEditor
  Entity multi-select value editor for relation conditions (value is id[]).
  The select trigger keeps its placeholder; the selection is shown only as
  removable name badges below.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import type { AllEntityType } from '@shared/entity-types'
import { Icon } from '@renderer/components/ui/icon'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { ENTITY_SELECT_SPECS } from '@renderer/components/shared/entity'
import { useAsyncData } from '@renderer/composables'
import { queryEntityNames } from '@renderer/core/db'
import { usePreferencesStore } from '@renderer/stores'

interface Props {
  targetEntity: AllEntityType
}

const props = defineProps<Props>()
const model = defineModel<string[]>({ required: true })

const preferencesStore = usePreferencesStore()
const { showNsfw } = storeToRefs(preferencesStore)

const spec = computed(() => ENTITY_SELECT_SPECS[props.targetEntity])

const selectedIds = computed({
  get: () => model.value,
  set: (ids: string[]) => {
    model.value = ids.filter(Boolean)
  }
})

const { data: selectedEntities } = useAsyncData(
  () => queryEntityNames(props.targetEntity, model.value, showNsfw.value),
  { watch: [() => props.targetEntity, model, showNsfw] }
)

function handleRemove(idToRemove: string) {
  model.value = model.value.filter((id) => id !== idToRemove)
}
</script>

<template>
  <div>
    <component
      :is="spec.component()"
      v-model:selected-ids="selectedIds"
      multiple
      :show-selected-label="false"
      v-bind="spec.pickerProps"
    />

    <div
      v-if="(selectedEntities?.length ?? 0) > 0"
      class="mt-2 flex flex-wrap gap-1.5"
    >
      <Badge
        v-for="item in selectedEntities"
        :key="item.id"
        variant="secondary"
        class="flex"
      >
        <span class="truncate max-w-32">{{ item.name }}</span>
        <Button
          variant="ghost"
          size="icon-xs"
          class="size-4 -mr-1"
          @click="() => handleRemove(item.id)"
        >
          <Icon
            icon="icon-[mdi--close]"
            class="size-3"
          />
        </Button>
      </Badge>
    </div>
  </div>
</template>
