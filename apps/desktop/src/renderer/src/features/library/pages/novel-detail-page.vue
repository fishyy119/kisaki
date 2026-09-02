<script setup lang="ts">
/**
 * Novel Detail Page
 *
 * Full page view for novel detail, used by routing.
 */

import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { eq } from 'drizzle-orm'
import { BackToTop } from '@renderer/components/ui/back-to-top'
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
  NovelDetailContent,
  NovelReadButton,
  NovelReadCatchUpDialog
} from '@renderer/components/shared/novel'
import { EntityScoreFormDialog, EntityDropdownMenu } from '@renderer/components/shared/entity'
import { useAmbientLight, useNovelRouteProvider, useEntityDetailRoute } from '@renderer/composables'
import { shouldOfferReadCatchUp } from '@renderer/composables/novel-completion'
import { useI18n } from '@renderer/composables/use-i18n'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { novels, type MediaStatus } from '@shared/db'
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

const STATUS_OPTIONS = computed(() => getMediaStatusOptions('novel'))

// =============================================================================
// Route & Navigation
// =============================================================================

const route = useRoute()

const novelId = computed(() => route.params.novelId as string)

const { exit } = useEntityDetailRoute('novel', novelId)

// =============================================================================
// Provider (data settled during navigation by the route loader)
// =============================================================================

const {
  novel,
  error,
  params: { spoilersRevealed }
} = useNovelRouteProvider()

const spoilerConfirmOpen = ref(false)

useAmbientLight(() =>
  novel.value ? getEntityImageUrl('novel', novel.value, 'cover', { width: 100, height: 100 }) : null
)

// =============================================================================
// State
// =============================================================================

const scrollRef = ref<HTMLElement>()
const scoreDialogOpen = ref(false)
const catchUpOpen = ref(false)
const isPendingFavorite = ref(false)
const isPendingStatus = ref(false)

// =============================================================================
// Actions
// =============================================================================

async function handleToggleFavorite() {
  if (isPendingFavorite.value || !novel.value) return
  const current = novel.value
  isPendingFavorite.value = true
  try {
    await db
      .update(novels)
      .set({ isFavorite: !current.isFavorite })
      .where(eq(novels.id, current.id))
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
  get: () => novel.value?.status,
  set: async (status: MediaStatus | undefined) => {
    if (isPendingStatus.value || !novel.value || !status) return
    const current = novel.value
    isPendingStatus.value = true
    try {
      await db.update(novels).set({ status }).where(eq(novels.id, current.id))
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
      log.warn('Volume catch-up offer check failed:', error)
    }
  }
})

async function handleOpenNovelDir() {
  const current = novel.value
  if (!current?.dirPath) {
    notify.error(m.value.novel.detail.novelDirNotSet)
    return
  }

  const result = await ipcManager.invoke('native:open-path', {
    path: current.dirPath,
    ensure: 'folder'
  })
  if (!result.success) {
    notify.error(m.value.novel.files.openFolderFailed)
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
    v-else-if="!novel"
    state="not-found"
    :icon="getEntityIcon('novel')"
    :title="m.library.detail.notFoundTitle({ label: m.library.entities.novel })"
    :description="m.library.detail.notFoundDescription({ label: m.library.entities.novel })"
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
        :title="novel.name"
        :icon="getEntityIcon('novel')"
      />

      <Tooltip>
        <DropdownMenu>
          <TooltipTrigger as-child>
            <DropdownMenuTrigger as-child>
              <Badge
                :variant="getMediaStatusVariant(novel.status)"
                class="shrink-0 cursor-pointer"
              >
                {{ formatMediaStatus('novel', novel.status) }}
              </Badge>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>{{ m.library.status.label.novel }}</TooltipContent>

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
          :tooltip="m.novel.detail.openNovelDir"
          :disabled="!novel.dirPath"
          @click="handleOpenNovelDir"
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
            novel.isFavorite
              ? m.library.detail.tooltips.favoriteRemove
              : m.library.detail.tooltips.favoriteAdd
          "
          :disabled="isPendingFavorite"
          @click="handleToggleFavorite"
        >
          <Icon
            icon="icon-[mdi--heart-outline]"
            :class="novel.isFavorite ? 'size-4 text-destructive' : 'size-4'"
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

        <NovelReadButton
          :novel-id="novel.id"
          size="sm"
        />
        <EntityDropdownMenu
          entity-type="novel"
          :entity-id="novel.id"
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

    <div class="relative flex min-h-0 flex-1 flex-col">
      <div
        ref="scrollRef"
        class="min-h-0 flex-1 overflow-auto bg-background p-4"
      >
        <NovelDetailContent />
      </div>

      <BackToTop :target="scrollRef" />
    </div>

    <!-- Score dialog -->
    <EntityScoreFormDialog
      v-if="scoreDialogOpen"
      v-model:open="scoreDialogOpen"
      entity-type="novel"
      :entity-id="novel.id"
    />

    <NovelReadCatchUpDialog
      v-if="catchUpOpen"
      v-model:open="catchUpOpen"
      :novel-id="novel.id"
    />

    <SpoilerConfirmDialog
      v-if="spoilerConfirmOpen"
      v-model:open="spoilerConfirmOpen"
      @confirm="handleRevealSpoilersConfirm"
    />
  </div>
</template>
