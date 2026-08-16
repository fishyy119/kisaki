<!--
  TvSeasonFormDialog
  Dialog for creating or editing one season's staged fields, including the
  poster. Seasons own no tracking state, so watch data never appears here.
  Season 0 is the industry's own encoding for specials.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { and, eq, ne } from 'drizzle-orm'
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
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel
} from '@renderer/components/ui/field'
import { Form } from '@renderer/components/ui/form'
import { ImagePicker } from '@renderer/components/ui/image-picker'
import { Input } from '@renderer/components/ui/input'
import {
  PartialDateInput,
  type PartialDateInputExpose
} from '@renderer/components/ui/partial-date-input'
import { Textarea } from '@renderer/components/ui/textarea'
import { useI18n } from '@renderer/composables/use-i18n'
import { useStagedImagePick } from '@renderer/composables/use-staged-image-pick'
import { attachment, db } from '@renderer/core/db'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { getAttachmentUrl } from '@renderer/utils/attachment'
import { tvSeasons, type PartialDate, type TvSeason } from '@shared/db'

const log = createLogger('Tv')

interface Props {
  tvId: string
  /** Season to edit; omit for create mode. */
  season?: TvSeason
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const { m } = useI18n()

interface FormData {
  seasonNumber: string
  name: string
  originalName: string
  airDate: PartialDate | null
  totalEpisodes: string
  description: string
}

const formData = ref<FormData>({
  seasonNumber: '',
  name: '',
  originalName: '',
  airDate: null,
  totalEpisodes: '',
  description: ''
})
const isSaving = ref(false)
const airDateInput = ref<PartialDateInputExpose | null>(null)

const isAddMode = computed(() => !props.season)

const poster = useStagedImagePick()

const currentPosterUrl = computed(() => {
  if (poster.mode.value !== 'keep') return null
  const season = props.season
  if (!season?.posterFile) return null
  return getAttachmentUrl('tv_seasons', season.id, season.posterFile, { width: 400 })
})

const posterClearDisabled = computed(
  () => poster.mode.value === 'clear' || (poster.mode.value === 'keep' && !props.season?.posterFile)
)

watch(
  () => open.value,
  (isOpen) => {
    if (!isOpen) return

    poster.reset()

    if (props.season) {
      formData.value.seasonNumber = String(props.season.seasonNumber)
      formData.value.name = props.season.name || ''
      formData.value.originalName = props.season.originalName || ''
      formData.value.airDate = props.season.airDate ?? null
      formData.value.totalEpisodes =
        props.season.totalEpisodes !== null ? String(props.season.totalEpisodes) : ''
      formData.value.description = props.season.description || ''
      return
    }

    formData.value.seasonNumber = ''
    formData.value.name = ''
    formData.value.originalName = ''
    formData.value.airDate = null
    formData.value.totalEpisodes = ''
    formData.value.description = ''
  },
  { immediate: true }
)

function parseSeasonNumber(): { valid: boolean; value: number } {
  const text = formData.value.seasonNumber.trim()
  const value = Number(text)
  if (text === '' || !Number.isInteger(value) || value < 0) return { valid: false, value: 0 }
  return { valid: true, value }
}

function parseTotalEpisodes(): { valid: boolean; value: number | null } {
  const text = formData.value.totalEpisodes.trim()
  if (text === '') return { valid: true, value: null }

  const value = Number(text)
  if (!Number.isInteger(value) || value < 0) return { valid: false, value: null }
  return { valid: true, value }
}

/** Season numbers are unique per show, so a taken number is a user-facing conflict. */
async function isSeasonNumberTaken(seasonNumber: number): Promise<boolean> {
  const [row] = await db
    .select({ id: tvSeasons.id })
    .from(tvSeasons)
    .where(
      and(
        eq(tvSeasons.tvId, props.tvId),
        eq(tvSeasons.seasonNumber, seasonNumber),
        props.season ? ne(tvSeasons.id, props.season.id) : undefined
      )
    )
    .limit(1)
  return row !== undefined
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

    const seasonNumber = parseSeasonNumber()
    if (!seasonNumber.valid) {
      notify.error(m.value.tv.seasons.numberInvalid)
      return
    }
    if (await isSeasonNumberTaken(seasonNumber.value)) {
      notify.error(m.value.tv.seasons.numberTaken)
      return
    }

    const totalEpisodes = parseTotalEpisodes()
    if (!totalEpisodes.valid) {
      notify.error(m.value.library.forms.totalEpisodesInvalid)
      return
    }

    const values = {
      seasonNumber: seasonNumber.value,
      name: formData.value.name.trim() || null,
      originalName: formData.value.originalName.trim() || null,
      airDate,
      totalEpisodes: totalEpisodes.value,
      description: formData.value.description.trim() || null
    }

    let seasonId: string
    if (props.season) {
      seasonId = props.season.id
      await db.update(tvSeasons).set(values).where(eq(tvSeasons.id, seasonId))
    } else {
      seasonId = nanoid()
      const existing = await db
        .select({ id: tvSeasons.id })
        .from(tvSeasons)
        .where(eq(tvSeasons.tvId, props.tvId))
      await db.insert(tvSeasons).values({
        id: seasonId,
        tvId: props.tvId,
        ...values,
        orderInTv: existing.length
      })
    }

    if (poster.mode.value === 'set' && poster.pickedPath.value) {
      await attachment.setFile(tvSeasons, seasonId, 'posterFile', {
        kind: 'path',
        path: poster.pickedPath.value
      })
    } else if (poster.mode.value === 'clear' && props.season?.posterFile) {
      await attachment.clearFile(tvSeasons, seasonId, 'posterFile')
    }

    notify.success(m.value.common.saved)
    open.value = false
  } catch (error) {
    log.error('Season save failed:', error)
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
          {{ isAddMode ? m.tv.seasons.addSeason : m.tv.seasons.editSeason }}
        </DialogTitle>
      </DialogHeader>
      <Form @submit="handleSubmit">
        <DialogBody class="overflow-auto max-h-[65vh]">
          <FieldGroup>
            <div class="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>{{ m.tv.seasons.numberLabel }}</FieldLabel>
                <FieldContent>
                  <Input
                    v-model="formData.seasonNumber"
                    type="number"
                    min="0"
                    step="1"
                  />
                </FieldContent>
                <FieldDescription>{{ m.tv.seasons.numberHint }}</FieldDescription>
              </Field>

              <Field>
                <FieldLabel>{{ m.library.fields.totalEpisodes }}</FieldLabel>
                <FieldContent>
                  <Input
                    v-model="formData.totalEpisodes"
                    type="number"
                    min="0"
                    step="1"
                    :placeholder="m.library.forms.totalEpisodesPlaceholder"
                  />
                </FieldContent>
              </Field>
            </div>

            <Field>
              <FieldLabel>{{ m.tv.seasons.nameLabel }}</FieldLabel>
              <FieldContent>
                <Input
                  v-model="formData.name"
                  :placeholder="m.tv.seasons.namePlaceholder"
                />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel>{{ m.library.fields.originalName }}</FieldLabel>
              <FieldContent>
                <Input v-model="formData.originalName" />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel>{{ m.tv.seasons.airDate }}</FieldLabel>
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
              <FieldLabel>{{ m.library.detail.sections.description }}</FieldLabel>
              <FieldContent>
                <Textarea
                  v-model="formData.description"
                  :rows="4"
                />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel>{{ m.tv.seasons.posterEntityLabel }}</FieldLabel>
              <FieldContent>
                <ImagePicker
                  :image-url="currentPosterUrl"
                  :image-alt="formData.name"
                  :picked-path="poster.pickedPath.value"
                  :picked-preview-url="poster.previewUrl.value"
                  :pick-disabled="isSaving"
                  :clear-disabled="isSaving || posterClearDisabled"
                  @pick="poster.pick()"
                  @clear="poster.clear()"
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
