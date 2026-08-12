<!--
  PersonAnimesItemFormDialog
  Dialog for adding/editing an anime link with staff role and note.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { animes, type AnimePersonRole } from '@shared/db'
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
import { Checkbox } from '@renderer/components/ui/checkbox'
import { Field, FieldLabel, FieldContent, FieldGroup } from '@renderer/components/ui/field'
import { Form } from '@renderer/components/ui/form'
import { AnimeSelect } from '@renderer/components/shared/anime'
import { notify } from '@renderer/core/notify'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

interface AnimeLinkData {
  animeId: string
  animeName: string
  animeCover: string | null
  role: AnimePersonRole
  note: string
  isSpoiler: boolean
}

interface Props {
  initialData?: AnimeLinkData
  excludeIds: string[]
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  submit: [data: AnimeLinkData]
}>()

const PERSON_ROLE_VALUES: AnimePersonRole[] = [
  'originalCreator',
  'director',
  'series',
  'scenario',
  'episodeDirector',
  'characterDesign',
  'animationDirector',
  'animation',
  'art',
  'photography',
  'sound',
  'music',
  'producer',
  'other'
]

const PERSON_ROLE_OPTIONS = computed<{ value: AnimePersonRole; label: string }[]>(() =>
  PERSON_ROLE_VALUES.map((value) => ({
    value,
    label: m.value.library.roles.animePerson[value]
  }))
)

// Form state
const formData = ref<AnimeLinkData>({
  animeId: '',
  animeName: '',
  animeCover: null,
  role: 'other',
  note: '',
  isSpoiler: false
})

const isAddMode = computed(() => !props.initialData)

// Initialize form state when dialog opens
watch(
  () => open.value,
  (isOpen) => {
    if (isOpen) {
      if (props.initialData) {
        formData.value.animeId = props.initialData.animeId
        formData.value.animeName = props.initialData.animeName
        formData.value.animeCover = props.initialData.animeCover
        formData.value.role = props.initialData.role
        formData.value.note = props.initialData.note
        formData.value.isSpoiler = props.initialData.isSpoiler
      } else {
        formData.value.animeId = ''
        formData.value.animeName = ''
        formData.value.animeCover = null
        formData.value.role = 'other'
        formData.value.note = ''
        formData.value.isSpoiler = false
      }
    }
  },
  { immediate: true }
)

const selectExcludeIds = computed(() => {
  if (isAddMode.value) {
    return props.excludeIds
  }
  return props.excludeIds.filter((id) => id !== formData.value.animeId)
})

// Watch for anime selection change - async side effect to fetch anime info
watch(
  () => formData.value.animeId,
  async (animeId) => {
    if (!animeId) {
      formData.value.animeName = ''
      formData.value.animeCover = null
      return
    }
    const anime = await db.query.animes.findFirst({ where: eq(animes.id, animeId) })
    if (anime) {
      formData.value.animeName = anime.name
      formData.value.animeCover = anime.coverFile
    }
  }
)

function handleSubmit() {
  if (!formData.value.animeId) {
    notify.error(
      m.value.library.forms.selectEntityRequired({ label: m.value.library.entities.anime })
    )
    return
  }

  emit('submit', {
    animeId: formData.value.animeId,
    animeName: formData.value.animeName || 'Unknown',
    animeCover: formData.value.animeCover,
    role: formData.value.role,
    note: formData.value.note.trim(),
    isSpoiler: formData.value.isSpoiler
  })
  open.value = false
}

function handleCancel() {
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-sm">
      <DialogHeader>
        <DialogTitle>{{
          (isAddMode ? m.library.forms.addEntityTitle : m.library.forms.editEntityTitle)({
            label: m.library.entities.anime
          })
        }}</DialogTitle>
      </DialogHeader>
      <Form @submit="handleSubmit">
        <DialogBody>
          <FieldGroup>
            <Field>
              <FieldLabel>{{ m.library.forms.animeLabel }}</FieldLabel>
              <FieldContent>
                <AnimeSelect
                  v-model="formData.animeId"
                  :exclude-ids="selectExcludeIds"
                  :placeholder="
                    m.library.select.selectPlaceholder({ label: m.library.entities.anime })
                  "
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>{{ m.library.forms.personRoleLabel }}</FieldLabel>
              <FieldContent>
                <Select v-model="formData.role">
                  <SelectTrigger class="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="opt in PERSON_ROLE_OPTIONS"
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
              <FieldLabel>{{ m.library.fields.note }}</FieldLabel>
              <FieldContent>
                <Input
                  v-model="formData.note"
                  :placeholder="m.library.forms.notePlaceholder"
                />
              </FieldContent>
            </Field>
            <Field orientation="horizontal">
              <FieldLabel>{{ m.library.forms.includesSpoiler }}</FieldLabel>
              <FieldContent>
                <Checkbox v-model="formData.isSpoiler" />
              </FieldContent>
            </Field>
          </FieldGroup>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            @click="handleCancel"
          >
            {{ m.common.cancel }}
          </Button>
          <Button type="submit">{{ m.common.save }}</Button>
        </DialogFooter>
      </Form>
    </DialogContent>
  </Dialog>
</template>
