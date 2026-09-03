<!--
  EntityBatchMetadataUpdateFormDialog
  Starts a main-process batch metadata update for selected entries of one
  entity type; entity differences arrive via the update spec registry.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { notify } from '@renderer/core/notify'
import type { IngestBatchUpdateRequest, IngestUpdatePolicy } from '@shared/ingest/update'
import { ScraperProfileSelect } from '@renderer/components/shared/scraper'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { Checkbox } from '@renderer/components/ui/checkbox'
import { Label } from '@renderer/components/ui/label'
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
import type { ContentEntityType } from '@shared/entity-types'
import { METADATA_UPDATE_SPECS } from './update-specs'

const { m } = useI18n()

interface Props {
  entityType: ContentEntityType
  entityIds: string[]
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const openModel = computed({
  get: () => open.value,
  set: (value) => {
    if (!isSubmitting.value) {
      open.value = value
    }
  }
})

const spec = computed(() => METADATA_UPDATE_SPECS[props.entityType])
const surfaceLabels = computed(() => spec.value.surfaceLabels(m.value))

const isSubmitting = ref(false)
const profileId = ref('')
const singularUpdate = ref<IngestUpdatePolicy['singularUpdate']>('overwrite')
const collectionUpdate = ref<IngestUpdatePolicy['collectionUpdate']>('replace')
const selectedSurfaces = ref<string[]>([...spec.value.surfaceKeys])
const useCurrentExternalIdsAsKnownIds = ref(true)

const selectedCount = computed(() => props.entityIds.length)

const canSubmit = computed(() => {
  return (
    !!profileId.value &&
    selectedSurfaces.value.length > 0 &&
    selectedCount.value > 0 &&
    !isSubmitting.value
  )
})

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
    profileId.value = ''
    singularUpdate.value = 'overwrite'
    collectionUpdate.value = 'replace'
    selectedSurfaces.value = [...spec.value.surfaceKeys]
    useCurrentExternalIdsAsKnownIds.value = true
  }
)

async function handleSubmit() {
  if (!profileId.value) return
  if (props.entityIds.length === 0) return
  if (selectedSurfaces.value.length === 0) return

  const request: IngestBatchUpdateRequest<string> = {
    rootIds: [...props.entityIds],
    profileId: profileId.value,
    selection: { surfaces: [...selectedSurfaces.value] },
    policy: {
      singularUpdate: singularUpdate.value,
      collectionUpdate: collectionUpdate.value
    },
    useCurrentExternalIdsAsKnownIds: useCurrentExternalIdsAsKnownIds.value
  }

  open.value = false
  isSubmitting.value = true

  try {
    const result = await spec.value.submitBatch(request)
    if (!result.success) {
      notify.error(m.value.library.forms.startBatchUpdateFailed, result.error)
    }
  } catch (error) {
    notify.error(
      m.value.library.forms.startBatchUpdateFailed,
      error instanceof Error ? error.message : m.value.library.feedback.unknownError
    )
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="openModel">
    <DialogContent size="lg">
      <DialogHeader>
        <DialogTitle icon="icon-[mdi--database-sync-outline]">
          {{ m.library.forms.batchUpdateMetadataTitle }}
          <template #trailing>
            <span class="shrink-0 text-xs text-muted-foreground">{{
              m.library.forms.batchSelectedCount({
                count: selectedCount,
                label: m.library.entities[props.entityType]
              })
            }}</span>
          </template>
        </DialogTitle>
      </DialogHeader>

      <Form @submit="handleSubmit">
        <DialogBody class="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel>{{ m.library.forms.scraperConfigLabel }}</FieldLabel>
              <FieldContent>
                <ScraperProfileSelect
                  v-model="profileId"
                  :entity-type="props.entityType"
                />
              </FieldContent>
            </Field>
          </FieldGroup>

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
            {{ m.actions.close }}
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
    </DialogContent>
  </Dialog>
</template>
