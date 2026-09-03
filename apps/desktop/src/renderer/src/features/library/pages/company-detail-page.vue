<script setup lang="ts">
/**
 * Company Detail Page
 *
 * Full page view for company detail, used by routing.
 */

import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { eq } from 'drizzle-orm'
import { Icon } from '@renderer/components/ui/icon'
import { ScrollRegion } from '@renderer/components/ui/scroll-region'
import { Button } from '@renderer/components/ui/button'
import { PageHeader, PageHeaderTitle } from '@renderer/components/ui/page-header'
import { Separator } from '@renderer/components/ui/separator'
import { StateView } from '@renderer/components/ui/state-view'
import { SpoilerConfirmDialog } from '@renderer/components/ui/spoiler-confirm-dialog'
import { CompanyDetailContent } from '@renderer/components/shared/company'
import { EntityScoreFormDialog, EntityDropdownMenu } from '@renderer/components/shared/entity'
import {
  useAmbientLight,
  useCompanyRouteProvider,
  useEntityDetailRoute
} from '@renderer/composables'
import { useI18n } from '@renderer/composables/use-i18n'
import { db } from '@renderer/core/db'
import { notify } from '@renderer/core/notify'
import { companies } from '@shared/db'
import { getEntityImageUrl } from '@renderer/utils/entity-image'
import { getEntityIcon } from '@renderer/utils/format'

// =============================================================================
// Route & Navigation
// =============================================================================

const route = useRoute()

const companyId = computed(() => route.params.companyId as string)

const { exit } = useEntityDetailRoute('company', companyId)

// =============================================================================
// Provider (data settled during navigation by the route loader)
// =============================================================================

const { m } = useI18n()

const {
  company,
  error,
  params: { spoilersRevealed }
} = useCompanyRouteProvider()

const spoilerConfirmOpen = ref(false)

useAmbientLight(() =>
  company.value
    ? getEntityImageUrl('company', company.value, 'cover', { width: 100, height: 100 })
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
  if (isPendingFavorite.value || !company.value) return
  const current = company.value
  isPendingFavorite.value = true
  try {
    await db
      .update(companies)
      .set({ isFavorite: !current.isFavorite })
      .where(eq(companies.id, current.id))
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
    v-else-if="!company"
    state="not-found"
    :icon="getEntityIcon('company')"
    :title="m.library.detail.notFoundTitle({ label: m.library.entities.company })"
    :description="m.library.detail.notFoundDescription({ label: m.library.entities.company })"
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
        :title="company.name"
        :icon="getEntityIcon('company')"
      />

      <template #actions>
        <Button
          variant="secondary"
          :size="company.score !== null ? 'sm' : 'icon-sm'"
          class="flex items-center py-0"
          :class="[company.score !== null && 'text-warning']"
          :tooltip="m.library.detail.tooltips.score"
          @click="scoreDialogOpen = true"
        >
          <Icon
            icon="icon-[mdi--starburst-outline]"
            class="size-4"
          />
          <span
            v-if="company.score"
            class="text-xs"
          >
            {{ (company.score / 10).toFixed(1) }}
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
            company.isFavorite
              ? m.library.detail.tooltips.favoriteRemove
              : m.library.detail.tooltips.favoriteAdd
          "
          :disabled="isPendingFavorite"
          @click="handleToggleFavorite"
        >
          <Icon
            icon="icon-[mdi--heart-outline]"
            :class="company.isFavorite ? 'size-4 text-destructive' : 'size-4'"
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
          entity-type="company"
          :entity-id="company.id"
        />
      </template>
    </PageHeader>

    <!-- Main content -->
    <ScrollRegion
      :memory="route.path"
      class="bg-background p-4"
    >
      <CompanyDetailContent />
    </ScrollRegion>

    <!-- Score dialog -->
    <EntityScoreFormDialog
      v-if="scoreDialogOpen"
      v-model:open="scoreDialogOpen"
      entity-type="company"
      :entity-id="company.id"
    />

    <SpoilerConfirmDialog
      v-if="spoilerConfirmOpen"
      v-model:open="spoilerConfirmOpen"
      @confirm="handleRevealSpoilersConfirm"
    />
  </div>
</template>
