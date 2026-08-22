<script setup lang="ts">
/**
 * Person Detail Page
 *
 * Full page view for person detail, used by routing.
 */

import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { eq } from 'drizzle-orm'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { PageHeader, PageHeaderTitle } from '@renderer/components/ui/page-header'
import { Separator } from '@renderer/components/ui/separator'
import { StateView } from '@renderer/components/ui/state-view'
import { SpoilerConfirmDialog } from '@renderer/components/ui/spoiler-confirm-dialog'
import { PersonDetailContent } from '@renderer/components/shared/person'
import { EntityScoreFormDialog, EntityDropdownMenu } from '@renderer/components/shared/entity'
import {
  useAmbientLight,
  useEntityDetailRoute,
  usePersonRouteProvider
} from '@renderer/composables'
import { useI18n } from '@renderer/composables/use-i18n'
import { db } from '@renderer/core/db'
import { notify } from '@renderer/core/notify'
import { persons } from '@shared/db'
import { getEntityImageUrl } from '@renderer/utils/entity-image'
import { getEntityIcon } from '@renderer/utils/format'

// =============================================================================
// Route & Navigation
// =============================================================================

const route = useRoute()

const personId = computed(() => route.params.personId as string)

const { exit } = useEntityDetailRoute('person', personId)

// =============================================================================
// Provider (data settled during navigation by the route loader)
// =============================================================================

const { m } = useI18n()

const { person, error, spoilersRevealed } = usePersonRouteProvider()

const spoilerConfirmOpen = ref(false)

useAmbientLight(() =>
  person.value
    ? getEntityImageUrl('person', person.value, 'cover', { width: 100, height: 100 })
    : null
)

// =============================================================================
// State
// =============================================================================

const scoreDialogOpen = ref(false)
const isPendingFavorite = ref(false)

// =============================================================================
// Actions
// =============================================================================

async function handleToggleFavorite() {
  if (isPendingFavorite.value || !person.value) return
  const current = person.value
  isPendingFavorite.value = true
  try {
    await db
      .update(persons)
      .set({ isFavorite: !current.isFavorite })
      .where(eq(persons.id, current.id))
    notify.success(
      current.isFavorite
        ? m.value.library.feedback.favoriteRemoved
        : m.value.library.feedback.favoriteAdded
    )
  } catch {
    notify.error(m.value.common.operationFailed)
  } finally {
    isPendingFavorite.value = false
  }
}

function handleToggleSpoilers() {
  if (spoilersRevealed.value) {
    spoilersRevealed.value = false
    return
  }
  spoilerConfirmOpen.value = true
}

function handleRevealSpoilersConfirm() {
  spoilersRevealed.value = true
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
    v-else-if="!person"
    state="not-found"
    :icon="getEntityIcon('person')"
    :title="m.library.detail.notFoundTitle({ label: m.library.entities.person })"
    :description="m.library.detail.notFoundDescription({ label: m.library.entities.person })"
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
    class="h-full flex flex-col"
  >
    <!-- Header -->
    <PageHeader>
      <PageHeaderTitle
        :title="person!.name"
        :icon="getEntityIcon('person')"
      />

      <template #actions>
        <Button
          variant="secondary"
          size="icon-sm"
          class="flex items-center py-0"
          :tooltip="m.library.detail.tooltips.score"
          @click="scoreDialogOpen = true"
        >
          <Icon
            icon="icon-[mdi--starburst-outline]"
            class="size-4"
          />
        </Button>

        <Separator
          orientation="vertical"
          class="h-4"
        />

        <Button
          variant="secondary"
          size="icon-sm"
          :tooltip="
            person!.isFavorite
              ? m.library.detail.tooltips.favoriteRemove
              : m.library.detail.tooltips.favoriteAdd
          "
          :disabled="isPendingFavorite"
          @click="handleToggleFavorite"
        >
          <Icon
            icon="icon-[mdi--heart-outline]"
            :class="person!.isFavorite ? 'size-4 text-destructive' : 'size-4'"
          />
        </Button>

        <Button
          variant="secondary"
          size="icon-sm"
          :tooltip="
            spoilersRevealed
              ? m.library.detail.tooltips.spoilerHide
              : m.library.detail.tooltips.spoilerShow
          "
          @click="handleToggleSpoilers"
        >
          <Icon
            :icon="spoilersRevealed ? 'icon-[mdi--eye-outline]' : 'icon-[mdi--eye-off-outline]'"
            class="size-4"
          />
        </Button>

        <Separator
          orientation="vertical"
          class="h-4"
        />

        <!-- More menu -->
        <EntityDropdownMenu
          entity-type="person"
          :entity-id="person!.id"
        />
      </template>
    </PageHeader>

    <!-- Main content -->
    <div class="flex-1 overflow-auto bg-background p-4">
      <PersonDetailContent />
    </div>

    <!-- Score dialog -->
    <EntityScoreFormDialog
      v-if="scoreDialogOpen"
      v-model:open="scoreDialogOpen"
      entity-type="person"
      :entity-id="person!.id"
    />

    <SpoilerConfirmDialog
      v-if="spoilerConfirmOpen"
      v-model:open="spoilerConfirmOpen"
      @confirm="handleRevealSpoilersConfirm"
    />
  </div>
</template>
