<script setup lang="ts">
/**
 * Uncategorized Page
 *
 * Browse surface of the entities no visible collection holds: counts per
 * content type in the band, the browsed type (the route's) below.
 */

import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from '@renderer/components/ui/button'
import { PageHeader, PageHeaderTitle } from '@renderer/components/ui/page-header'
import { StateView } from '@renderer/components/ui/state-view'
import { EntityBrowsePanel } from '@renderer/components/shared/entity'
import { useI18n } from '@renderer/composables/use-i18n'
import { getEntityDetailPath, LIBRARY_HOME_PATH } from '@renderer/utils/entity-routes'
import { formatExplorerContext } from '@renderer/utils/explorer-context'
import type { ContentEntityType } from '@shared/entity-types'
import { useUncategorizedList } from '../composables'

const { m } = useI18n()

const router = useRouter()

// =============================================================================
// Data (committed by the route query before the page mounts)
// =============================================================================

const { entities, counts, entityType, query, error } = useUncategorizedList()

const entityLabel = computed(() =>
  entityType.value ? m.value.library.entities[entityType.value] : ''
)

// =============================================================================
// Actions
// =============================================================================

function handleOpen(type: ContentEntityType, entityId: string) {
  router.push({
    path: getEntityDetailPath(type, entityId),
    query: { from: formatExplorerContext({ kind: 'uncategorized' }) }
  })
}

function exit() {
  void router.replace(LIBRARY_HOME_PATH)
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
    v-else-if="!entityType"
    state="not-found"
    icon="icon-[mdi--folder-question-outline]"
    :title="m.app.notFound.title"
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
        :title="m.library.pages.uncategorizedTitle"
        icon="icon-[mdi--folder-question-outline]"
      />
    </PageHeader>

    <EntityBrowsePanel
      v-model:query="query"
      class="min-h-0 flex-1 bg-background"
      :entity-type="entityType"
      :entities="entities"
      :counts="counts"
      :membership-label="m.library.browse.membershipOrder.default"
      empty-icon="icon-[mdi--check-circle-outline]"
      :empty-description="m.library.pages.uncategorizedEmpty({ label: entityLabel })"
      @open="handleOpen"
    />
  </div>
</template>
