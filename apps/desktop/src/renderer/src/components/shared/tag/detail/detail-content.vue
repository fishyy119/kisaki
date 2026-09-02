<!--
  TagDetailContent
  Browse surface of a tag: the entities carrying it, one content type at a
  time, under the list query the host owns. Shared by the page and the dialog.
-->
<script setup lang="ts">
import { computed, type HTMLAttributes } from 'vue'
import { EntityBrowsePanel } from '@renderer/components/shared/entity'
import { useI18n, useTag, type EntityListQuery } from '@renderer/composables'
import { getEntityIcon } from '@renderer/utils/format'
import type { ContentEntityType } from '@shared/entity-types'

interface Props {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()

const query = defineModel<EntityListQuery>('query', { required: true })

const emit = defineEmits<{
  open: [entityType: ContentEntityType, id: string]
}>()

const { m } = useI18n()

const { tag, entities, entityType, counts } = useTag()

const entityLabel = computed(() => m.value.library.entities[entityType.value])
</script>

<template>
  <EntityBrowsePanel
    v-if="tag"
    v-model:query="query"
    :class="props.class"
    :entity-type="entityType"
    :entities="entities"
    :counts="counts"
    :membership-label="m.library.browse.membershipOrder.tag"
    :empty-icon="getEntityIcon('tag')"
    :empty-title="m.library.detail.tagEmptyTitle({ label: entityLabel })"
    :empty-description="m.library.detail.tagEmptyDescription({ label: entityLabel })"
    @open="(type, id) => emit('open', type, id)"
  />
</template>
