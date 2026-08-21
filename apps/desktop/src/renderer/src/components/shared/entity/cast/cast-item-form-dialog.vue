<!--
  EntityCastItemFormDialog
  Dialog for adding or editing one voice credit: the character, the person who
  voices them here, and an optional note.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Field, FieldLabel, FieldContent, FieldGroup } from '@renderer/components/ui/field'
import { Form } from '@renderer/components/ui/form'
import { CharacterSelect } from '@renderer/components/shared/character'
import { PersonSelect } from '@renderer/components/shared/person'
import { notify } from '@renderer/core/notify'
import { db } from '@renderer/core/db'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

export interface CastItemData {
  characterId: string
  characterName: string
  characterImage: string | null
  personId: string
  personName: string
  personImage: string | null
  note: string
}

interface Props {
  initialData?: CastItemData
  /** Pairs already in the entry, as `characterId:personId`, to reject duplicates. */
  existingPairs: string[]
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  submit: [data: CastItemData]
}>()

const formData = ref<CastItemData>(emptyForm())

const isAddMode = computed(() => !props.initialData)

watch(
  () => open.value,
  (isOpen) => {
    if (isOpen) {
      formData.value = props.initialData ? { ...props.initialData } : emptyForm()
    }
  },
  { immediate: true }
)

// Display fields are fetched per endpoint so the saved row can render without
// re-reading the table it came from.
watch(
  () => formData.value.characterId,
  async (characterId) => {
    if (!characterId) {
      formData.value.characterName = ''
      formData.value.characterImage = null
      return
    }
    const row = await db.query.characters.findFirst({
      where: (t, { eq }) => eq(t.id, characterId)
    })
    if (row) {
      formData.value.characterName = row.name
      formData.value.characterImage = row.photoFile
    }
  }
)

watch(
  () => formData.value.personId,
  async (personId) => {
    if (!personId) {
      formData.value.personName = ''
      formData.value.personImage = null
      return
    }
    const row = await db.query.persons.findFirst({ where: (t, { eq }) => eq(t.id, personId) })
    if (row) {
      formData.value.personName = row.name
      formData.value.personImage = row.photoFile
    }
  }
)

function emptyForm(): CastItemData {
  return {
    characterId: '',
    characterName: '',
    characterImage: null,
    personId: '',
    personName: '',
    personImage: null,
    note: ''
  }
}

function handleSubmit() {
  const { characterId, personId } = formData.value
  if (!characterId) {
    notify.error(
      m.value.library.forms.selectEntityRequired({ label: m.value.library.entities.character })
    )
    return
  }
  if (!personId) {
    notify.error(
      m.value.library.forms.selectEntityRequired({ label: m.value.library.entities.person })
    )
    return
  }

  const pair = `${characterId}:${personId}`
  const isUnchangedPair =
    props.initialData &&
    props.initialData.characterId === characterId &&
    props.initialData.personId === personId
  if (!isUnchangedPair && props.existingPairs.includes(pair)) {
    notify.error(m.value.library.forms.castDuplicate)
    return
  }

  emit('submit', { ...formData.value, note: formData.value.note.trim() })
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-md">
      <Form @submit="handleSubmit">
        <DialogHeader>
          <DialogTitle>
            {{
              isAddMode
                ? m.library.detail.addEntity({ label: m.library.fields.cast })
                : m.library.forms.editGameCast
            }}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <FieldGroup>
            <Field>
              <FieldLabel>{{ m.library.forms.castCharacterLabel }}</FieldLabel>
              <FieldContent>
                <CharacterSelect v-model="formData.characterId" />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>{{ m.library.forms.castPersonLabel }}</FieldLabel>
              <FieldContent>
                <PersonSelect v-model="formData.personId" />
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
            @click="open = false"
          >
            {{ m.common.cancel }}
          </Button>
          <Button type="submit">
            {{ m.common.confirm }}
          </Button>
        </DialogFooter>
      </Form>
    </DialogContent>
  </Dialog>
</template>
