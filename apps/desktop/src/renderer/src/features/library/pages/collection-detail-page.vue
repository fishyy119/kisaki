<script setup lang="ts">
/**
 * Collection Detail Page
 *
 * Full page view of a collection: identity and operations in the header, the
 * browse surface below. Data settles during navigation through the collection
 * route loader; static and dynamic collections share the surface.
 */

import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { PageHeader, PageHeaderTitle } from '@renderer/components/ui/page-header'
import { StateView } from '@renderer/components/ui/state-view'
import {
  CollectionDetailActions,
  CollectionDetailContent
} from '@renderer/components/shared/collection'
import {
  useAmbientLight,
  useCollectionRouteProvider,
  useEntityDetailRoute
} from '@renderer/composables'
import { useI18n } from '@renderer/composables/use-i18n'
import { getEntityImageUrl } from '@renderer/utils/entity-image'
import { getEntityIcon } from '@renderer/utils/format'
import { getEntityDetailPath } from '@renderer/utils/entity-routes'
import { formatExplorerContext } from '@renderer/utils/explorer-context'
import type { ContentEntityType } from '@shared/entity-types'

const { m } = useI18n()

// =============================================================================
// Route & Navigation
// =============================================================================

const route = useRoute()
const router = useRouter()

const collectionId = computed(() => route.params.collectionId as string)

const { exit } = useEntityDetailRoute('collection', collectionId)

// =============================================================================
// Provider (data settled during navigation by the route loader)
// =============================================================================

const {
  collection,
  error,
  params: { query }
} = useCollectionRouteProvider()

useAmbientLight(() =>
  collection.value
    ? getEntityImageUrl('collection', collection.value, 'cover', { width: 100, height: 100 })
    : null
)

// =============================================================================
// Actions
// =============================================================================

function handleOpen(entityType: ContentEntityType, entityId: string) {
  if (!collection.value) return
  router.push({
    path: getEntityDetailPath(entityType, entityId),
    query: {
      from: formatExplorerContext({ kind: 'collection', collectionId: collection.value.id })
    }
  })
}
</script>

<template>
  <!-- Error / Not Found (data settles before navigation confirms) -->
  <StateView
    v-if="error"
    state="error"
    :error="error"
    class="h-full bg-background"
  />
  <StateView
    v-else-if="!collection"
    state="not-found"
    :icon="getEntityIcon('collection')"
    :title="m.library.detail.notFoundTitle({ label: m.library.entities.collection })"
    :description="m.library.detail.notFoundDescription({ label: m.library.entities.collection })"
    class="h-full bg-background"
  >
    <template #actions>
      <Button
        variant="secondary"
        @click="exit"
      >
        {{ m.app.notFound.backToLibrary }}
      </Button>
    </template>
  </StateView>

  <!-- Content -->
  <div
    v-else
    class="flex h-full w-full flex-col"
  >
    <PageHeader>
      <PageHeaderTitle
        :title="collection.name"
        :icon="getEntityIcon('collection')"
      />
      <Icon
        v-if="collection.isDynamic"
        icon="icon-[mdi--lightning-bolt]"
        class="size-4 shrink-0"
        :title="m.library.pages.dynamicCollection"
      />

      <template #actions>
        <CollectionDetailActions
          :collection-id="collection.id"
          :is-dynamic="collection.isDynamic"
        />
      </template>
    </PageHeader>

    <CollectionDetailContent
      v-model:query="query"
      class="min-h-0 flex-1 bg-background"
      @open="handleOpen"
    />
  </div>
</template>
