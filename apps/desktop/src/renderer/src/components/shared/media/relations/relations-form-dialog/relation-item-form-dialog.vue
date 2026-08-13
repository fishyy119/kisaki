<!--
  MediaRelationItemFormDialog
  Dialog for adding/editing a single media relation as seen from the owning
  entry: target media type, target entry, relation type constrained by the
  endpoint pair, and an optional note.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { MediaType } from '@shared/common'
import { getMediaRelationTypeRules, type MediaRelationType } from '@shared/db'
import { MEDIA_TYPES } from '@shared/common'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Form } from '@renderer/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Field, FieldLabel, FieldContent, FieldGroup } from '@renderer/components/ui/field'
import { AnimeSelect } from '@renderer/components/shared/anime'
import { GameSelect } from '@renderer/components/shared/game'
import { db } from '@renderer/core/db'
import { notify } from '@renderer/core/notify'
import { useI18n } from '@renderer/composables/use-i18n'

export interface MediaRelationDraft {
  targetType: MediaType
  targetId: string
  targetName: string
  type: MediaRelationType
  note: string
}

interface Props {
  mediaType: MediaType
  initialData?: MediaRelationDraft
  excludeGameIds: string[]
  excludeAnimeIds: string[]
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  submit: [data: MediaRelationDraft]
}>()

const { m } = useI18n()

const isAddMode = computed(() => !props.initialData)

const MEDIA_TYPE_OPTIONS = computed(() =>
  MEDIA_TYPES.map((type) => ({ value: type, label: m.value.library.entities[type] }))
)

// Placeholder until the immediate open watcher seeds the real draft from props.
const formData = ref<MediaRelationDraft>({
  targetType: 'game',
  targetId: '',
  targetName: '',
  type: 'other',
  note: ''
})

const allowedTypes = computed(() =>
  getMediaRelationTypeRules(props.mediaType, formData.value.targetType)
)

const RELATION_TYPE_OPTIONS = computed(() =>
  allowedTypes.value.map((type) => ({ value: type, label: m.value.library.mediaRelation[type] }))
)

function createEmptyDraft(mediaType: MediaType): MediaRelationDraft {
  return {
    targetType: mediaType,
    targetId: '',
    targetName: '',
    type: getMediaRelationTypeRules(mediaType, mediaType)[0],
    note: ''
  }
}

// Initialize form state when dialog opens.
watch(
  () => open.value,
  (isOpen) => {
    if (!isOpen) return
    formData.value = props.initialData
      ? { ...props.initialData }
      : createEmptyDraft(props.mediaType)
  },
  { immediate: true }
)

// Switching the endpoint pair invalidates the target and may shrink the
// relation vocabulary, so both reset onto the new pair.
watch(
  () => formData.value.targetType,
  (targetType, previous) => {
    if (targetType === previous) return
    formData.value.targetId = ''
    formData.value.targetName = ''
    if (!allowedTypes.value.includes(formData.value.type)) {
      formData.value.type = allowedTypes.value[0]
    }
  }
)

watch(
  () => formData.value.targetId,
  async (targetId) => {
    if (!targetId) {
      formData.value.targetName = ''
      return
    }
    const row =
      formData.value.targetType === 'game'
        ? await db.query.games.findFirst({ where: (t, { eq }) => eq(t.id, targetId) })
        : await db.query.animes.findFirst({ where: (t, { eq }) => eq(t.id, targetId) })
    formData.value.targetName = row?.name ?? ''
  }
)

function handleSubmit() {
  if (!formData.value.targetId) {
    notify.error(
      m.value.library.forms.selectEntityRequired({
        label: m.value.library.entities[formData.value.targetType]
      })
    )
    return
  }
  emit('submit', { ...formData.value, note: formData.value.note.trim() })
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
            label: m.library.fields.relatedEntries
          })
        }}</DialogTitle>
      </DialogHeader>
      <Form @submit="handleSubmit">
        <DialogBody>
          <FieldGroup>
            <Field>
              <FieldLabel>{{ m.library.forms.mediaTypeLabel }}</FieldLabel>
              <FieldContent>
                <Select v-model="formData.targetType">
                  <SelectTrigger class="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="option in MEDIA_TYPE_OPTIONS"
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
              <FieldLabel>{{ m.library.entities[formData.targetType] }}</FieldLabel>
              <FieldContent>
                <GameSelect
                  v-if="formData.targetType === 'game'"
                  v-model="formData.targetId"
                  :exclude-ids="excludeGameIds"
                  :placeholder="
                    m.library.select.selectPlaceholder({ label: m.library.entities.game })
                  "
                />
                <AnimeSelect
                  v-else
                  v-model="formData.targetId"
                  :exclude-ids="excludeAnimeIds"
                  :placeholder="
                    m.library.select.selectPlaceholder({ label: m.library.entities.anime })
                  "
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>{{ m.library.forms.relationTypeLabel }}</FieldLabel>
              <FieldContent>
                <Select v-model="formData.type">
                  <SelectTrigger class="w-full">
                    <SelectValue :placeholder="m.library.forms.selectTypePlaceholder" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="option in RELATION_TYPE_OPTIONS"
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
              <FieldLabel>{{ m.library.fields.note }}</FieldLabel>
              <FieldContent>
                <Input
                  v-model="formData.note"
                  :placeholder="m.library.forms.notePlaceholder"
                />
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
          <Button type="submit">{{ m.common.confirm }}</Button>
        </DialogFooter>
      </Form>
    </DialogContent>
  </Dialog>
</template>
