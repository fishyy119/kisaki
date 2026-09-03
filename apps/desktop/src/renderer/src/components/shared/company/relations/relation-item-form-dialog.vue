<!--
  CompanyRelationItemFormDialog
  Dialog for adding/editing a single company relation as seen from the owning
  company: the other company, the relation type, and an optional note.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { COMPANY_RELATION_TYPES, type CompanyRelationType } from '@shared/db'
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
import { CompanySelect } from '@renderer/components/shared/company'
import { queryEntityNames } from '@renderer/core/db'
import { notify } from '@renderer/core/notify'
import { useI18n } from '@renderer/composables/use-i18n'

export interface CompanyRelationDraft {
  targetId: string
  targetName: string
  type: CompanyRelationType
  note: string
}

interface Props {
  initialData?: CompanyRelationDraft
  /** Ids already spoken for: the owning company and every listed target. */
  excludeIds: string[]
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  submit: [data: CompanyRelationDraft]
}>()

const { m } = useI18n()

const isAddMode = computed(() => !props.initialData)

const RELATION_TYPE_OPTIONS = computed(() =>
  COMPANY_RELATION_TYPES.map((type) => ({
    value: type,
    label: m.value.library.companyRelation[type]
  }))
)

// Placeholder until the immediate open watcher seeds the real draft from props.
const formData = ref<CompanyRelationDraft>({
  targetId: '',
  targetName: '',
  type: 'parent',
  note: ''
})

const selectExcludeIds = computed(() =>
  isAddMode.value
    ? props.excludeIds
    : props.excludeIds.filter((id) => id !== formData.value.targetId)
)

// Initialize form state when dialog opens.
watch(
  () => open.value,
  (isOpen) => {
    if (!isOpen) return
    formData.value = props.initialData
      ? { ...props.initialData }
      : { targetId: '', targetName: '', type: 'parent', note: '' }
  },
  { immediate: true }
)

watch(
  () => formData.value.targetId,
  async (targetId) => {
    if (!targetId) {
      formData.value.targetName = ''
      return
    }
    const [row] = await queryEntityNames('company', [targetId], true)
    formData.value.targetName = row?.name ?? ''
  }
)

function handleSubmit() {
  if (!formData.value.targetId) {
    notify.error(
      m.value.library.forms.selectEntityRequired({ label: m.value.library.entities.company })
    )
    return
  }
  emit('submit', { ...formData.value, note: formData.value.note.trim() })
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent size="sm">
      <DialogHeader>
        <DialogTitle>{{
          (isAddMode ? m.library.forms.addEntityTitle : m.library.forms.editEntityTitle)({
            label: m.library.fields.companyRelations
          })
        }}</DialogTitle>
      </DialogHeader>
      <Form @submit="handleSubmit">
        <DialogBody>
          <FieldGroup>
            <Field>
              <FieldLabel>{{ m.library.entities.company }}</FieldLabel>
              <FieldContent>
                <CompanySelect
                  v-model="formData.targetId"
                  :exclude-ids="selectExcludeIds"
                  :placeholder="
                    m.library.select.selectPlaceholder({ label: m.library.entities.company })
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
            @click="open = false"
          >
            {{ m.actions.cancel }}
          </Button>
          <Button type="submit">{{ m.actions.confirm }}</Button>
        </DialogFooter>
      </Form>
    </DialogContent>
  </Dialog>
</template>
