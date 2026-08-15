<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { ipcManager, unwrapIpcData } from '@renderer/core/ipc'
import { notify } from '@renderer/core/notify'
import { useAsyncData } from '@renderer/composables'
import { useI18n } from '@renderer/composables/use-i18n'
import type { EntitySearcherSelection } from '@renderer/components/shared/entity'
import { GameSearcher } from '@renderer/components/shared/game'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import { Form } from '@renderer/components/ui/form'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { scanners as scannersTable } from '@shared/db'
import { GAME_UPDATE_SURFACE_KEYS, type GameUpdateRequest } from '@shared/ingest/update'
import type { GameScraperLookup } from '@shared/scraper'
import type { ScannerFixTarget } from './scanner-problem'

interface Props {
  problem: ScannerFixTarget
}

const props = defineProps<Props>()
const open = defineModel<boolean>('open', { required: true })

const { m } = useI18n()

const isSubmitting = ref(false)
type GameSelection = EntitySearcherSelection<GameScraperLookup>

const selection = shallowRef<GameSelection>(createEmptySelection())

const { data: scanner } = useAsyncData(
  async () => {
    if (!props.problem.scannerId) return null
    const row = await db.query.scanners.findFirst({
      where: eq(scannersTable.id, props.problem.scannerId)
    })
    return row ?? null
  },
  {
    watch: [() => props.problem.scannerId],
    enabled: () => open.value
  }
)

const defaultSearchQuery = computed(() => props.problem.extractedName)
const defaultProfileId = computed(() => scanner.value?.scraperProfileId ?? '')
const isUpdateMode = computed(() => !!props.problem.entityId)
const actionText = computed(() =>
  isUpdateMode.value ? m.value.scanner.fix.updateExisting : m.value.scanner.fix.readdGame
)
const canSubmit = computed(() => selection.value.canSubmit && !isSubmitting.value)

function createEmptySelection(): GameSelection {
  return {
    profileId: '',
    lookup: { name: '', knownIds: [] },
    canSubmit: false
  }
}

function handleSelectionChange(next: GameSelection) {
  selection.value = next
}

/** The scanned name is the better fallback here, so it replaces an empty one. */
function resolveLookup(): GameScraperLookup {
  const lookup = selection.value.lookup
  return { ...lookup, name: lookup.name || props.problem.extractedName.trim() }
}

async function startUpdateFromScraper() {
  if (!props.problem.entityId) return

  const request: GameUpdateRequest = {
    rootId: props.problem.entityId,
    profileId: selection.value.profileId,
    lookup: resolveLookup(),
    selection: {
      surfaces: [...GAME_UPDATE_SURFACE_KEYS]
    },
    policy: {
      singularUpdate: 'overwrite',
      collectionUpdate: 'replace'
    }
  }

  await ipcManager.invoke('ingest:update-game-from-scraper', request).then(unwrapIpcData)
}

async function startAddFromScraper() {
  await ipcManager
    .invoke('ingest:add-game-from-scraper', selection.value.profileId, resolveLookup(), {
      gameDirPath: props.problem.path,
      targetCollectionId: scanner.value?.targetCollectionId || undefined
    })
    .then(unwrapIpcData)
}

async function handleSubmit() {
  if (!canSubmit.value) return

  isSubmitting.value = true

  try {
    if (isUpdateMode.value) {
      await startUpdateFromScraper()
    } else {
      await startAddFromScraper()
    }

    notify.success(m.value.scanner.fix.started)
    open.value = false
  } catch (error) {
    notify.error(
      m.value.scanner.fix.startFailed,
      error instanceof Error ? error.message : m.value.scanner.fix.unknownError
    )
  } finally {
    isSubmitting.value = false
  }
}

watch(
  () => open.value,
  (isOpen) => {
    if (!isOpen) return
    isSubmitting.value = false
    selection.value = createEmptySelection()
  },
  { immediate: true }
)
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-3xl">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Icon
            icon="icon-[mdi--database-search-outline]"
            class="size-4"
          />
          {{ m.scanner.fix.title }}
        </DialogTitle>
        <DialogDescription class="truncate">
          {{ actionText }} · {{ props.problem.extractedName }}
        </DialogDescription>
      </DialogHeader>

      <Form @submit="handleSubmit">
        <DialogBody class="space-y-3 max-h-[70vh] overflow-y-auto">
          <div class="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs">
            <div class="flex items-center gap-2 min-w-0">
              <Icon
                icon="icon-[mdi--folder-open-outline]"
                class="size-4 shrink-0 text-muted-foreground"
              />
              <span class="truncate font-medium">{{ props.problem.extractedName }}</span>
            </div>
            <div
              class="mt-1 truncate text-muted-foreground"
              :title="props.problem.path"
            >
              {{ props.problem.path }}
            </div>
          </div>

          <GameSearcher
            :default-profile-id="defaultProfileId"
            :default-search-query="defaultSearchQuery"
            :is-submitting="isSubmitting"
            @selection-change="handleSelectionChange"
          />
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            :disabled="isSubmitting"
            @click="open = false"
          >
            {{ m.common.cancel }}
          </Button>
          <Button
            type="submit"
            :disabled="!canSubmit"
          >
            <Icon
              v-if="isSubmitting"
              icon="icon-[mdi--loading]"
              class="size-4 animate-spin"
            />
            <Icon
              v-else
              icon="icon-[mdi--refresh]"
              class="size-4"
            />
            {{ m.scanner.fix.rescrape }}
          </Button>
        </DialogFooter>
      </Form>
    </DialogContent>
  </Dialog>
</template>
