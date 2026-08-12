<!--
  AnimeEpisodeFormDialog
  Dialog for creating or editing one episode's metadata. Watch state and file
  rows are owned by playback and file sync, so they never appear here.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db } from '@renderer/core/db'
import { animeEpisodes, type AnimeEpisode, type AnimeEpisodeType } from '@shared/db'
import type { PartialDate } from '@shared/db'
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
import { Textarea } from '@renderer/components/ui/textarea'
import { Field, FieldLabel, FieldContent, FieldGroup } from '@renderer/components/ui/field'
import { Form } from '@renderer/components/ui/form'
import {
  PartialDateInput,
  type PartialDateInputExpose
} from '@renderer/components/ui/partial-date-input'
import { notify } from '@renderer/core/notify'
import { createLogger } from '@renderer/core/log'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

const log = createLogger('Anime')

const MILLISECONDS_PER_MINUTE = 60_000

interface Props {
  animeId: string
  /** Episode to edit; omit for create mode. */
  episode?: AnimeEpisode
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const EPISODE_TYPE_OPTIONS = computed<{ value: AnimeEpisodeType; label: string }[]>(() => [
  { value: 'regular', label: m.value.library.animeEpisodeType.regular },
  { value: 'special', label: m.value.library.animeEpisodeType.special }
])

interface FormData {
  type: AnimeEpisodeType
  episodeNumber: string
  name: string
  originalName: string
  airDate: PartialDate | null
  durationMinutes: string
  description: string
}

const formData = ref<FormData>({
  type: 'regular',
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

// Initialize form state when dialog opens
watch(
  () => open.value,
  (isOpen) => {
    if (!isOpen) return

    if (props.episode) {
      formData.value.type = props.episode.type
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

    formData.value.type = 'regular'
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
  if (!Number.isFinite(value) || value <= 0) return { valid: false, value: null }
  return { valid: true, value }
}

function parseDurationMs(): { valid: boolean; value: number | null } {
  const text = formData.value.durationMinutes.trim()
  if (text === '') return { valid: true, value: null }

  const minutes = Number(text)
  if (!Number.isFinite(minutes) || minutes <= 0) return { valid: false, value: null }
  return { valid: true, value: Math.round(minutes * MILLISECONDS_PER_MINUTE) }
}

async function handleSubmit() {
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
      notify.error(m.value.anime.episodes.numberInvalid)
      return
    }

    const durationMs = parseDurationMs()
    if (!durationMs.valid) {
      notify.error(m.value.anime.episodes.durationInvalid)
      return
    }

    const values = {
      type: formData.value.type,
      episodeNumber: episodeNumber.value,
      name: formData.value.name.trim() || null,
      originalName: formData.value.originalName.trim() || null,
      airDate,
      durationMs: durationMs.value,
      description: formData.value.description.trim() || null
    }

    if (props.episode) {
      await db.update(animeEpisodes).set(values).where(eq(animeEpisodes.id, props.episode.id))
    } else {
      const existing = await db
        .select({ orderInAnime: animeEpisodes.orderInAnime })
        .from(animeEpisodes)
        .where(eq(animeEpisodes.animeId, props.animeId))
      await db.insert(animeEpisodes).values({
        id: nanoid(),
        animeId: props.animeId,
        ...values,
        orderInAnime: existing.length
      })
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

function handleCancel() {
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>{{
          isAddMode ? m.anime.episodes.addEpisode : m.anime.episodes.editEpisode
        }}</DialogTitle>
      </DialogHeader>
      <Form @submit="handleSubmit">
        <DialogBody class="overflow-auto max-h-[65vh]">
          <FieldGroup>
            <div class="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>{{ m.anime.episodes.typeLabel }}</FieldLabel>
                <FieldContent>
                  <Select v-model="formData.type">
                    <SelectTrigger class="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="opt in EPISODE_TYPE_OPTIONS"
                        :key="opt.value"
                        :value="opt.value"
                      >
                        {{ opt.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel>{{ m.anime.episodes.numberLabel }}</FieldLabel>
                <FieldContent>
                  <Input
                    v-model="formData.episodeNumber"
                    type="number"
                    step="0.5"
                    min="0"
                    :placeholder="m.anime.episodes.numberPlaceholder"
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
                <FieldLabel>{{ m.anime.episodes.airDate }}</FieldLabel>
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
                <FieldLabel>{{ m.anime.episodes.durationMinutes }}</FieldLabel>
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
          </FieldGroup>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            :disabled="isSaving"
            @click="handleCancel"
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
