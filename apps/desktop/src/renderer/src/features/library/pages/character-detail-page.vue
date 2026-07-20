<script setup lang="ts">
/**
 * Character Detail Page
 *
 * Full page view for character detail, used by routing.
 */

import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { eq } from 'drizzle-orm'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { PageHeader } from '@renderer/components/ui/page-header'
import { Separator } from '@renderer/components/ui/separator'
import { StateView } from '@renderer/components/ui/state-view'
import { SpoilerConfirmDialog } from '@renderer/components/ui/spoiler-confirm-dialog'
import {
  CharacterScoreFormDialog,
  CharacterDropdownMenu,
  CharacterDetailContent
} from '@renderer/components/shared/character'
import { useAmbientLight, useCharacterRouteProvider, useEvent } from '@renderer/composables'
import { db } from '@renderer/core/db'
import { notify } from '@renderer/core/notify'
import { characters } from '@shared/db'
import { getAttachmentUrl } from '@renderer/utils/attachment'
import { getEntityIcon } from '@renderer/utils/format'

// =============================================================================
// Route & Navigation
// =============================================================================

const route = useRoute()
const router = useRouter()

const characterId = computed(() => route.params.characterId as string)
const backTo = computed(() => (route.query.from as string) || '/library')

// =============================================================================
// Provider (data settled during navigation by the route loader)
// =============================================================================

const { character, error, spoilersRevealed } = useCharacterRouteProvider()

const spoilerConfirmOpen = ref(false)

useAmbientLight(() =>
  character.value?.photoFile
    ? getAttachmentUrl('characters', character.value.id, character.value.photoFile, {
        width: 100,
        height: 100
      })
    : null
)

useEvent('db.deleted', ({ table, id }) => {
  if (table === 'characters' && id === characterId.value) {
    router.push(backTo.value)
  }
})

useEvent('entity.merged', (event) => {
  if (event.entityType === 'character' && event.sourceId === characterId.value) {
    router.replace({ path: `/library/character/${event.targetId}`, query: route.query })
  }
})

// =============================================================================
// State
// =============================================================================

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
    notify.success(current.isFavorite ? '已取消喜欢' : '已添加至喜欢')
  } catch {
    notify.error('操作失败')
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
    title="角色不存在"
    class="h-full bg-background"
  />

  <!-- Content -->
  <div
    v-else
    class="h-full flex flex-col"
  >
    <!-- Header -->
    <PageHeader back-to="/library">
      <h1 class="text-base font-semibold truncate">{{ character.name }}</h1>

      <template #actions>
        <Button
          variant="secondary"
          :size="character.score !== null ? 'sm' : 'icon-sm'"
          class="flex items-center py-0"
          :class="[character.score !== null && 'text-warning']"
          tooltip="评分"
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
          :tooltip="character.isFavorite ? '取消喜欢' : '添加喜欢'"
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
          :tooltip="spoilersRevealed ? '隐藏剧透' : '显示剧透'"
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
        <CharacterDropdownMenu :character-id="character.id" />
      </template>
    </PageHeader>

    <!-- Main content -->
    <div class="flex-1 overflow-auto bg-background p-4">
      <CharacterDetailContent />
    </div>

    <!-- Score dialog -->
    <CharacterScoreFormDialog
      v-if="scoreDialogOpen"
      v-model:open="scoreDialogOpen"
      :character-id="character.id"
    />

    <SpoilerConfirmDialog
      v-if="spoilerConfirmOpen"
      v-model:open="spoilerConfirmOpen"
      @confirm="handleRevealSpoilersConfirm"
    />
  </div>
</template>
