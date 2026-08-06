<!--
  RelationEditor
  Entity multi-select value editor for relation conditions (value is id[]).
  The select trigger keeps its placeholder; the selection is shown only as
  removable name badges below.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import type { AllEntityType } from '@shared/common'
import { Icon } from '@renderer/components/ui/icon'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { GameSelect } from '@renderer/components/shared/game'
import { CharacterSelect } from '@renderer/components/shared/character'
import { PersonSelect } from '@renderer/components/shared/person'
import { CompanySelect } from '@renderer/components/shared/company'
import { TagSelect } from '@renderer/components/shared/tag'
import { CollectionSelect } from '@renderer/components/shared/collection'
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
    <GameSelect
      v-if="props.targetEntity === 'game'"
      v-model:selected-ids="selectedIds"
      multiple
      :show-selected-label="false"
    />
    <CharacterSelect
      v-else-if="props.targetEntity === 'character'"
      v-model:selected-ids="selectedIds"
      multiple
      :show-selected-label="false"
    />
    <PersonSelect
      v-else-if="props.targetEntity === 'person'"
      v-model:selected-ids="selectedIds"
      multiple
      :show-selected-label="false"
    />
    <CompanySelect
      v-else-if="props.targetEntity === 'company'"
      v-model:selected-ids="selectedIds"
      multiple
      :show-selected-label="false"
    />
    <TagSelect
      v-else-if="props.targetEntity === 'tag'"
      v-model:selected-ids="selectedIds"
      multiple
      :show-selected-label="false"
    />
    <CollectionSelect
      v-else-if="props.targetEntity === 'collection'"
      v-model:selected-ids="selectedIds"
      multiple
      :show-selected-label="false"
    />

    <div
      v-if="(selectedEntities?.length ?? 0) > 0"
      class="mt-2 flex flex-wrap gap-1.5"
    >
      <Badge
        v-for="item in selectedEntities"
        :key="item.id"
        variant="secondary"
        class="text-xs flex items-center gap-1"
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
