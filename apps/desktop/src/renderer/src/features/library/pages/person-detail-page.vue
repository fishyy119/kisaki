<script setup lang="ts">
/**
 * Person Detail Page
 *
 * Full page view for person detail, used by routing.
 */

import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { eq } from 'drizzle-orm'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { PageHeader } from '@renderer/components/ui/page-header'
import { Separator } from '@renderer/components/ui/separator'
import { StateView } from '@renderer/components/ui/state-view'
import { SpoilerConfirmDialog } from '@renderer/components/ui/spoiler-confirm-dialog'
import {
  PersonScoreFormDialog,
  PersonDropdownMenu,
  PersonDetailContent
} from '@renderer/components/shared/person'
import { useEvent, usePersonProvider, useRenderState } from '@renderer/composables'
import { db } from '@renderer/core/db'
import { notify } from '@renderer/core/notify'
import { persons } from '@shared/db'
import { getEntityIcon } from '@renderer/utils/format'

// =============================================================================
// Route & Navigation
// =============================================================================

const route = useRoute()
const router = useRouter()

const personId = computed(() => route.params.personId as string | undefined)
const backTo = computed(() => (route.query.from as string) || '/library')

// Redirect if no personId
if (!personId.value) {
  router.push(backTo.value)
}

// =============================================================================
// Spoiler State
// =============================================================================

const spoilersRevealed = ref(false)
const spoilerConfirmOpen = ref(false)

watch(personId, () => {
  spoilersRevealed.value = false
  spoilerConfirmOpen.value = false
})

// =============================================================================
// Provider
// =============================================================================

const { person, isLoading, error } = usePersonProvider(() => personId.value ?? '', spoilersRevealed)
const state = useRenderState(isLoading, error, person)

useEvent('db.deleted', ({ table, id }) => {
  if (table === 'persons' && id === personId.value) {
    router.push(backTo.value)
  }
})

useEvent('entity.merged', (event) => {
  if (event.entityType === 'person' && event.sourceId === personId.value) {
    router.replace({ path: `/library/person/${event.targetId}`, query: route.query })
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
  if (isPendingFavorite.value || state.value !== 'success') return
  const current = person.value!
  isPendingFavorite.value = true
  try {
    await db
      .update(persons)
      .set({ isFavorite: !current.isFavorite })
      .where(eq(persons.id, current.id))
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
  <!-- Loading / Error / Not Found -->
  <StateView
    v-if="state !== 'success'"
    :state="state"
    :error="error"
    :icon="getEntityIcon('person')"
    title="人员不存在"
    class="h-full"
  />

  <!-- Content -->
  <div
    v-else-if="person"
    class="h-full flex flex-col"
  >
    <!-- Header -->
    <PageHeader back-to="/library">
      <h1 class="text-base font-semibold truncate">{{ person!.name }}</h1>

      <template #actions>
        <Button
          variant="secondary"
          size="icon-sm"
          class="flex items-center py-0"
          tooltip="评分"
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
          :tooltip="person!.isFavorite ? '取消喜欢' : '添加喜欢'"
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
        <PersonDropdownMenu :person-id="person!.id" />
      </template>
    </PageHeader>

    <!-- Main content -->
    <div class="flex-1 overflow-auto p-4">
      <PersonDetailContent />
    </div>

    <!-- Score dialog -->
    <PersonScoreFormDialog
      v-if="scoreDialogOpen"
      v-model:open="scoreDialogOpen"
      :person-id="person!.id"
    />

    <SpoilerConfirmDialog
      v-if="spoilerConfirmOpen"
      v-model:open="spoilerConfirmOpen"
      @confirm="handleRevealSpoilersConfirm"
    />
  </div>
</template>
