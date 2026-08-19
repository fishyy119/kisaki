<!--
  LinkItemFormDialog
  Dialog for adding/editing one cross-entity link row: target select, role,
  played characters, note and spoiler flag, all resolved from the view spec.
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
import { notify } from '@renderer/core/notify'
import { useI18n } from '@renderer/composables/use-i18n'
import { parsePlayingInput } from '@renderer/utils/format'
import {
  LINK_TARGET_FETCHERS,
  LINK_TARGET_META,
  LINK_VIEW_SPECS,
  type LinkViewKey,
  type LinkViewSpec
} from './link-specs'

const { m } = useI18n()

interface LinkItemData {
  targetId: string
  targetName: string
  targetImage: string | null
  role: string
  playing: string[]
  note: string
  isSpoiler: boolean
}

interface Props {
  view: LinkViewKey
  /** Initial data for editing, undefined for add mode */
  initialData?: LinkItemData
  /** Target IDs to exclude from the select */
  excludeIds: string[]
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  submit: [data: LinkItemData]
}>()

const spec = computed<LinkViewSpec>(() => LINK_VIEW_SPECS[props.view])
const targetMeta = computed(() => LINK_TARGET_META[spec.value.targetType])
const targetLabel = computed(() => m.value.library.entities[spec.value.targetType])

const roleOptions = computed(() => {
  const labels = spec.value.roleLabels(m.value)
  return spec.value.roleOrder.map((value) => ({ value, label: labels[value] }))
})

// Form state; played characters are edited as one comma-separated line
const formData = ref<Omit<LinkItemData, 'playing'>>({
  targetId: '',
  targetName: '',
  targetImage: null,
  role: spec.value.roleOrder[0],
  note: '',
  isSpoiler: false
})
const playingInput = ref('')

const isAddMode = computed(() => !props.initialData)

// Initialize form when dialog opens or initialData changes
watch(
  () => open.value,
  (isOpen) => {
    if (isOpen) {
      if (props.initialData) {
        const { playing, ...rest } = props.initialData
        formData.value = { ...rest }
        playingInput.value = playing.join(', ')
      } else {
        formData.value = {
          targetId: '',
          targetName: '',
          targetImage: null,
          role: spec.value.roleOrder[0],
          note: '',
          isSpoiler: false
        }
        playingInput.value = ''
      }
    }
  },
  { immediate: true }
)

// Compute exclude IDs for the target select
const selectExcludeIds = computed(() => {
  if (isAddMode.value) {
    return props.excludeIds
  }
  return props.excludeIds.filter((id) => id !== formData.value.targetId)
})

// Watch for target selection change - async side effect to fetch display fields
watch(
  () => formData.value.targetId,
  async (targetId) => {
    if (!targetId) {
      formData.value.targetName = ''
      formData.value.targetImage = null
      return
    }
    const target = await LINK_TARGET_FETCHERS[spec.value.targetType](targetId)
    if (target) {
      formData.value.targetName = target.name
      formData.value.targetImage = target.image
    }
  }
)

function handleSubmit() {
  if (!formData.value.targetId) {
    notify.error(m.value.library.forms.selectEntityRequired({ label: targetLabel.value }))
    return
  }

  emit('submit', {
    targetId: formData.value.targetId,
    targetName: formData.value.targetName || 'Unknown',
    targetImage: formData.value.targetImage,
    role: formData.value.role,
    playing: spec.value.supportsPlaying ? parsePlayingInput(playingInput.value) : [],
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
            label: targetLabel
          })
        }}</DialogTitle>
      </DialogHeader>
      <Form @submit="handleSubmit">
        <DialogBody>
          <FieldGroup>
            <Field>
              <FieldLabel>{{ targetLabel }}</FieldLabel>
              <FieldContent>
                <component
                  :is="targetMeta.select"
                  v-model="formData.targetId"
                  :exclude-ids="selectExcludeIds"
                  :placeholder="m.library.select.selectPlaceholder({ label: targetLabel })"
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>{{ spec.roleFieldLabel(m) }}</FieldLabel>
              <FieldContent>
                <Select v-model="formData.role">
                  <SelectTrigger class="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="opt in roleOptions"
                      :key="opt.value"
                      :value="opt.value"
                    >
                      {{ opt.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>
            <Field v-if="spec.supportsPlaying">
              <FieldLabel>{{ m.library.fields.playing }}</FieldLabel>
              <FieldContent>
                <Input
                  v-model="playingInput"
                  :placeholder="m.library.forms.playingPlaceholder"
                />
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
