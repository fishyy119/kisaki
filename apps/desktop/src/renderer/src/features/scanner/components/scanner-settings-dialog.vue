<!--
  ScannerSettingsDialog
  Scanner preferences: ingest mode, parallelism, and the ignored-name list.
  Independent settings, so each applies the moment it changes - the select and
  each list edit write at once, the count commits when the field is left.
  A failed write reverts the control and reports the failure.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { Icon } from '@renderer/components/ui/icon'
import {
  SCANNER_PARALLEL_COUNT_DEFAULT,
  SCANNER_PARALLEL_COUNT_MAX,
  SCANNER_PARALLEL_COUNT_MIN,
  settings,
  type ScannerIngestMode
} from '@shared/db'
import { notify } from '@renderer/core/notify'
import { useLiveQuery, useRenderState } from '@renderer/composables'
import { useI18n } from '@renderer/composables/use-i18n'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody
} from '@renderer/components/ui/dialog'
import { StateView } from '@renderer/components/ui/state-view'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Badge } from '@renderer/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@renderer/components/ui/select'
import {
  Field,
  FieldLabel,
  FieldContent,
  FieldGroup,
  FieldDescription
} from '@renderer/components/ui/field'

const open = defineModel<boolean>('open', { required: true })

const { m } = useI18n()

interface ScannerSettings {
  ignoredNames: string[]
  ingestMode: ScannerIngestMode
  parallelCount: number
}

const scannerIngestModeOptions = computed<
  readonly { value: ScannerIngestMode; label: string; description: string }[]
>(() => [
  {
    value: 'prefer-scraper',
    label: m.value.scanner.settings.ingestPreferScraper,
    description: m.value.scanner.settings.ingestPreferScraperDescription
  },
  {
    value: 'require-scraper',
    label: m.value.scanner.settings.ingestRequireScraper,
    description: m.value.scanner.settings.ingestRequireScraperDescription
  },
  {
    value: 'direct-only',
    label: m.value.scanner.settings.ingestDirectOnly,
    description: m.value.scanner.settings.ingestDirectOnlyDescription
  }
])

// =============================================================================
// Settings row
// =============================================================================

const { data, isLoading, error, reload } = useLiveQuery(
  async (): Promise<ScannerSettings> => {
    const result = await db.query.settings.findFirst()
    if (!result) {
      throw new Error('Settings not found')
    }
    return {
      ignoredNames: [...result.scannerIgnoredNames],
      ingestMode: result.scannerIngestMode,
      parallelCount: result.scannerParallelCount
    }
  },
  { enabled: open }
)
const state = useRenderState(isLoading, error, data)

// Control values mirror the row; a write that fails puts the row value back.
const current = ref<ScannerSettings>({
  ignoredNames: [],
  ingestMode: 'prefer-scraper',
  parallelCount: SCANNER_PARALLEL_COUNT_DEFAULT
})

watch(data, (loaded) => {
  if (loaded) current.value = { ...loaded, ignoredNames: [...loaded.ignoredNames] }
})

async function apply<K extends keyof ScannerSettings>(
  key: K,
  value: ScannerSettings[K],
  patch: Partial<typeof settings.$inferInsert>
): Promise<void> {
  const previous = current.value[key]
  current.value[key] = value
  try {
    await db.update(settings).set(patch).where(eq(settings.id, 0)).run()
  } catch (e) {
    current.value[key] = previous
    notify.error(m.value.feedback.saveFailed, e instanceof Error ? e.message : String(e))
  }
}

const ingestModeModel = computed({
  get: () => current.value.ingestMode,
  set: (value: ScannerIngestMode) => {
    if (value !== current.value.ingestMode) {
      void apply('ingestMode', value, { scannerIngestMode: value })
    }
  }
})

// =============================================================================
// Parallel count: edits stay local until the field is left or Enter is pressed
// =============================================================================

const parallelCountDraft = ref('')

watch(
  () => current.value.parallelCount,
  (count) => {
    parallelCountDraft.value = String(count)
  },
  { immediate: true }
)

function commitParallelCount(): void {
  const parsed = parseInt(parallelCountDraft.value, 10)
  const count = Number.isNaN(parsed)
    ? SCANNER_PARALLEL_COUNT_DEFAULT
    : Math.max(SCANNER_PARALLEL_COUNT_MIN, Math.min(SCANNER_PARALLEL_COUNT_MAX, parsed))
  parallelCountDraft.value = String(count)
  if (count !== current.value.parallelCount) {
    void apply('parallelCount', count, { scannerParallelCount: count })
  }
}

// =============================================================================
// Ignored names: each add and remove is a write
// =============================================================================

const newIgnoredName = ref('')

function handleAddIgnoredName(): void {
  const trimmedName = newIgnoredName.value.trim()
  if (!trimmedName || current.value.ignoredNames.includes(trimmedName)) return
  const next = [...current.value.ignoredNames, trimmedName]
  newIgnoredName.value = ''
  void apply('ignoredNames', next, { scannerIgnoredNames: next })
}

function handleRemoveIgnoredName(name: string): void {
  const next = current.value.ignoredNames.filter((n) => n !== name)
  void apply('ignoredNames', next, { scannerIgnoredNames: next })
}

function handleIgnoredNameKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Enter') {
    e.preventDefault()
    handleAddIgnoredName()
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent size="md">
      <DialogHeader>
        <DialogTitle>{{ m.scanner.settings.title }}</DialogTitle>
      </DialogHeader>

      <DialogBody v-if="state === 'loading'">
        <StateView
          state="loading"
          class="py-8"
        />
      </DialogBody>

      <DialogBody
        v-else-if="state === 'error'"
        class="space-y-3"
      >
        <p class="text-sm text-destructive wrap-break-word">
          {{ error }}
        </p>
        <div class="flex justify-end">
          <Button
            type="button"
            variant="outline"
            @click="reload"
          >
            {{ m.actions.retry }}
          </Button>
        </div>
      </DialogBody>

      <DialogBody
        v-else
        class="py-4"
      >
        <FieldGroup>
          <Field orientation="horizontal">
            <FieldLabel>{{ m.scanner.settings.ingestMode }}</FieldLabel>
            <FieldDescription>{{ m.scanner.settings.ingestModeDescription }}</FieldDescription>
            <FieldContent>
              <Select v-model="ingestModeModel">
                <SelectTrigger class="w-32">
                  <span class="truncate">
                    {{
                      scannerIngestModeOptions.find((option) => option.value === ingestModeModel)
                        ?.label ?? ingestModeModel
                    }}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="option in scannerIngestModeOptions"
                    :key="option.value"
                    :value="option.value"
                    :description="option.description"
                  >
                    {{ option.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FieldContent>
          </Field>

          <Field orientation="horizontal">
            <FieldLabel>{{ m.scanner.settings.parallelCount }}</FieldLabel>
            <FieldDescription>
              {{ m.scanner.settings.parallelCountDescription }}
            </FieldDescription>
            <FieldContent>
              <Input
                v-model="parallelCountDraft"
                type="number"
                inputmode="numeric"
                :min="SCANNER_PARALLEL_COUNT_MIN"
                :max="SCANNER_PARALLEL_COUNT_MAX"
                step="1"
                class="w-24"
                @blur="commitParallelCount"
                @keydown.enter.prevent="commitParallelCount"
              />
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel>{{ m.scanner.settings.ignoredNames }}</FieldLabel>
            <FieldDescription>{{ m.scanner.settings.ignoredNamesDescription }}</FieldDescription>
            <FieldContent>
              <div class="flex gap-2">
                <Input
                  v-model="newIgnoredName"
                  :placeholder="m.scanner.settings.ignoredNamePlaceholder"
                  class="flex-1"
                  @keydown="handleIgnoredNameKeyDown"
                />
                <Button
                  type="button"
                  variant="secondary"
                  :disabled="!newIgnoredName.trim()"
                  @click="handleAddIgnoredName"
                >
                  <Icon
                    icon="icon-[mdi--plus]"
                    class="size-4"
                  />
                  {{ m.actions.add }}
                </Button>
              </div>

              <div
                v-if="current.ignoredNames.length > 0"
                class="flex flex-wrap gap-1.5 mt-1.5 max-h-32 overflow-auto pr-1"
              >
                <Badge
                  v-for="name in current.ignoredNames"
                  :key="name"
                  variant="secondary"
                  class="pr-0.5"
                  :title="name"
                >
                  <span class="truncate max-w-44">{{ name }}</span>
                  <Button
                    size="icon-xs"
                    variant="text"
                    type="button"
                    @click="handleRemoveIgnoredName(name)"
                  >
                    <Icon
                      icon="icon-[mdi--close]"
                      class="size-3"
                    />
                  </Button>
                </Badge>
              </div>

              <p
                v-else
                class="text-xs text-muted-foreground mt-2"
              >
                {{ m.scanner.settings.noIgnoredNames }}
              </p>
            </FieldContent>
          </Field>
        </FieldGroup>
      </DialogBody>
    </DialogContent>
  </Dialog>
</template>
