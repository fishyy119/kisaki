<script setup lang="ts">
/**
 * Favorites Page
 *
 * Browse surface of the favorites: counts per content type in the band, the
 * favorites of the browsed type below.
 */

import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { PageHeader, PageHeaderTitle } from '@renderer/components/ui/page-header'
import { EntityBrowsePanel } from '@renderer/components/shared/entity'
import { useI18n } from '@renderer/composables/use-i18n'
import { getEntityDetailPath } from '@renderer/utils/entity-routes'
import type { ContentEntityType } from '@shared/entity-types'
import { useFavorites } from '../composables'

const { m } = useI18n()

const route = useRoute()
const router = useRouter()

// =============================================================================
// Data (committed by the route data kernel before the page mounts)
// =============================================================================

const { entities, counts, entityType, query } = useFavorites()

const entityLabel = computed(() => m.value.library.entities[entityType.value])

// =============================================================================
// Actions
// =============================================================================

function handleOpen(type: ContentEntityType, entityId: string) {
  // No `from`: favorites is not an explorer-addressable context, so the
  // autofill guard supplies the canonical one.
  router.push(getEntityDetailPath(type, entityId))
}
</script>

<template>
  <div class="flex h-full w-full flex-col">
    <PageHeader>
      <PageHeaderTitle
        :title="m.library.pages.favoritesTitle"
        icon="icon-[mdi--heart-outline]"
      />
    </PageHeader>

    <EntityBrowsePanel
      v-model:query="query"
      class="min-h-0 flex-1 bg-background"
      :memory="route.path"
      :entity-type="entityType"
      :entities="entities"
      :counts="counts"
      :membership-label="m.library.browse.membershipOrder.default"
      empty-icon="icon-[mdi--heart-off-outline]"
      :empty-description="m.library.pages.favoritesEmpty({ label: entityLabel })"
      @open="handleOpen"
    />
  </div>
</template>
