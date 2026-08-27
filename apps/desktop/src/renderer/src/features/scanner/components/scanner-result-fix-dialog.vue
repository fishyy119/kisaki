<!--
  ScannerResultFixDialog
  Re-runs ingest for one scanner issue after the user picks the right entry by
  hand: an issue that already resolved to an entry updates it, otherwise the
  scanned directory is added afresh. Both paths are media-neutral — the update
  request builds on METADATA_UPDATE_SPECS and the re-add submit comes from
  SCANNER_FIX_ADD_SPECS — so every scanned media type shares this one dialog.
-->
<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { notify } from '@renderer/core/notify'
import { useAsyncData } from '@renderer/composables'
import { useI18n } from '@renderer/composables/use-i18n'
import {
  EntitySearcher,
  METADATA_UPDATE_SPECS,
  type EntitySearcherSelection
} from '@renderer/components/shared/entity'
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
import type { ScraperLookup } from '@shared/scraper'
import { SCANNER_FIX_ADD_SPECS } from './fix-specs'
import type { ScannerFixTarget } from './scanner-issue'

interface Props {
  problem: ScannerFixTarget
}

const props = defineProps<Props>()
const open = defineModel<boolean>('open', { required: true })

const { m } = useI18n()

const isSubmitting = ref(false)
const selection = shallowRef<EntitySearcherSelection<ScraperLookup> | null>(null)

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
const canSubmit = computed(() => !!selection.value?.canSubmit && !isSubmitting.value)

const targetCollectionId = computed(() => scanner.value?.targetCollectionId || undefined)

/** The scanned name is the better fallback here, so it replaces an empty one. */
function resolveLookup(lookup: ScraperLookup): ScraperLookup {
  return { ...lookup, name: lookup.name || props.problem.extractedName.trim() }
}

async function startIngest(chosen: EntitySearcherSelection<ScraperLookup>): Promise<void> {
  const mediaType = props.problem.mediaType
  const lookup = resolveLookup(chosen.lookup)
  const entityId = props.problem.entityId

  if (entityId) {
    const spec = METADATA_UPDATE_SPECS[mediaType]
    const outcome = await spec.submit({
      rootId: entityId,
      profileId: chosen.profileId,
      lookup,
      selection: { surfaces: [...spec.surfaceKeys] },
      policy: { singularUpdate: 'overwrite', collectionUpdate: 'replace' }
    })
    if (!outcome.success) {
      throw new Error(outcome.error ?? m.value.scanner.fix.unknownError)
    }
    return
  }

  await SCANNER_FIX_ADD_SPECS[mediaType](chosen.profileId, lookup, {
    dirPath: props.problem.path,
    targetCollectionId: targetCollectionId.value
  })
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

          <EntitySearcher
            :entity-type="props.problem.mediaType"
            :default-profile-id="defaultProfileId"
            :default-search-query="defaultSearchQuery"
            :is-submitting="isSubmitting"
            @selection-change="selection = $event"
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
