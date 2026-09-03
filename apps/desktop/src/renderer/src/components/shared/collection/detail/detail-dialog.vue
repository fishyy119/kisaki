<!--
  CollectionDetailDialog
  Dialog view of a collection: identity in the header, the browse surface in
  a fill-height body so the band never shifts, the collection's operations
  in the footer.
-->
<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { StateView } from '@renderer/components/ui/state-view'
import { EntityDetailDialog, type EntityDetailTarget } from '@renderer/components/shared/entity'
import {
  useCollectionDialogProvider,
  useDbChanges,
  useI18n,
  useRenderState
} from '@renderer/composables'
import { getEntityIcon } from '@renderer/utils/format'
import type { ContentEntityType } from '@shared/entity-types'
import CollectionDetailActions from './detail-actions.vue'
import CollectionDetailContent from './detail-content.vue'

interface Props {
  entityId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const { m } = useI18n()

const {
  collection,
  isLoading,
  error,
  params: { query }
} = useCollectionDialogProvider(() => props.entityId)
const state = useRenderState(isLoading, error, collection)

useDbChanges(({ changes }) => {
  const deleted = changes.some(
    (change) =>
      change.operation === 'deleted' &&
      change.table === 'collections' &&
      change.id === props.entityId
  )
  if (deleted) open.value = false
})

const openEntity = ref<EntityDetailTarget | null>(null)

function handleOpen(entityType: ContentEntityType, entityId: string) {
  openEntity.value = { entityType, entityId }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      size="xl"
      fill
    >
      <!-- Loading / Error / Not Found -->
      <DialogBody v-if="state !== 'success'">
        <StateView
          :state="state"
          :error="error"
          :icon="getEntityIcon('collection')"
          :title="m.library.detail.notFoundTitle({ label: m.library.entities.collection })"
          :description="
            m.library.detail.notFoundDescription({ label: m.library.entities.collection })
          "
          class="h-full"
        />
      </DialogBody>

      <template v-else-if="collection">
        <DialogHeader>
          <DialogTitle :icon="getEntityIcon('collection')">
            {{ collection.name }}
            <template #trailing>
              <Icon
                v-if="collection.isDynamic"
                icon="icon-[mdi--lightning-bolt]"
                class="size-4 shrink-0 text-muted-foreground"
                :title="m.library.pages.dynamicCollection"
              />
            </template>
          </DialogTitle>
        </DialogHeader>

        <DialogBody class="flex flex-col p-0">
          <CollectionDetailContent
            v-model:query="query"
            class="min-h-0 flex-1"
            @open="handleOpen"
          />
        </DialogBody>

        <DialogFooter>
          <CollectionDetailActions
            :collection-id="collection.id"
            :is-dynamic="collection.isDynamic"
          />
        </DialogFooter>
      </template>
    </DialogContent>
  </Dialog>

  <!-- Detail dialog of the clicked entity -->
  <EntityDetailDialog v-model:target="openEntity" />
</template>
