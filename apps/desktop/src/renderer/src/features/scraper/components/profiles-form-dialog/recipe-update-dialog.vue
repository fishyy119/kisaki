<!--
  ScraperRecipeUpdateDialog
  Shows the difference between a profile's current configuration and the
  current recipe recommendation, slot by slot, and lets the user apply or
  dismiss the suggestion. Purely presentational: the decision is emitted.
-->
<script setup lang="ts">
import type { ScraperProfile } from '@shared/db'

import { computed } from 'vue'
import { useI18n } from '@renderer/composables/use-i18n'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { getScraperSlotsForEntityType } from '@shared/scraper'
import type { MaterializedRecipe, ScraperProviderInfo } from '@renderer/components/shared/scraper'

interface Props {
  profile: ScraperProfile
  recommendation: MaterializedRecipe
  providers: ScraperProviderInfo[]
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  apply: []
  dismiss: []
}>()

const { m } = useI18n()

function providerLabel(providerId: string): string {
  return props.providers.find((provider) => provider.id === providerId)?.name ?? providerId
}

function describeProviders(
  config: { providers: { providerId: string; enabled: boolean; priority: number }[] } | undefined
): string {
  const labels = (config?.providers ?? [])
    .filter((entry) => entry.enabled)
    .sort((left, right) => left.priority - right.priority)
    .map((entry) => providerLabel(entry.providerId))
  return labels.length > 0 ? labels.join(' → ') : m.value.scraper.recipeUpdate.emptySlot
}

interface DiffRow {
  label: string
  before: string
  after: string
}

const diffRows = computed<DiffRow[]>(() => {
  const rows: DiffRow[] = []

  if (props.profile.searchProviderId !== props.recommendation.searchProviderId) {
    rows.push({
      label: m.value.scraper.profiles.searchProviderLabel,
      before: providerLabel(props.profile.searchProviderId),
      after: providerLabel(props.recommendation.searchProviderId)
    })
  }

  for (const slot of getScraperSlotsForEntityType(props.profile.entityType)) {
    const before = describeProviders(props.profile.slotConfigs[slot])
    const after = describeProviders(props.recommendation.slotConfigs[slot])
    if (before !== after) {
      rows.push({ label: m.value.scraper.profiles.slots[slot], before, after })
    }
  }

  return rows
})

function handleDismiss() {
  emit('dismiss')
  open.value = false
}

function handleApply() {
  emit('apply')
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ m.scraper.recipeUpdate.title }}</DialogTitle>
      </DialogHeader>
      <DialogBody class="max-h-[60vh]">
        <p class="text-sm text-muted-foreground mb-3">
          {{ m.scraper.recipeUpdate.hint }}
        </p>
        <div class="space-y-2">
          <div
            v-for="row in diffRows"
            :key="row.label"
            class="rounded-lg border p-2"
          >
            <div class="text-xs font-medium mb-1">{{ row.label }}</div>
            <div class="flex flex-col gap-1 text-xs">
              <div class="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  class="shrink-0 px-1 py-0"
                >
                  {{ m.scraper.recipeUpdate.beforeLabel }}
                </Badge>
                <span class="min-w-0 text-muted-foreground">{{ row.before }}</span>
              </div>
              <div class="flex items-center gap-2">
                <Badge
                  variant="success"
                  class="shrink-0 px-1 py-0"
                >
                  {{ m.scraper.recipeUpdate.afterLabel }}
                </Badge>
                <span class="min-w-0">{{ row.after }}</span>
              </div>
            </div>
          </div>
        </div>
      </DialogBody>
      <DialogFooter class="flex justify-between">
        <Button
          variant="outline"
          @click="handleDismiss"
        >
          {{ m.scraper.recipeUpdate.dismiss }}
        </Button>
        <div class="flex gap-2">
          <Button
            variant="outline"
            @click="open = false"
          >
            {{ m.actions.cancel }}
          </Button>
          <Button @click="handleApply">
            {{ m.scraper.recipeUpdate.apply }}
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
