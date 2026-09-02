<script setup lang="ts">
/**
 * Character Detail Page
 *
 * Full page view for character detail, used by routing.
 */

import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { eq } from 'drizzle-orm'
import { Icon } from '@renderer/components/ui/icon'
import { BackToTop } from '@renderer/components/ui/back-to-top'
import { Button } from '@renderer/components/ui/button'
import { PageHeader, PageHeaderTitle } from '@renderer/components/ui/page-header'
import { Separator } from '@renderer/components/ui/separator'
import { StateView } from '@renderer/components/ui/state-view'
import { SpoilerConfirmDialog } from '@renderer/components/ui/spoiler-confirm-dialog'
import { CharacterDetailContent } from '@renderer/components/shared/character'
import { EntityScoreFormDialog, EntityDropdownMenu } from '@renderer/components/shared/entity'
import {
  useAmbientLight,
  useCharacterRouteProvider,
  useEntityDetailRoute
} from '@renderer/composables'
import { useI18n } from '@renderer/composables/use-i18n'
import { db } from '@renderer/core/db'
import { notify } from '@renderer/core/notify'
import { characters } from '@shared/db'
import { getEntityImageUrl } from '@renderer/utils/entity-image'
import { getEntityIcon } from '@renderer/utils/format'

// =============================================================================
// Route & Navigation
// =============================================================================

const route = useRoute()

const characterId = computed(() => route.params.characterId as string)

const { exit } = useEntityDetailRoute('character', characterId)

const { m } = useI18n()

// =============================================================================
// Provider (data settled during navigation by the route loader)
// =============================================================================

const {
  character,
  error,
  params: { spoilersRevealed }
} = useCharacterRouteProvider()

const spoilerConfirmOpen = ref(false)

useAmbientLight(() =>
  character.value
    ? getEntityImageUrl('character', character.value, 'cover', { width: 100, height: 100 })
    : null
)

// =============================================================================
// State
// =============================================================================

const scrollRef = ref<HTMLElement>()
const scoreDialogOpen = ref(false)
const isPendingFavorite = ref(false)

// =============================================================================
// Actions
// =============================================================================

async function handleToggleFavorite() {
  if (isPendingFavorite.value || !character.value) return
  const current = character.value
  isPendingFavorite.value = true
  try {
    await db
      .update(characters)
      .set({ isFavorite: !current.isFavorite })
      .where(eq(characters.id, current.id))
    notify.success(
      current.isFavorite
        ? m.value.library.feedback.favoriteRemoved
        : m.value.library.feedback.favoriteAdded
    )
  } catch {
    notify.error(m.value.feedback.operationFailed)
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
    v-else-if="!character"
    state="not-found"
    :icon="getEntityIcon('character')"
    :title="m.library.detail.notFoundTitle({ label: m.library.entities.character })"
    :description="m.library.detail.notFoundDescription({ label: m.library.entities.character })"
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
        :title="character.name"
        :icon="getEntityIcon('character')"
      />

      <template #actions>
        <Button
          variant="secondary"
          :size="character.score !== null ? 'sm' : 'icon-sm'"
          class="flex items-center py-0"
          :class="[character.score !== null && 'text-warning']"
          :tooltip="m.library.detail.tooltips.score"
          @click="scoreDialogOpen = true"
        >
          <Icon
            icon="icon-[mdi--starburst-outline]"
            class="size-4"
          />
          <span
            v-if="character.score"
            class="text-xs"
          >
            {{ (character.score / 10).toFixed(1) }}
          </span>
        </Button>

        <Separator
          orientation="vertical"
          class="h-4"
        />

        <Button
          variant="secondary"
          size="icon-sm"
          :tooltip="
            character.isFavorite
              ? m.library.detail.tooltips.favoriteRemove
              : m.library.detail.tooltips.favoriteAdd
          "
          :disabled="isPendingFavorite"
          @click="handleToggleFavorite"
        >
          <Icon
            icon="icon-[mdi--heart-outline]"
            :class="character.isFavorite ? 'size-4 text-destructive' : 'size-4'"
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
          entity-type="character"
          :entity-id="character.id"
        />
      </template>
    </PageHeader>

    <!-- Main content -->
    <div class="relative flex min-h-0 flex-1 flex-col">
      <div
        ref="scrollRef"
        class="min-h-0 flex-1 overflow-auto bg-background p-4"
      >
        <CharacterDetailContent />
      </div>

      <BackToTop :target="scrollRef" />
    </div>

    <!-- Score dialog -->
    <EntityScoreFormDialog
      v-if="scoreDialogOpen"
      v-model:open="scoreDialogOpen"
      entity-type="character"
      :entity-id="character.id"
    />

    <SpoilerConfirmDialog
      v-if="spoilerConfirmOpen"
      v-model:open="spoilerConfirmOpen"
      @confirm="handleRevealSpoilersConfirm"
    />
  </div>
</template>
