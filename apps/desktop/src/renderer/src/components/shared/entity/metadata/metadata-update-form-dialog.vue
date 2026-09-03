<!--
  EntityMetadataUpdateFormDialog
  Update an entity's metadata from scraper results through the main-process
  ingest service; entity differences arrive via the update spec registry.
-->
<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { db, ENTITY_TABLES } from '@renderer/core/db'
import { notify } from '@renderer/core/notify'
import { useLiveQuery } from '@renderer/composables'
import type { ExternalId } from '@shared/identity'
import {
  mergeUpdateLookupKnownIds,
  type IngestUpdatePolicy,
  type IngestUpdateRequest
} from '@shared/ingest/update'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { Checkbox } from '@renderer/components/ui/checkbox'
import { Label } from '@renderer/components/ui/label'
import { StateView } from '@renderer/components/ui/state-view'
import { Form } from '@renderer/components/ui/form'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import {
  Field,
  FieldLabel,
  FieldContent,
  FieldGroup,
  FieldDescription
} from '@renderer/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { useI18n } from '@renderer/composables/use-i18n'
import { EntitySearcher, type EntitySearcherSelection } from '../searcher'
import type { ContentEntityType } from '@shared/entity-types'
import { IDENTITY_STORES } from '../identities/identity-tables'
import { METADATA_UPDATE_SPECS } from './update-specs'

const { m } = useI18n()

interface Props {
  entityType: ContentEntityType
  entityId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const spec = computed(() => METADATA_UPDATE_SPECS[props.entityType])
const table = computed(() => ENTITY_TABLES[props.entityType].table)
const surfaceLabels = computed(() => spec.value.surfaceLabels(m.value))

const isSubmitting = ref(false)

function createEmptySelection(): EntitySearcherSelection {
  return { profileId: '', lookup: { name: '', knownIds: [] }, canSubmit: false }
}

const selection = shallowRef<EntitySearcherSelection>(createEmptySelection())

const singularUpdate = ref<IngestUpdatePolicy['singularUpdate']>('overwrite')
const collectionUpdate = ref<IngestUpdatePolicy['collectionUpdate']>('replace')
const selectedSurfaces = ref<string[]>([...spec.value.surfaceKeys])
const useCurrentExternalIdsAsKnownIds = ref(true)

const { data, isLoading } = useLiveQuery(
  async () => {
    const rows = await db
      .select({ name: table.value.name, originalName: table.value.originalName })
      .from(table.value)
      .where(eq(table.value.id, props.entityId))
      .limit(1)
    const entry = rows[0]
    if (!entry) return null

    const idRows = await IDENTITY_STORES[props.entityType].list(props.entityId)
    const externalIds: ExternalId[] = idRows.map((row) => ({
      source: row.source,
      id: row.externalId
    }))

    return { entry, externalIds }
  },
  {
    watch: [() => props.entityId],
    enabled: () => open.value
  }
)

const defaultSearchQuery = computed(() => {
  const entry = data.value?.entry
  if (!entry) return ''
  return entry.originalName || entry.name || ''
})

const canSubmit = computed(() => {
  return !!selection.value.profileId && selectedSurfaces.value.length > 0 && !isSubmitting.value
})

function handleSelectionChange(next: EntitySearcherSelection) {
  selection.value = next
}

function toggleSurface(surface: string, nextValue: boolean) {
  const current = selectedSurfaces.value
  if (nextValue) {
    if (!current.includes(surface)) selectedSurfaces.value = [...current, surface]
    return
  }
  selectedSurfaces.value = current.filter((item) => item !== surface)
}

function handleSelectAllSurfaces() {
  selectedSurfaces.value = [...spec.value.surfaceKeys]
}

function handleSelectNoSurfaces() {
  selectedSurfaces.value = []
}

watch(
  () => open.value,
  (isOpen) => {
    if (!isOpen) return
    isSubmitting.value = false
    selection.value = createEmptySelection()
    singularUpdate.value = 'overwrite'
    collectionUpdate.value = 'replace'
    selectedSurfaces.value = [...spec.value.surfaceKeys]
    useCurrentExternalIdsAsKnownIds.value = true
  }
)

async function handleSubmit() {
  if (!data.value?.entry) return
  if (!selection.value.profileId) return
  if (selectedSurfaces.value.length === 0) return

  const { profileId, lookup } = selection.value
  const storedKnownIds = useCurrentExternalIdsAsKnownIds.value ? data.value.externalIds : undefined

  const request: IngestUpdateRequest<string> = {
    rootId: props.entityId,
    profileId,
    lookup: {
      ...lookup,
      // The searcher only knows the query; the entry's own name is the better
      // fallback when nothing is picked.
      name: lookup.name || data.value.entry.originalName || data.value.entry.name,
      knownIds: mergeUpdateLookupKnownIds(lookup.knownIds, storedKnownIds)
    },
    selection: {
      surfaces: [...selectedSurfaces.value]
    },
    policy: {
      singularUpdate: singularUpdate.value,
      collectionUpdate: collectionUpdate.value
    }
  }

  open.value = false
  isSubmitting.value = true

  try {
    const result = await spec.value.submit(request)
    if (!result.success) {
      notify.error(m.value.library.forms.startUpdateFailed, result.error)
      return
    }
  } catch (error) {
    notify.error(
      m.value.library.forms.startUpdateFailed,
      error instanceof Error ? error.message : m.value.library.feedback.unknownError
    )
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent size="lg">
      <template v-if="isLoading || !data">
        <DialogBody>
          <StateView
            state="loading"
            class="py-10"
          />
        </DialogBody>
      </template>

      <template v-else>
        <DialogHeader>
          <DialogTitle icon="icon-[mdi--database-sync-outline]">
            {{ m.library.forms.updateMetadataTitle }}
          </DialogTitle>
        </DialogHeader>

        <Form @submit="handleSubmit">
          <DialogBody class="space-y-4">
            <EntitySearcher
              :entity-type="props.entityType"
              :default-search-query="defaultSearchQuery"
              :is-submitting="isSubmitting"
              @selection-change="handleSelectionChange"
            />

            <FieldGroup>
              <Field>
                <FieldLabel>{{ m.library.forms.updateFieldsLabel }}</FieldLabel>
                <FieldContent>
                  <div class="flex items-center gap-2 pb-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      :disabled="isSubmitting"
                      @click="handleSelectAllSurfaces"
                    >
                      {{ m.library.forms.selectAll }}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      :disabled="isSubmitting"
                      @click="handleSelectNoSurfaces"
                    >
                      {{ m.library.forms.selectNone }}
                    </Button>
                  </div>

                  <div class="grid grid-cols-2 gap-x-6 gap-y-2">
                    <div
                      v-for="surface in spec.surfaceKeys"
                      :key="surface"
                      class="flex items-center gap-2"
                    >
                      <Checkbox
                        :id="`core-surface-${surface}`"
                        :model-value="selectedSurfaces.includes(surface)"
                        :disabled="isSubmitting"
                        @update:model-value="(value) => toggleSurface(surface, !!value)"
                      />
                      <Label
                        :for="`core-surface-${surface}`"
                        class="text-sm font-normal cursor-pointer"
                      >
                        {{ surfaceLabels[surface] }}
                      </Label>
                    </div>
                  </div>
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel>{{ m.library.forms.scalarStrategyLabel }}</FieldLabel>
                <FieldContent>
                  <Select
                    v-model="singularUpdate"
                    :disabled="isSubmitting"
                  >
                    <SelectTrigger class="w-full">
                      <SelectValue :placeholder="m.library.forms.scalarStrategyPlaceholder" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ifMissing">{{
                        m.library.forms.scalarStrategyIfMissing
                      }}</SelectItem>
                      <SelectItem value="overwrite">{{
                        m.library.forms.scalarStrategyOverwrite
                      }}</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldContent>
                <FieldDescription>
                  {{
                    singularUpdate === 'ifMissing'
                      ? m.library.forms.scalarStrategyIfMissingHint
                      : m.library.forms.scalarStrategyOverwriteHint
                  }}
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel>{{ m.library.forms.collectionStrategyLabel }}</FieldLabel>
                <FieldContent>
                  <Select
                    v-model="collectionUpdate"
                    :disabled="isSubmitting"
                  >
                    <SelectTrigger class="w-full">
                      <SelectValue :placeholder="m.library.forms.collectionStrategyPlaceholder" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="merge">{{
                        m.library.forms.collectionStrategyMerge
                      }}</SelectItem>
                      <SelectItem value="replace">{{
                        m.library.forms.collectionStrategyReplace
                      }}</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldContent>
                <FieldDescription>
                  {{
                    collectionUpdate === 'merge'
                      ? m.library.forms.collectionStrategyMergeHint
                      : m.library.forms.collectionStrategyReplaceHint
                  }}
                </FieldDescription>
              </Field>

              <Field orientation="horizontal">
                <FieldLabel>{{ m.library.forms.useExternalIdsLabel }}</FieldLabel>
                <FieldContent>
                  <Checkbox
                    id="use-current-external-ids"
                    v-model="useCurrentExternalIdsAsKnownIds"
                    :disabled="isSubmitting"
                  />
                </FieldContent>
                <FieldDescription>{{ m.library.forms.useExternalIdsHint }}</FieldDescription>
              </Field>
            </FieldGroup>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              :disabled="isSubmitting"
              @click="open = false"
            >
              {{ m.actions.cancel }}
            </Button>
            <Button
              type="submit"
              :disabled="!canSubmit"
            >
              <template v-if="isSubmitting">
                <Icon
                  icon="icon-[mdi--loading]"
                  class="size-4 animate-spin"
                />
                {{ m.library.forms.updating }}
              </template>
              <template v-else>
                <Icon
                  icon="icon-[mdi--refresh]"
                  class="size-4"
                />
                {{ m.library.forms.update }}
              </template>
            </Button>
          </DialogFooter>
        </Form>
      </template>
    </DialogContent>
  </Dialog>
</template>
