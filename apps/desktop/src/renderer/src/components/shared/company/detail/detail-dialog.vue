<!--
  CompanyDetailDialog
  Dialog view for company details.
-->
<script setup lang="ts">
import { ref, watch } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { eq } from 'drizzle-orm'
import { notify } from '@renderer/core/notify'
import { db } from '@renderer/core/db'
import { companies } from '@shared/db'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { StateView } from '@renderer/components/ui/state-view'
import { Button } from '@renderer/components/ui/button'
import { Separator } from '@renderer/components/ui/separator'
import { SpoilerConfirmDialog } from '@renderer/components/ui/spoiler-confirm-dialog'
import { getEntityIcon } from '@renderer/utils/format'
import { useCompanyProvider, useEvent, useRenderState } from '@renderer/composables'
import CompanyDetailContent from './detail-content.vue'
import { CompanyScoreFormDialog } from '../forms'
import { CompanyDropdownMenu } from '../menus'

interface Props {
  companyId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

// =============================================================================
// Spoiler State
// =============================================================================

const spoilersRevealed = ref(false)
const spoilerConfirmOpen = ref(false)

watch(open, (isOpen) => {
  if (isOpen) return
  spoilersRevealed.value = false
  spoilerConfirmOpen.value = false
})

const { company, isLoading, error } = useCompanyProvider(() => props.companyId, spoilersRevealed)
const state = useRenderState(isLoading, error, company)

useEvent('db.deleted', ({ table, id }) => {
  if (table === 'companies' && id === props.companyId) {
    open.value = false
  }
})

const isScoreOpen = ref(false)
const isPendingFavorite = ref(false)

async function handleToggleFavorite() {
  if (state.value !== 'success' || isPendingFavorite.value) return
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
  <Dialog v-model:open="open">
    <DialogContent class="max-w-4xl max-h-[90vh] flex flex-col">
      <!-- Loading / Error / Not Found -->
      <template v-if="state !== 'success'">
        <DialogBody>
          <StateView
            :state="state"
            :error="error"
            :icon="getEntityIcon('company')"
            title="公司不存在"
            description="该公司可能已被删除"
            class="py-12"
          />
        </DialogBody>
      </template>

      <!-- Content -->
      <template v-else-if="company">
        <DialogHeader>
          <DialogTitle>{{ company.name }}</DialogTitle>
        </DialogHeader>
        <DialogBody class="flex-1 min-h-0 overflow-auto p-4">
          <CompanyDetailContent />
        </DialogBody>
        <DialogFooter>
          <div class="flex items-center justify-end w-full">
            <!-- Right: Score, Favorite, More -->
            <div class="flex items-center gap-1.5">
              <Button
                variant="secondary"
                :size="company!.score !== null ? 'sm' : 'icon-sm'"
                :class="company!.score !== null ? 'text-warning' : ''"
                tooltip="评分"
                @click="isScoreOpen = true"
              >
                <Icon
                  icon="icon-[mdi--starburst-outline]"
                  class="size-4"
                />
                <span
                  v-if="company!.score !== null"
                  class="text-xs"
                >
                  {{ (company!.score / 10).toFixed(1) }}
                </span>
              </Button>

              <Separator
                orientation="vertical"
                class="h-4"
              />

              <Button
                variant="secondary"
                size="icon-sm"
                :tooltip="company!.isFavorite ? '取消喜欢' : '添加喜欢'"
                :disabled="isPendingFavorite"
                @click="handleToggleFavorite"
              >
                <Icon
                  icon="icon-[mdi--heart-outline]"
                  class="size-4"
                  :class="company!.isFavorite ? 'fill-destructive text-destructive' : ''"
                />
              </Button>

              <Button
                variant="secondary"
                size="icon-sm"
                :tooltip="spoilersRevealed ? '隐藏剧透' : '显示剧透'"
                @click="handleToggleSpoilers"
              >
                <Icon
                  :icon="
                    spoilersRevealed ? 'icon-[mdi--eye-outline]' : 'icon-[mdi--eye-off-outline]'
                  "
                  class="size-4"
                />
              </Button>

              <Separator
                orientation="vertical"
                class="h-4"
              />

              <!-- More menu -->
              <CompanyDropdownMenu :company-id="company!.id" />
            </div>
          </div>
        </DialogFooter>

        <!-- Score Dialog -->
        <CompanyScoreFormDialog
          v-if="isScoreOpen"
          v-model:open="isScoreOpen"
          :company-id="company!.id"
        />

        <SpoilerConfirmDialog
          v-if="spoilerConfirmOpen"
          v-model:open="spoilerConfirmOpen"
          @confirm="handleRevealSpoilersConfirm"
        />
      </template>
    </DialogContent>
  </Dialog>
</template>
