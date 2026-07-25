<!--
  ScraperProfilesItemFormDialog
  Dialog for editing a single scraper profile item.
  Uses local state only - receives profile prop and returns via onSave callback.
  Slot list is displayed inline - clicking a slot opens ScraperSlotConfigFormDialog.
-->
<script setup lang="ts">
import type {
  ScraperProfile,
  ScraperSlotConfigs,
  SlotConfig,
  ScraperSlot,
  SlotStrategy
} from '@shared/db'
import type { ContentEntityType } from '@shared/common'
import type { ContentLocale } from '@shared/i18n'

import { ref, watch, computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { notify } from '@renderer/core/notify'
import { useI18n } from '@renderer/composables/use-i18n'
import {
  createEmptySlotConfig,
  getScraperSlotsForMediaType,
  normalizeSlotConfigs
} from '@shared/scraper'
import {
  ScraperProviderSelect,
  type ScraperProvidersByType
} from '@renderer/components/shared/scraper'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { ContentLocaleSelect } from '@renderer/components/ui/locale-select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import {
  Field,
  FieldLabel,
  FieldContent,
  FieldGroup,
  FieldDescription
} from '@renderer/components/ui/field'
import { Form } from '@renderer/components/ui/form'
import ScraperProfileSlotConfigFormDialog from './profile-slot-config-form-dialog.vue'

interface Props {
  profile: ScraperProfile | null
  isNew: boolean
  providersByType: ScraperProvidersByType
  onSave: (profile: ScraperProfile) => void
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const { m } = useI18n()

const MEDIA_TYPE_LABELS = computed<Record<ContentEntityType, string>>(() => ({
  game: m.value.library.entities.game,
  character: m.value.library.entities.character,
  person: m.value.library.entities.person,
  company: m.value.library.entities.company
}))

const SLOT_LABELS = computed<Record<ScraperSlot, string>>(() => m.value.scraper.profiles.slots)

const STRATEGY_LABELS = computed<Record<SlotStrategy, string>>(() => ({
  first: m.value.scraper.profiles.strategyFirst,
  enrich: m.value.scraper.profiles.strategyEnrich
}))

// Form state
interface FormData {
  name: string
  mediaType: ContentEntityType
  searchProviderId: string
  defaultLocale: ContentLocale | null
  slotConfigs: ScraperSlotConfigs
}

const formData = ref<FormData>({
  name: '',
  mediaType: 'game',
  searchProviderId: '',
  defaultLocale: null,
  slotConfigs: normalizeSlotConfigs('game', null)
})

// Slot editing state
const editingSlot = ref<ScraperSlot | null>(null)
const slotDialogOpen = ref(false)

// Initialize form state when dialog opens
watch(
  () => open.value,
  (isOpen) => {
    if (isOpen && props.profile) {
      formData.value.name = props.profile.name
      formData.value.mediaType = props.profile.mediaType
      formData.value.searchProviderId = props.profile.searchProviderId
      formData.value.defaultLocale = props.profile.defaultLocale
      formData.value.slotConfigs = normalizeSlotConfigs(
        props.profile.mediaType,
        props.profile.slotConfigs
      )
    }
  },
  { immediate: true }
)

watch(
  () => formData.value.mediaType,
  (mediaType) => {
    formData.value.slotConfigs = normalizeSlotConfigs(mediaType, formData.value.slotConfigs)
  }
)

const slotsForMediaType = computed(() => getScraperSlotsForMediaType(formData.value.mediaType))

// Computed for slot editing
const editingSlotConfig = computed(() => {
  if (!editingSlot.value) return null
  return formData.value.slotConfigs[editingSlot.value] ?? createEmptySlotConfig(editingSlot.value)
})

function handleSlotClick(slot: ScraperSlot) {
  editingSlot.value = slot
  slotDialogOpen.value = true
}

function handleSlotSave(config: SlotConfig) {
  if (editingSlot.value) {
    formData.value.slotConfigs = {
      ...formData.value.slotConfigs,
      [editingSlot.value]: config
    }
  }
  editingSlot.value = null
  slotDialogOpen.value = false
}

// Clean up state when slot dialog closes (handles cancel scenario)
watch(
  () => slotDialogOpen.value,
  (isOpen) => {
    if (!isOpen) {
      editingSlot.value = null
    }
  }
)

function handleSubmit() {
  if (!formData.value.name.trim() || !props.profile) return

  props.onSave({
    ...props.profile,
    name: formData.value.name.trim(),
    mediaType: formData.value.mediaType,
    searchProviderId: formData.value.searchProviderId,
    defaultLocale: formData.value.defaultLocale,
    slotConfigs: formData.value.slotConfigs,
    updatedAt: new Date()
  })
  open.value = false
}

// Computed model for media type (Select returns unknown type)
const mediaTypeModel = computed({
  get: () => formData.value.mediaType,
  set: (value: unknown) => {
    if (value === 'game' || value === 'character' || value === 'person' || value === 'company') {
      formData.value.mediaType = value
    }
  }
})

function getSlotStrategyLabel(slot: ScraperSlot): string {
  return STRATEGY_LABELS.value[formData.value.slotConfigs[slot]?.strategy ?? 'first']
}

async function handleCopyProfileId() {
  if (!props.profile) {
    return
  }

  try {
    await navigator.clipboard.writeText(props.profile.id)
    notify.success(m.value.scraper.profiles.idCopied)
  } catch (error) {
    notify.error(m.value.common.copyFailed, error instanceof Error ? error.message : String(error))
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>{{
          props.isNew ? m.scraper.profiles.itemTitleAdd : m.scraper.profiles.itemTitleEdit
        }}</DialogTitle>
      </DialogHeader>
      <Form @submit="handleSubmit">
        <DialogBody class="max-h-[70vh] overflow-auto">
          <FieldGroup>
            <!-- Profile Name -->
            <Field>
              <FieldLabel>{{ m.scraper.profiles.nameLabel }}</FieldLabel>
              <FieldContent>
                <Input
                  v-model="formData.name"
                  required
                  :placeholder="m.scraper.profiles.namePlaceholder"
                />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel>{{ m.scraper.profiles.idLabel }}</FieldLabel>
              <FieldContent>
                <div class="flex gap-1.5">
                  <Input
                    :model-value="props.profile?.id ?? ''"
                    readonly
                    class="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    :tooltip="m.scraper.profiles.copyIdTooltip"
                    @click="handleCopyProfileId"
                  >
                    <Icon
                      icon="icon-[mdi--content-copy]"
                      class="size-4"
                    />
                  </Button>
                </div>
              </FieldContent>
            </Field>

            <!-- Media Type -->
            <Field>
              <FieldLabel>{{ m.scraper.profiles.mediaTypeLabel }}</FieldLabel>
              <FieldContent>
                <Select v-model="mediaTypeModel">
                  <SelectTrigger class="w-full">
                    <SelectValue :placeholder="m.scraper.profiles.selectMediaType" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="game">{{ MEDIA_TYPE_LABELS.game }}</SelectItem>
                    <SelectItem value="character">{{ MEDIA_TYPE_LABELS.character }}</SelectItem>
                    <SelectItem value="person">{{ MEDIA_TYPE_LABELS.person }}</SelectItem>
                    <SelectItem value="company">{{ MEDIA_TYPE_LABELS.company }}</SelectItem>
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>

            <!-- Search Provider -->
            <Field>
              <FieldLabel>{{ m.scraper.profiles.searchProviderLabel }}</FieldLabel>
              <FieldContent>
                <ScraperProviderSelect
                  v-model="formData.searchProviderId"
                  :entity-type="formData.mediaType"
                  :required-capabilities="['search']"
                />
              </FieldContent>
            </Field>

            <!-- Default ContentLocale -->
            <Field>
              <FieldLabel class="flex items-center gap-1.5">
                {{ m.scraper.profiles.defaultLanguageLabel }}
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Icon
                      icon="icon-[mdi--information-outline]"
                      class="size-3.5 text-muted-foreground cursor-help"
                    />
                  </TooltipTrigger>
                  <TooltipContent class="max-w-xs">
                    {{ m.scraper.profiles.defaultLanguageHint }}
                  </TooltipContent>
                </Tooltip>
              </FieldLabel>
              <FieldContent>
                <ContentLocaleSelect v-model="formData.defaultLocale" />
              </FieldContent>
            </Field>

            <!-- Slot Configs - inline list -->
            <Field>
              <FieldLabel>{{ m.scraper.profiles.slotsLabel }}</FieldLabel>
              <FieldDescription>{{ m.scraper.profiles.slotsHint }}</FieldDescription>
              <FieldContent>
                <div class="space-y-1">
                  <button
                    v-for="slot in slotsForMediaType"
                    :key="slot"
                    type="button"
                    class="w-full flex items-center justify-between p-2.5 rounded-lg border hover:bg-accent/50 transition-colors text-left"
                    @click="() => handleSlotClick(slot)"
                  >
                    <span class="text-sm font-medium">{{ SLOT_LABELS[slot] }}</span>
                    <div class="flex items-center gap-2 text-muted-foreground">
                      <span class="text-xs font-mono">
                        {{ getSlotStrategyLabel(slot) }}
                        ·
                        {{
                          m.scraper.profiles.providerCount({
                            count:
                              formData.slotConfigs[slot]?.providers.filter((p) => p.enabled)
                                .length || 0
                          })
                        }}
                      </span>
                      <Icon
                        icon="icon-[mdi--chevron-right]"
                        class="size-4"
                      />
                    </div>
                  </button>
                </div>
              </FieldContent>
            </Field>
          </FieldGroup>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            @click="open = false"
          >
            {{ m.common.cancel }}
          </Button>
          <Button type="submit">{{ m.common.save }}</Button>
        </DialogFooter>
      </Form>
    </DialogContent>
  </Dialog>

  <!-- Slot Config Sub-Dialog -->
  <ScraperProfileSlotConfigFormDialog
    v-if="editingSlot && editingSlotConfig"
    v-model:open="slotDialogOpen"
    :entity-type="formData.mediaType"
    :slot-type="editingSlot"
    :slot-name="SLOT_LABELS[editingSlot]"
    :slot-config="editingSlotConfig"
    :providers-by-type="props.providersByType"
    :on-save="handleSlotSave"
  />
</template>
