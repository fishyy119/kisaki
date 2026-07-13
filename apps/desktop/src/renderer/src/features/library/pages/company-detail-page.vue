<script setup lang="ts">
/**
 * Company Detail Page
 *
 * Full page view for company detail, used by routing.
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
  CompanyScoreFormDialog,
  CompanyDropdownMenu,
  CompanyDetailContent
} from '@renderer/components/shared/company'
import { useCompanyProvider, useEvent, useRenderState } from '@renderer/composables'
import { db } from '@renderer/core/db'
import { notify } from '@renderer/core/notify'
import { companies } from '@shared/db'
import { getEntityIcon } from '@renderer/utils/format'

// =============================================================================
// Route & Navigation
// =============================================================================

const route = useRoute()
const router = useRouter()

const companyId = computed(() => route.params.companyId as string | undefined)
const backTo = computed(() => (route.query.from as string) || '/library')

// Redirect if no companyId
if (!companyId.value) {
  router.push(backTo.value)
}

// =============================================================================
// Spoiler State
// =============================================================================

const spoilersRevealed = ref(false)
const spoilerConfirmOpen = ref(false)

watch(companyId, () => {
  spoilersRevealed.value = false
  spoilerConfirmOpen.value = false
})

// =============================================================================
// Provider
// =============================================================================

const { company, isLoading, error } = useCompanyProvider(
  () => companyId.value ?? '',
  spoilersRevealed
)
const state = useRenderState(isLoading, error, company)

useEvent('db.deleted', ({ table, id }) => {
  if (table === 'companies' && id === companyId.value) {
    router.push(backTo.value)
  }
})

useEvent('entity.merged', (event) => {
  if (event.entityType === 'company' && event.sourceId === companyId.value) {
    router.replace({ path: `/library/company/${event.targetId}`, query: route.query })
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
  const current = company.value!
  isPendingFavorite.value = true
  try {
    await db
      .update(companies)
      .set({ isFavorite: !current.isFavorite })
      .where(eq(companies.id, current.id))
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
    :icon="getEntityIcon('company')"
    title="公司不存在"
    class="h-full"
  />

  <!-- Content -->
  <div
    v-else-if="company"
    class="h-full flex flex-col"
  >
    <!-- Header -->
    <PageHeader back-to="/library">
      <h1 class="text-base font-semibold truncate">{{ company.name }}</h1>

      <template #actions>
        <Button
          variant="secondary"
          :size="company.score !== null ? 'sm' : 'icon-sm'"
          class="flex items-center py-0"
          :class="[company.score !== null && 'text-warning']"
          tooltip="评分"
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
          :tooltip="company.isFavorite ? '取消喜欢' : '添加喜欢'"
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
        <CompanyDropdownMenu :company-id="company.id" />
      </template>
    </PageHeader>

    <!-- Main content -->
    <div class="flex-1 overflow-auto p-4">
      <CompanyDetailContent />
    </div>

    <!-- Score dialog -->
    <CompanyScoreFormDialog
      v-if="scoreDialogOpen"
      v-model:open="scoreDialogOpen"
      :company-id="company.id"
    />

    <SpoilerConfirmDialog
      v-if="spoilerConfirmOpen"
      v-model:open="spoilerConfirmOpen"
      @confirm="handleRevealSpoilersConfirm"
    />
  </div>
</template>
