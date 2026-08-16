<script setup lang="ts">
/**
 * Tv Detail Page
 *
 * Full page view for series detail, used by routing.
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
  TvDetailContent,
  TvWatchButton,
  TvWatchCatchUpDialog
} from '@renderer/components/shared/tv'
import { EntityScoreFormDialog, EntityDropdownMenu } from '@renderer/components/shared/entity'
import { useAmbientLight, useEntityDetailRoute, useTvRouteProvider } from '@renderer/composables'
import { shouldOfferTvWatchCatchUp } from '@renderer/composables/use-tv-watch'
import { useI18n } from '@renderer/composables/use-i18n'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { tvs, type TvStatus } from '@shared/db'
import { getAttachmentUrl } from '@renderer/utils/attachment'
import { formatTvStatus, getTvStatusVariant, getEntityIcon } from '@renderer/utils/format'

const log = createLogger('Tv')

const { m } = useI18n()

// =============================================================================
// Constants
// =============================================================================

const STATUS_OPTIONS = computed<{ value: TvStatus; label: string }[]>(() => [
  { value: 'planned', label: m.value.library.tvStatus.planned },
  { value: 'watching', label: m.value.library.tvStatus.watching },
  { value: 'completed', label: m.value.library.tvStatus.completed },
  { value: 'onHold', label: m.value.library.tvStatus.onHold },
  { value: 'dropped', label: m.value.library.tvStatus.dropped }
])

// =============================================================================
// Route & Navigation
// =============================================================================

const route = useRoute()

const tvId = computed(() => route.params.tvId as string)

const { exit } = useEntityDetailRoute('tv', tvId)

// =============================================================================
// Provider (data settled during navigation by the route loader)
// =============================================================================

const { tv, error, spoilersRevealed } = useTvRouteProvider()

const spoilerConfirmOpen = ref(false)

useAmbientLight(() =>
  tv.value?.coverFile
    ? getAttachmentUrl('tvs', tv.value.id, tv.value.coverFile, { width: 100, height: 100 })
    : null
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
  if (isPendingFavorite.value || !tv.value) return
  const current = tv.value
  isPendingFavorite.value = true
  try {
    await db.update(tvs).set({ isFavorite: !current.isFavorite }).where(eq(tvs.id, current.id))
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

const selectedStatus = computed({
  get: () => tv.value?.status,
  set: async (status: TvStatus | undefined) => {
    if (isPendingStatus.value || !tv.value || !status) return
    const current = tv.value
    isPendingStatus.value = true
    try {
      await db.update(tvs).set({ status }).where(eq(tvs.id, current.id))
      notify.success(m.value.library.feedback.statusUpdated)
    } catch {
      notify.error(m.value.library.feedback.updateFailed)
      return
    } finally {
      isPendingStatus.value = false
    }

    try {
      catchUpOpen.value = await shouldOfferTvWatchCatchUp(current.id, status)
    } catch (error) {
      // The status change already succeeded; a missed offer is not worth a notice.
      log.warn('Episode catch-up offer check failed:', error)
    }
  }
})

async function handleOpenTvDir() {
  const current = tv.value
  if (!current?.tvDirPath) {
    notify.error(m.value.tv.detail.tvDirNotSet)
    return
  }

  const result = await ipcManager.invoke('native:open-path', {
    path: current.tvDirPath,
    ensure: 'folder'
  })
  if (!result.success) {
    notify.error(m.value.tv.files.openFolderFailed)
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
    v-else-if="!tv"
    state="not-found"
    :icon="getEntityIcon('tv')"
    :title="m.library.detail.notFoundTitle({ label: m.library.entities.tv })"
    :description="m.library.detail.notFoundDescription({ label: m.library.entities.tv })"
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
        :title="tv.name"
        :icon="getEntityIcon('tv')"
      />

      <Tooltip>
        <DropdownMenu>
          <TooltipTrigger as-child>
            <DropdownMenuTrigger as-child>
              <Badge
                :variant="getTvStatusVariant(tv.status)"
                class="shrink-0 cursor-pointer"
              >
                {{ formatTvStatus(tv.status) }}
              </Badge>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>{{ m.tv.detail.watchStatus }}</TooltipContent>

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
          :tooltip="m.tv.detail.openTvDir"
          :disabled="!tv.tvDirPath"
          @click="handleOpenTvDir"
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
            tv.isFavorite
              ? m.library.detail.tooltips.favoriteRemove
              : m.library.detail.tooltips.favoriteAdd
          "
          :disabled="isPendingFavorite"
          @click="handleToggleFavorite"
        >
          <Icon
            icon="icon-[mdi--heart-outline]"
            :class="tv.isFavorite ? 'size-4 text-destructive' : 'size-4'"
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

        <TvWatchButton
          :tv-id="tv.id"
          size="sm"
        />
        <EntityDropdownMenu
          entity-type="tv"
          :entity-id="tv.id"
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
      <TvDetailContent />
    </div>

    <!-- Score dialog -->
    <EntityScoreFormDialog
      v-if="scoreDialogOpen"
      v-model:open="scoreDialogOpen"
      entity-type="tv"
      :entity-id="tv.id"
    />

    <TvWatchCatchUpDialog
      v-if="catchUpOpen"
      v-model:open="catchUpOpen"
      :tv-id="tv.id"
    />

    <SpoilerConfirmDialog
      v-if="spoilerConfirmOpen"
      v-model:open="spoilerConfirmOpen"
      @confirm="handleRevealSpoilersConfirm"
    />
  </div>
</template>
