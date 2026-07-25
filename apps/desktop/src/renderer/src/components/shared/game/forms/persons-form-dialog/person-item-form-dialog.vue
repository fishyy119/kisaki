<!--
  GamePersonsItemFormDialog
  Dialog for adding/editing a person link with type and note.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { db } from '@renderer/core/db'
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
import { PersonSelect } from '@renderer/components/shared/person'
import { notify } from '@renderer/core/notify'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

type PersonType =
  'director' | 'scenario' | 'illustration' | 'music' | 'programmer' | 'actor' | 'other'

interface PersonLinkData {
  personId: string
  personName: string
  type: PersonType
  note: string
  isSpoiler: boolean
}

interface Props {
  initialData?: PersonLinkData
  excludeIds: string[]
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  submit: [data: PersonLinkData]
}>()

const PERSON_TYPE_OPTIONS = computed<{ value: PersonType; label: string }[]>(() => [
  { value: 'director', label: m.value.library.roles.gamePerson.director },
  { value: 'scenario', label: m.value.library.roles.gamePerson.scenario },
  { value: 'illustration', label: m.value.library.roles.gamePerson.illustration },
  { value: 'music', label: m.value.library.roles.gamePerson.music },
  { value: 'programmer', label: m.value.library.roles.gamePerson.programmer },
  { value: 'actor', label: m.value.library.roles.gamePerson.actor },
  { value: 'other', label: m.value.library.roles.gamePerson.other }
])

// Form state
const formData = ref<PersonLinkData>({
  personId: '',
  personName: '',
  type: 'director',
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
        formData.value.personId = props.initialData.personId
        formData.value.personName = props.initialData.personName
        formData.value.type = props.initialData.type
        formData.value.note = props.initialData.note
        formData.value.isSpoiler = props.initialData.isSpoiler
      } else {
        formData.value.personId = ''
        formData.value.personName = ''
        formData.value.type = 'director'
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
  return props.excludeIds.filter((id) => id !== formData.value.personId)
})

// Watch for person selection change - async side effect to fetch person name
watch(
  () => formData.value.personId,
  async (personId) => {
    if (!personId) {
      formData.value.personName = ''
      return
    }
    const person = await db.query.persons.findFirst({
      where: (p, { eq }) => eq(p.id, personId)
    })
    if (person) {
      formData.value.personName = person.name
    }
  }
)

function handleSubmit() {
  if (!formData.value.personId) {
    notify.error(
      m.value.library.forms.selectEntityRequired({ label: m.value.library.entities.person })
    )
    return
  }

  emit('submit', {
    personId: formData.value.personId,
    personName: formData.value.personName || 'Unknown',
    type: formData.value.type,
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
            label: m.library.entities.person
          })
        }}</DialogTitle>
      </DialogHeader>
      <Form @submit="handleSubmit">
        <DialogBody>
          <FieldGroup>
            <Field>
              <FieldLabel>{{ m.library.forms.personLabel }}</FieldLabel>
              <FieldContent>
                <PersonSelect
                  v-model="formData.personId"
                  :exclude-ids="selectExcludeIds"
                  :placeholder="
                    m.library.select.selectPlaceholder({ label: m.library.entities.person })
                  "
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>{{ m.library.forms.personRoleLabel }}</FieldLabel>
              <FieldContent>
                <Select v-model="formData.type">
                  <SelectTrigger class="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="opt in PERSON_TYPE_OPTIONS"
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
