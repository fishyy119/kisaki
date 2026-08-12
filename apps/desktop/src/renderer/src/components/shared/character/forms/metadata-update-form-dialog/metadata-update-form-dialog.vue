<!--
  CharacterMetadataUpdateFormDialog
  Update character metadata from scraper results through the main-process ingest service.
-->
<script setup lang="ts">
import { computed, ref, toRaw, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { notify } from '@renderer/core/notify'
import { useAsyncData } from '@renderer/composables'
import { buildIngestUpdateLookup } from '@renderer/utils/ingest-update'
import { characterExternalIds, characters } from '@shared/db'
import type { ExternalId } from '@shared/identity'
import {
  CHARACTER_UPDATE_SURFACE_KEYS,
  type CharacterUpdateRequest,
  type CharacterUpdateSurface,
  type IngestUpdatePolicy
} from '@shared/ingest/update'
import {
  CharacterSearcher,
  type CharacterSearcherSelection
} from '@renderer/components/shared/character'
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

const { m } = useI18n()

interface Props {
  characterId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const isSubmitting = ref(false)

const selection = ref<CharacterSearcherSelection>({
  profileId: '',
  characterId: '',
  characterName: '',
  originalName: '',
  knownIds: [],
  canSubmit: false
})

const singularUpdate = ref<IngestUpdatePolicy['singularUpdate']>('overwrite')
const collectionUpdate = ref<IngestUpdatePolicy['collectionUpdate']>('replace')
const selectedSurfaces = ref<CharacterUpdateSurface[]>([...CHARACTER_UPDATE_SURFACE_KEYS])
const useCurrentExternalIdsAsKnownIds = ref(true)

const SURFACE_LABELS = computed<Record<CharacterUpdateSurface, string>>(() => ({
  name: m.value.library.fields.name,
  originalName: m.value.library.fields.originalName,
  birthDate: m.value.library.fields.birthDate,
  gender: m.value.library.fields.gender,
  age: m.value.library.fields.age,
  bloodType: m.value.library.fields.bloodType,
  height: m.value.library.fields.height,
  weight: m.value.library.fields.weight,
  bust: m.value.library.fields.bust,
  waist: m.value.library.fields.waist,
  hips: m.value.library.fields.hips,
  cup: m.value.library.fields.cup,
  description: m.value.library.fields.description,
  externalSites: m.value.library.fields.externalSites,
  externalIds: m.value.library.fields.externalIds,
  tags: m.value.library.fields.tags,
  person: m.value.library.entities.person,
  photos: m.value.library.fields.photos
}))

const { data, isLoading } = useAsyncData(
  async () => {
    const character = await db.query.characters.findFirst({
      where: eq(characters.id, props.characterId)
    })
    if (!character) return null

    const rows = await db
      .select({ source: characterExternalIds.source, id: characterExternalIds.externalId })
      .from(characterExternalIds)
      .where(eq(characterExternalIds.characterId, props.characterId))

    const externalIds: ExternalId[] = rows.map((row) => ({ source: row.source, id: row.id }))

    return { character, externalIds }
  },
  {
    watch: [() => props.characterId],
    enabled: () => open.value
  }
)

const defaultSearchQuery = computed(() => {
  const character = data.value?.character
  if (!character) return ''
  return character.originalName || character.name || ''
})

const canSubmit = computed(() => {
  return !!selection.value.profileId && selectedSurfaces.value.length > 0 && !isSubmitting.value
})

function handleSelectionChange(next: CharacterSearcherSelection) {
  selection.value = next
}

function toggleSurface(surface: CharacterUpdateSurface, nextValue: boolean) {
  const current = selectedSurfaces.value
  if (nextValue) {
    if (!current.includes(surface)) selectedSurfaces.value = [...current, surface]
    return
  }
  selectedSurfaces.value = current.filter((item) => item !== surface)
}

function handleSelectAllSurfaces() {
  selectedSurfaces.value = [...CHARACTER_UPDATE_SURFACE_KEYS]
}

function handleSelectNoSurfaces() {
  selectedSurfaces.value = []
}

watch(
  () => open.value,
  (isOpen) => {
    if (!isOpen) return
    isSubmitting.value = false
    selection.value = {
      profileId: '',
      characterId: '',
      characterName: '',
      originalName: '',
      knownIds: [],
      canSubmit: false
    }
    singularUpdate.value = 'overwrite'
    collectionUpdate.value = 'replace'
    selectedSurfaces.value = [...CHARACTER_UPDATE_SURFACE_KEYS]
    useCurrentExternalIdsAsKnownIds.value = true
  }
)

async function handleSubmit() {
  if (!data.value?.character) return
  if (!selection.value.profileId) return
  if (selectedSurfaces.value.length === 0) return

  const baseKnownIds = useCurrentExternalIdsAsKnownIds.value ? toRaw(data.value.externalIds) : []
  const selectionKnownIds = toRaw(selection.value.knownIds)
  const lookupName =
    selection.value.originalName ||
    selection.value.characterName ||
    data.value.character.originalName ||
    data.value.character.name

  const request: CharacterUpdateRequest = {
    rootId: props.characterId,
    profileId: selection.value.profileId,
    lookup: buildIngestUpdateLookup({
      name: lookupName,
      baseKnownIds,
      selectionKnownIds
    }),
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
    const result = await ipcManager.invoke('ingest:update-character-from-scraper', request)
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
    <DialogContent class="max-w-3xl">
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
          <DialogTitle class="flex items-center gap-2">
            <Icon
              icon="icon-[mdi--database-sync-outline]"
              class="size-4"
            />
            {{ m.library.forms.updateMetadataTitle }}
          </DialogTitle>
        </DialogHeader>

        <Form @submit="handleSubmit">
          <DialogBody class="space-y-4 max-h-[70vh] overflow-y-auto">
            <CharacterSearcher
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
                      v-for="surface in CHARACTER_UPDATE_SURFACE_KEYS"
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
                        {{ SURFACE_LABELS[surface] }}
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
            <div class="flex items-center gap-1.5 text-[11px] text-muted-foreground mr-auto">
              <Icon
                icon="icon-[mdi--lightbulb-outline]"
                class="size-3.5"
              />
              <span>{{ m.library.forms.personStandaloneHint }}</span>
            </div>
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
