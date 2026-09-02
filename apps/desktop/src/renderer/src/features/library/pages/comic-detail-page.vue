<script setup lang="ts">
/**
 * Comic Detail Page
 *
 * Full page view for comic detail, used by routing.
 */

import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { eq } from 'drizzle-orm'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { Icon } from '@renderer/components/ui/icon'
import { PageHeader, PageHeaderTitle } from '@renderer/components/ui/page-header'
import { Separator } from '@renderer/components/ui/separator'
import { SpoilerConfirmDialog } from '@renderer/components/ui/spoiler-confirm-dialog'
import { StateView } from '@renderer/components/ui/state-view'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import {
  ComicDetailContent,
  ComicReadButton,
  ComicReadCatchUpDialog
} from '@renderer/components/shared/comic'
import { EntityScoreFormDialog, EntityDropdownMenu } from '@renderer/components/shared/entity'
import { useAmbientLight, useComicRouteProvider, useEntityDetailRoute } from '@renderer/composables'
import { shouldOfferReadCatchUp } from '@renderer/composables/comic-completion'
import { useI18n } from '@renderer/composables/use-i18n'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { comics, type MediaStatus } from '@shared/db'
import { getEntityImageUrl } from '@renderer/utils/entity-image'
import {
  formatMediaStatus,
  getEntityIcon,
  getMediaStatusOptions,
  getMediaStatusVariant
} from '@renderer/utils/format'

const log = createLogger('Library')

const { m } = useI18n()

// =============================================================================
// Constants
// =============================================================================

const STATUS_OPTIONS = computed(() => getMediaStatusOptions('comic'))

// =============================================================================
// Route & Navigation
// =============================================================================

const route = useRoute()

const comicId = computed(() => route.params.comicId as string)

const { exit } = useEntityDetailRoute('comic', comicId)

// =============================================================================
// Provider (data settled during navigation by the route loader)
// =============================================================================

const {
  comic,
  error,
  params: { spoilersRevealed }
} = useComicRouteProvider()

const spoilerConfirmOpen = ref(false)

useAmbientLight(() =>
  comic.value ? getEntityImageUrl('comic', comic.value, 'cover', { width: 100, height: 100 }) : null
)

// =============================================================================
// State
// =============================================================================

const scoreDialogOpen = ref(false)
const catchUpOpen = ref(false)
const isPendingFavorite = ref(false)
const isPendingStatus = ref(false)

// =============================================================================
// Actions
// =============================================================================

async function handleToggleFavorite() {
  if (isPendingFavorite.value || !comic.value) return
  const current = comic.value
  isPendingFavorite.value = true
  try {
    await db
      .update(comics)
      .set({ isFavorite: !current.isFavorite })
      .where(eq(comics.id, current.id))
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

const selectedStatus = computed({
  get: () => comic.value?.status,
  set: async (status: MediaStatus | undefined) => {
    if (isPendingStatus.value || !comic.value || !status) return
    const current = comic.value
    isPendingStatus.value = true
    try {
      await db.update(comics).set({ status }).where(eq(comics.id, current.id))
      notify.success(m.value.library.feedback.statusUpdated)
    } catch {
      notify.error(m.value.library.feedback.updateFailed)
      return
    } finally {
      isPendingStatus.value = false
    }

    try {
      catchUpOpen.value = await shouldOfferReadCatchUp(current.id, status)
    } catch (error) {
      // The status change already succeeded; a missed offer is not worth a notice.
      log.warn('Unit catch-up offer check failed:', error)
    }
  }
})

async function handleOpenComicDir() {
  const current = comic.value
  if (!current?.dirPath) {
    notify.error(m.value.comic.detail.comicDirNotSet)
    return
  }

  const result = await ipcManager.invoke('native:open-path', {
    path: current.dirPath,
    ensure: 'folder'
  })
  if (!result.success) {
    notify.error(m.value.comic.files.openFolderFailed)
  }
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
    v-else-if="!comic"
    state="not-found"
    :icon="getEntityIcon('comic')"
    :title="m.library.detail.notFoundTitle({ label: m.library.entities.comic })"
    :description="m.library.detail.notFoundDescription({ label: m.library.entities.comic })"
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
    <PageHeader>
      <PageHeaderTitle
        :title="comic.name"
        :icon="getEntityIcon('comic')"
      />

      <Tooltip>
        <DropdownMenu>
          <TooltipTrigger as-child>
            <DropdownMenuTrigger as-child>
              <Badge
                :variant="getMediaStatusVariant(comic.status)"
                class="shrink-0 cursor-pointer"
              >
                {{ formatMediaStatus('comic', comic.status) }}
              </Badge>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>{{ m.library.status.label.comic }}</TooltipContent>

          <DropdownMenuContent
            align="end"
            class="min-w-36"
          >
            <DropdownMenuRadioGroup v-model="selectedStatus">
              <DropdownMenuRadioItem
                v-for="option in STATUS_OPTIONS"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </Tooltip>

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

        <Button
          variant="secondary"
          size="icon-sm"
          :tooltip="m.comic.detail.openComicDir"
          :disabled="!comic.dirPath"
          @click="handleOpenComicDir"
        >
          <Icon
            icon="icon-[mdi--folder-open-outline]"
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
            comic.isFavorite
              ? m.library.detail.tooltips.favoriteRemove
              : m.library.detail.tooltips.favoriteAdd
          "
          :disabled="isPendingFavorite"
          @click="handleToggleFavorite"
        >
          <Icon
            icon="icon-[mdi--heart-outline]"
            :class="comic.isFavorite ? 'size-4 text-destructive' : 'size-4'"
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

        <ComicReadButton
          :comic-id="comic.id"
          size="sm"
        />
        <EntityDropdownMenu
          entity-type="comic"
          :entity-id="comic.id"
        >
          <Button
            variant="secondary"
            size="icon-sm"
          >
            <Icon
              icon="icon-[mdi--dots-horizontal]"
              class="size-4"
            />
          </Button>
        </EntityDropdownMenu>
      </template>
    </PageHeader>

    <div class="flex-1 overflow-auto bg-background p-4">
      <ComicDetailContent />
    </div>

    <!-- Score dialog -->
    <EntityScoreFormDialog
      v-if="scoreDialogOpen"
      v-model:open="scoreDialogOpen"
      entity-type="comic"
      :entity-id="comic.id"
    />

    <ComicReadCatchUpDialog
      v-if="catchUpOpen"
      v-model:open="catchUpOpen"
      :comic-id="comic.id"
    />

    <SpoilerConfirmDialog
      v-if="spoilerConfirmOpen"
      v-model:open="spoilerConfirmOpen"
      @confirm="handleRevealSpoilersConfirm"
    />
  </div>
</template>
