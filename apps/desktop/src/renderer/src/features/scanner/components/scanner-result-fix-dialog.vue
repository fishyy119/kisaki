<!--
  ScannerResultFixDialog
  Re-runs ingest for one scanner issue after the user picks the right entry by
  hand: an issue that already resolved to an entry updates it, otherwise the
  scanned directory is added afresh. The searcher and the ingest call are
  chosen by the issue's media type.
-->
<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { ipcManager, unwrapIpcData } from '@renderer/core/ipc'
import { notify } from '@renderer/core/notify'
import { useAsyncData } from '@renderer/composables'
import { useI18n } from '@renderer/composables/use-i18n'
import type { EntitySearcherSelection } from '@renderer/components/shared/entity'
import { AnimeSearcher } from '@renderer/components/shared/anime'
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
import {
  ANIME_UPDATE_SURFACE_KEYS,
  GAME_UPDATE_SURFACE_KEYS,
  type AnimeUpdateRequest,
  type GameUpdateRequest
} from '@shared/ingest/update'
import type { AnimeScraperLookup, GameScraperLookup, ScraperLookup } from '@shared/scraper'
import { assertNever } from '@shared/utils/exhaustive'
import type { ScannerFixTarget } from './scanner-problem'

interface Props {
  problem: ScannerFixTarget
}

const props = defineProps<Props>()
const open = defineModel<boolean>('open', { required: true })

const { m } = useI18n()

/**
 * The chosen entry, tagged with the media type that produced it.
 *
 * The tag travels with the selection rather than being read back off the
 * issue, which is what keeps each lookup paired with the ingest call that
 * accepts it.
 */
type FixSelection =
  | { mediaType: 'game'; selection: EntitySearcherSelection<GameScraperLookup> }
  | { mediaType: 'anime'; selection: EntitySearcherSelection<AnimeScraperLookup> }

const isSubmitting = ref(false)
const selection = shallowRef<FixSelection | null>(null)

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
  isUpdateMode.value ? m.value.scanner.fix.updateExisting : m.value.scanner.fix.readd
)
const canSubmit = computed(() => !!selection.value?.selection.canSubmit && !isSubmitting.value)

const targetCollectionId = computed(() => scanner.value?.targetCollectionId || undefined)

/** The scanned name is the better fallback here, so it replaces an empty one. */
function resolveLookup<TLookup extends ScraperLookup>(lookup: TLookup): TLookup {
  return { ...lookup, name: lookup.name || props.problem.extractedName.trim() }
}

async function submitGame(chosen: EntitySearcherSelection<GameScraperLookup>): Promise<void> {
  const lookup = resolveLookup(chosen.lookup)
  const entityId = props.problem.entityId

  if (entityId) {
    const request: GameUpdateRequest = {
      rootId: entityId,
      profileId: chosen.profileId,
      lookup,
      selection: { surfaces: [...GAME_UPDATE_SURFACE_KEYS] },
      policy: { singularUpdate: 'overwrite', collectionUpdate: 'replace' }
    }
    await ipcManager.invoke('ingest:update-game-from-scraper', request).then(unwrapIpcData)
    return
  }

  await ipcManager
    .invoke('ingest:add-game-from-scraper', chosen.profileId, lookup, {
      gameDirPath: props.problem.path,
      targetCollectionId: targetCollectionId.value
    })
    .then(unwrapIpcData)
}

async function submitAnime(chosen: EntitySearcherSelection<AnimeScraperLookup>): Promise<void> {
  const lookup = resolveLookup(chosen.lookup)
  const entityId = props.problem.entityId

  if (entityId) {
    const request: AnimeUpdateRequest = {
      rootId: entityId,
      profileId: chosen.profileId,
      lookup,
      selection: { surfaces: [...ANIME_UPDATE_SURFACE_KEYS] },
      policy: { singularUpdate: 'overwrite', collectionUpdate: 'replace' }
    }
    await ipcManager.invoke('ingest:update-anime-from-scraper', request).then(unwrapIpcData)
    return
  }

  await ipcManager
    .invoke('ingest:add-anime-from-scraper', chosen.profileId, lookup, {
      animeDirPath: props.problem.path,
      targetCollectionId: targetCollectionId.value
    })
    .then(unwrapIpcData)
}

function startIngest(chosen: FixSelection): Promise<void> {
  switch (chosen.mediaType) {
    case 'game':
      return submitGame(chosen.selection)
    case 'anime':
      return submitAnime(chosen.selection)
    default:
      return assertNever(chosen, 'scanner fix media type')
  }
}

async function handleSubmit() {
  const chosen = selection.value
  if (!canSubmit.value || !chosen) return

  isSubmitting.value = true

  try {
    await startIngest(chosen)

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
    selection.value = null
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
            v-if="props.problem.mediaType === 'game'"
            :default-profile-id="defaultProfileId"
            :default-search-query="defaultSearchQuery"
            :is-submitting="isSubmitting"
            @selection-change="selection = { mediaType: 'game', selection: $event }"
          />
          <AnimeSearcher
            v-else
            :default-profile-id="defaultProfileId"
            :default-search-query="defaultSearchQuery"
            :is-submitting="isSubmitting"
            @selection-change="selection = { mediaType: 'anime', selection: $event }"
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
