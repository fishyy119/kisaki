<!--
  CollectionDetailContent
  Browse surface of a collection: its members, one content type at a time,
  under the list query the host owns. A dynamic collection only offers the
  types it is configured for. Shared by the page and the dialog.
-->
<script setup lang="ts">
import { computed, type HTMLAttributes } from 'vue'
import { EntityBrowsePanel } from '@renderer/components/shared/entity'
import { useCollection, useI18n, type EntityListQuery } from '@renderer/composables'
import { getEntityIcon } from '@renderer/utils/format'
import { CONTENT_ENTITY_TYPES, type ContentEntityType } from '@shared/entity-types'

interface Props {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()

const query = defineModel<EntityListQuery>('query', { required: true })

const emit = defineEmits<{
  open: [entityType: ContentEntityType, id: string]
}>()

const { m } = useI18n()

const { collection, entities, entityType, counts, configuredTypes } = useCollection()

const entityLabel = computed(() => m.value.library.entities[entityType.value])

const disabledTypes = computed(() =>
  CONTENT_ENTITY_TYPES.filter((type) => !configuredTypes.value.includes(type))
)

const membershipLabel = computed(() =>
  collection.value?.isDynamic
    ? m.value.library.browse.membershipOrder.configured
    : m.value.library.browse.membershipOrder.collection
)
</script>

<template>
  <EntityBrowsePanel
    v-if="collection"
    v-model:query="query"
    :class="props.class"
    :entity-type="entityType"
    :entities="entities"
    :counts="counts"
    :disabled-types="disabledTypes"
    :membership-label="membershipLabel"
    :empty-icon="getEntityIcon('collection')"
    :empty-title="m.library.detail.collectionEmptyTitle({ label: entityLabel })"
    :empty-description="m.library.detail.collectionEmptyDescription({ label: entityLabel })"
    @open="(type, id) => emit('open', type, id)"
  />
</template>
