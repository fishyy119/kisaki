<script setup lang="ts">
/**
 * Tag Detail Page
 *
 * Full page view of a tag: identity and operations in the header, the browse
 * surface below. Data settles during navigation through the tag route loader.
 */

import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { PageHeader, PageHeaderTitle } from '@renderer/components/ui/page-header'
import { StateView } from '@renderer/components/ui/state-view'
import { TagDetailActions, TagDetailContent } from '@renderer/components/shared/tag'
import { useEntityDetailRoute, useTagRouteProvider } from '@renderer/composables'
import { useI18n } from '@renderer/composables/use-i18n'
import { getEntityIcon } from '@renderer/utils/format'
import { getEntityDetailPath } from '@renderer/utils/entity-routes'
import type { ContentEntityType } from '@shared/common'

const { m } = useI18n()

// =============================================================================
// Route & Navigation
// =============================================================================

const route = useRoute()
const router = useRouter()

const tagId = computed(() => route.params.tagId as string)

const { exit } = useEntityDetailRoute('tag', tagId)

// =============================================================================
// Provider (data settled during navigation by the route loader)
// =============================================================================

const {
  tag,
  error,
  params: { query }
} = useTagRouteProvider()

// =============================================================================
// Actions
// =============================================================================

function handleOpen(entityType: ContentEntityType, entityId: string) {
  if (!tag.value) return
  // No `from`: a tag is not an explorer-addressable context, so the autofill
  // guard supplies the canonical one.
  router.push(getEntityDetailPath(entityType, entityId))
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
    v-else-if="!tag"
    state="not-found"
    :icon="getEntityIcon('tag')"
    :title="m.library.detail.notFoundTitle({ label: m.library.entities.tag })"
    :description="m.library.detail.notFoundDescription({ label: m.library.entities.tag })"
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
        :title="tag.name"
        :icon="getEntityIcon('tag')"
      />
      <Badge
        v-if="tag.isNsfw"
        variant="destructive"
        class="px-1.5 py-0"
      >
        NSFW
      </Badge>

      <template #actions>
        <TagDetailActions :tag-id="tag.id" />
      </template>
    </PageHeader>

    <TagDetailContent
      v-model:query="query"
      class="min-h-0 flex-1 bg-background"
      @open="handleOpen"
    />
  </div>
</template>
