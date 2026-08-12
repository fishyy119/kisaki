<!--
  PersonCharactersItemFormDialog
  Dialog for adding/editing a character link with type and note.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { characters, type CharacterPersonRole } from '@shared/db'
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
import { CharacterSelect } from '@renderer/components/shared/character'
import { notify } from '@renderer/core/notify'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

interface CharacterLinkData {
  characterId: string
  characterName: string
  characterPhoto: string | null
  role: CharacterPersonRole
  note: string
  isSpoiler: boolean
}

interface Props {
  initialData?: CharacterLinkData
  excludeIds: string[]
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  submit: [data: CharacterLinkData]
}>()

const PERSON_ROLE_OPTIONS = computed<{ value: CharacterPersonRole; label: string }[]>(() => [
  { value: 'actor', label: m.value.library.roles.characterPerson.actor },
  { value: 'illustration', label: m.value.library.roles.characterPerson.illustration },
  { value: 'designer', label: m.value.library.roles.characterPerson.designer },
  { value: 'other', label: m.value.library.roles.characterPerson.other }
])

// Form state
const formData = ref<CharacterLinkData>({
  characterId: '',
  characterName: '',
  characterPhoto: null,
  role: 'actor',
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
        formData.value.characterId = props.initialData.characterId
        formData.value.characterName = props.initialData.characterName
        formData.value.characterPhoto = props.initialData.characterPhoto
        formData.value.role = props.initialData.role
        formData.value.note = props.initialData.note
        formData.value.isSpoiler = props.initialData.isSpoiler
      } else {
        formData.value.characterId = ''
        formData.value.characterName = ''
        formData.value.characterPhoto = null
        formData.value.role = 'actor'
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
  return props.excludeIds.filter((id) => id !== formData.value.characterId)
})

// Watch for character selection change - async side effect to fetch character info
watch(
  () => formData.value.characterId,
  async (characterId) => {
    if (!characterId) {
      formData.value.characterName = ''
      formData.value.characterPhoto = null
      return
    }
    const character = await db.query.characters.findFirst({ where: eq(characters.id, characterId) })
    if (character) {
      formData.value.characterName = character.name
      formData.value.characterPhoto = character.photoFile
    }
  }
)

function handleSubmit() {
  if (!formData.value.characterId) {
    notify.error(
      m.value.library.forms.selectEntityRequired({ label: m.value.library.entities.character })
    )
    return
  }

  emit('submit', {
    characterId: formData.value.characterId,
    characterName: formData.value.characterName,
    characterPhoto: formData.value.characterPhoto,
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
            label: m.library.entities.character
          })
        }}</DialogTitle>
      </DialogHeader>
      <Form @submit="handleSubmit">
        <DialogBody>
          <FieldGroup>
            <Field>
              <FieldLabel>{{ m.library.forms.characterLabel }}</FieldLabel>
              <FieldContent>
                <CharacterSelect
                  v-model="formData.characterId"
                  :exclude-ids="selectExcludeIds"
                  :placeholder="
                    m.library.select.selectPlaceholder({ label: m.library.entities.character })
                  "
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>{{ m.library.fields.type }}</FieldLabel>
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
