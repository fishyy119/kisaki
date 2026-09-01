<!--
  EntityBrowseTabs
  Content entity type switch: icon, label, and optional count per type. The
  label collapses to the button title when the row is narrower than the
  container threshold (the explorer rail); the icon and count stay.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { SegmentedControl, SegmentedControlItem } from '@renderer/components/ui/segmented-control'
import { Icon } from '@renderer/components/ui/icon'
import type { ContentEntityCounts } from '@renderer/composables/content-entities'
import { useI18n } from '@renderer/composables/use-i18n'
import { getEntityIcon } from '@renderer/utils/format'
import {
  CONTENT_ENTITY_TYPES,
  isContentEntityType,
  type ContentEntityType
} from '@shared/common'

interface Props {
  counts?: ContentEntityCounts | null
  disabledTypes?: readonly ContentEntityType[]
}

const props = withDefaults(defineProps<Props>(), {
  counts: null,
  disabledTypes: () => []
})

const model = defineModel<ContentEntityType>({ required: true })

const { m } = useI18n()

// The segmented control speaks plain strings; only entity types get through.
const entityTypeModel = computed({
  get: () => model.value,
  set: (value: string) => {
    if (isContentEntityType(value)) model.value = value
  }
})
</script>

<template>
  <SegmentedControl v-model="entityTypeModel">
    <SegmentedControlItem
      v-for="type in CONTENT_ENTITY_TYPES"
      :key="type"
      :value="type"
      :disabled="props.disabledTypes.includes(type)"
      :title="m.library.entities[type]"
    >
      <Icon
        :icon="getEntityIcon(type)"
        class="size-3.5"
      />
      <span class="hidden @2xl:inline">{{ m.library.entities[type] }}</span>
      <span
        v-if="props.counts && props.counts[type] > 0"
        class="text-muted-foreground tabular-nums"
      >
        ({{ props.counts[type] }})
      </span>
    </SegmentedControlItem>
  </SegmentedControl>
</template>
