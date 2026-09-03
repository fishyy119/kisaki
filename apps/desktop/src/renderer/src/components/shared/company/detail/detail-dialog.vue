<!--
  CompanyDetailDialog
  Dialog view for company details.
-->
<script setup lang="ts">
import { ref } from 'vue'
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
import { useCompanyDialogProvider, useDbChanges, useRenderState } from '@renderer/composables'
import CompanyDetailContent from './detail-content.vue'
import { EntityScoreFormDialog, EntityDropdownMenu } from '@renderer/components/shared/entity'
import { useI18n } from '@renderer/composables'

const { m } = useI18n()

interface Props {
  entityId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const {
  company,
  isLoading,
  error,
  params: { spoilersRevealed }
} = useCompanyDialogProvider(() => props.entityId)
const state = useRenderState(isLoading, error, company)

const spoilerConfirmOpen = ref(false)

useDbChanges(({ changes }) => {
  const deleted = changes.some(
    (change) =>
      change.operation === 'deleted' && change.table === 'companies' && change.id === props.entityId
  )
  if (deleted) open.value = false
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
  <Dialog v-model:open="open">
    <DialogContent
      size="xl"
      fill
    >
      <!-- Loading / Error / Not Found -->
      <template v-if="state !== 'success'">
        <DialogBody>
          <StateView
            :state="state"
            :error="error"
            :icon="getEntityIcon('company')"
            :title="m.library.detail.notFoundTitle({ label: m.library.entities.company })"
            :description="
              m.library.detail.notFoundDescription({ label: m.library.entities.company })
            "
            class="h-full"
          />
        </DialogBody>
      </template>

      <!-- Content -->
      <template v-else-if="company">
        <DialogHeader>
          <DialogTitle :icon="getEntityIcon('company')">
            {{ company.name }}
          </DialogTitle>
        </DialogHeader>
        <DialogBody class="p-4">
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
                :tooltip="m.library.detail.tooltips.score"
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
                :tooltip="
                  company!.isFavorite
                    ? m.library.detail.tooltips.favoriteRemove
                    : m.library.detail.tooltips.favoriteAdd
                "
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
                :tooltip="
                  spoilersRevealed
                    ? m.library.detail.tooltips.spoilerHide
                    : m.library.detail.tooltips.spoilerShow
                "
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
              <EntityDropdownMenu
                entity-type="company"
                :entity-id="company!.id"
              />
            </div>
          </div>
        </DialogFooter>

        <!-- Score Dialog -->
        <EntityScoreFormDialog
          v-if="isScoreOpen"
          v-model:open="isScoreOpen"
          entity-type="company"
          :entity-id="company!.id"
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
