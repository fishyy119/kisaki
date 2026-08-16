<!--
  TvEpisodeFormDialog
  Dialog for creating or editing one episode's staged fields, including the
  still image and the season it belongs to. Watch state and file rows are owned
  by playback and file sync, so they never appear here.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Field, FieldContent, FieldGroup, FieldLabel } from '@renderer/components/ui/field'
import { Form } from '@renderer/components/ui/form'
import { ImagePicker } from '@renderer/components/ui/image-picker'
import { Input } from '@renderer/components/ui/input'
import {
  PartialDateInput,
  type PartialDateInputExpose
} from '@renderer/components/ui/partial-date-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { Textarea } from '@renderer/components/ui/textarea'
import { useI18n } from '@renderer/composables/use-i18n'
import { useStagedImagePick } from '@renderer/composables/use-staged-image-pick'
import { useTv } from '@renderer/composables/use-tv'
import { attachment, db } from '@renderer/core/db'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { getAttachmentUrl } from '@renderer/utils/attachment'
import { tvEpisodes, type PartialDate, type TvEpisode } from '@shared/db'
import { formatTvSeasonLabel } from './season-label'

const log = createLogger('Tv')

const MILLISECONDS_PER_MINUTE = 60_000

interface Props {
  tvId: string
  /** Season the new episode lands in; ignored when editing. */
  seasonId?: string
  /** Episode to edit; omit for create mode. */
  episode?: TvEpisode
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const { m } = useI18n()
const { seasons } = useTv()

const seasonOptions = computed(() =>
  seasons.value.map((season) => ({ value: season.id, label: formatTvSeasonLabel(season, m.value) }))
)

interface FormData {
  seasonId: string
  episodeNumber: string
  name: string
  originalName: string
  airDate: PartialDate | null
  durationMinutes: string
  description: string
}

const formData = ref<FormData>({
  seasonId: '',
  episodeNumber: '',
  name: '',
  originalName: '',
  airDate: null,
  durationMinutes: '',
  description: ''
})
const isSaving = ref(false)
const airDateInput = ref<PartialDateInputExpose | null>(null)

const isAddMode = computed(() => !props.episode)

const still = useStagedImagePick()

const currentStillUrl = computed(() => {
  if (still.mode.value !== 'keep') return null
  const episode = props.episode
  if (!episode?.stillFile) return null
  return getAttachmentUrl('tv_episodes', episode.id, episode.stillFile, { width: 640 })
})

const stillClearDisabled = computed(
  () => still.mode.value === 'clear' || (still.mode.value === 'keep' && !props.episode?.stillFile)
)

watch(
  () => open.value,
  (isOpen) => {
    if (!isOpen) return

    still.reset()

    if (props.episode) {
      formData.value.seasonId = props.episode.seasonId
      formData.value.episodeNumber =
        props.episode.episodeNumber !== null ? String(props.episode.episodeNumber) : ''
      formData.value.name = props.episode.name || ''
      formData.value.originalName = props.episode.originalName || ''
      formData.value.airDate = props.episode.airDate ?? null
      formData.value.durationMinutes =
        props.episode.durationMs !== null
          ? String(Math.round(props.episode.durationMs / MILLISECONDS_PER_MINUTE))
          : ''
      formData.value.description = props.episode.description || ''
      return
    }

    formData.value.seasonId = props.seasonId ?? seasons.value[0]?.id ?? ''
    formData.value.episodeNumber = ''
    formData.value.name = ''
    formData.value.originalName = ''
    formData.value.airDate = null
    formData.value.durationMinutes = ''
    formData.value.description = ''
  },
  { immediate: true }
)

function parseEpisodeNumber(): { valid: boolean; value: number | null } {
  const text = formData.value.episodeNumber.trim()
  if (text === '') return { valid: true, value: null }

  const value = Number(text)
  if (!Number.isInteger(value) || value <= 0) return { valid: false, value: null }
  return { valid: true, value }
}

function parseDurationMs(): { valid: boolean; value: number | null } {
  const text = formData.value.durationMinutes.trim()
  if (text === '') return { valid: true, value: null }

  const minutes = Number(text)
  if (!Number.isFinite(minutes) || minutes <= 0) return { valid: false, value: null }
  return { valid: true, value: Math.round(minutes * MILLISECONDS_PER_MINUTE) }
}

async function handleSubmit(): Promise<void> {
  isSaving.value = true
  try {
    const airDateValidation = airDateInput.value?.validate()
    if (airDateValidation && !airDateValidation.valid) {
      notify.error(airDateValidation.errorText ?? m.value.library.forms.releaseDateInvalidFormat)
      return
    }
    const airDate = airDateValidation?.value ?? formData.value.airDate

    const episodeNumber = parseEpisodeNumber()
    if (!episodeNumber.valid) {
      notify.error(m.value.tv.episodes.numberInvalid)
      return
    }

    const durationMs = parseDurationMs()
    if (!durationMs.valid) {
      notify.error(m.value.tv.episodes.durationInvalid)
      return
    }

    const seasonId = formData.value.seasonId
    if (!seasonId) {
      notify.error(m.value.tv.seasons.numberInvalid)
      return
    }

    const values = {
      seasonId,
      episodeNumber: episodeNumber.value,
      name: formData.value.name.trim() || null,
      originalName: formData.value.originalName.trim() || null,
      airDate,
      durationMs: durationMs.value,
      description: formData.value.description.trim() || null
    }

    let episodeId: string
    if (props.episode) {
      episodeId = props.episode.id
      await db.update(tvEpisodes).set(values).where(eq(tvEpisodes.id, episodeId))
    } else {
      episodeId = nanoid()
      const [seasonSiblings, entrySiblings] = await Promise.all([
        db.select({ id: tvEpisodes.id }).from(tvEpisodes).where(eq(tvEpisodes.seasonId, seasonId)),
        db.select({ id: tvEpisodes.id }).from(tvEpisodes).where(eq(tvEpisodes.tvId, props.tvId))
      ])
      await db.insert(tvEpisodes).values({
        id: episodeId,
        tvId: props.tvId,
        ...values,
        orderInSeason: seasonSiblings.length,
        orderInTv: entrySiblings.length
      })
    }

    // Apply the staged still decision through the attachment pipeline.
    if (still.mode.value === 'set' && still.pickedPath.value) {
      await attachment.setFile(tvEpisodes, episodeId, 'stillFile', {
        kind: 'path',
        path: still.pickedPath.value
      })
    } else if (still.mode.value === 'clear' && props.episode?.stillFile) {
      await attachment.clearFile(tvEpisodes, episodeId, 'stillFile')
    }

    notify.success(m.value.common.saved)
    open.value = false
  } catch (error) {
    log.error('Episode save failed:', error)
    notify.error(m.value.library.feedback.saveFailedRetry)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>
          {{ isAddMode ? m.tv.episodes.addEpisode : m.tv.episodes.editEpisode }}
        </DialogTitle>
      </DialogHeader>
      <Form @submit="handleSubmit">
        <DialogBody class="overflow-auto max-h-[65vh]">
          <FieldGroup>
            <div class="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>{{ m.tv.episodes.seasonLabel }}</FieldLabel>
                <FieldContent>
                  <Select v-model="formData.seasonId">
                    <SelectTrigger class="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="option in seasonOptions"
                        :key="option.value"
                        :value="option.value"
                      >
                        {{ option.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel>{{ m.tv.episodes.numberLabel }}</FieldLabel>
                <FieldContent>
                  <Input
                    v-model="formData.episodeNumber"
                    type="number"
                    step="1"
                    min="1"
                    :placeholder="m.tv.episodes.numberPlaceholder"
                  />
                </FieldContent>
              </Field>
            </div>

            <Field>
              <FieldLabel>{{ m.library.fields.name }}</FieldLabel>
              <FieldContent>
                <Input v-model="formData.name" />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel>{{ m.library.fields.originalName }}</FieldLabel>
              <FieldContent>
                <Input v-model="formData.originalName" />
              </FieldContent>
            </Field>

            <div class="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>{{ m.tv.episodes.airDate }}</FieldLabel>
                <FieldContent>
                  <PartialDateInput
                    ref="airDateInput"
                    v-model="formData.airDate"
                    :messages="{
                      yearDayWithoutMonthText: m.library.forms.releaseDateYearDayWithoutMonth
                    }"
                  />
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel>{{ m.tv.episodes.durationMinutes }}</FieldLabel>
                <FieldContent>
                  <Input
                    v-model="formData.durationMinutes"
                    type="number"
                    min="0"
                  />
                </FieldContent>
              </Field>
            </div>

            <Field>
              <FieldLabel>{{ m.library.detail.sections.description }}</FieldLabel>
              <FieldContent>
                <Textarea
                  v-model="formData.description"
                  :rows="4"
                />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel>{{ m.tv.episodes.stillEntityLabel }}</FieldLabel>
              <FieldContent>
                <ImagePicker
                  :image-url="currentStillUrl"
                  :image-alt="formData.name"
                  :picked-path="still.pickedPath.value"
                  :picked-preview-url="still.previewUrl.value"
                  :pick-disabled="isSaving"
                  :clear-disabled="isSaving || stillClearDisabled"
                  @pick="still.pick()"
                  @clear="still.clear()"
                />
              </FieldContent>
            </Field>
          </FieldGroup>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            :disabled="isSaving"
            @click="open = false"
          >
            {{ m.common.cancel }}
          </Button>
          <Button
            type="submit"
            :disabled="isSaving"
          >
            {{ m.common.save }}
          </Button>
        </DialogFooter>
      </Form>
    </DialogContent>
  </Dialog>
</template>
