<!--
  CompanyGamesItemFormDialog
  Dialog for adding/editing a single game link with company type.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { nanoid } from 'nanoid'
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
import { Checkbox } from '@renderer/components/ui/checkbox'
import { Field, FieldLabel, FieldContent, FieldGroup } from '@renderer/components/ui/field'
import { GameSelect } from '@renderer/components/shared/game'
import { db } from '@renderer/core/db'
import type { GameCompanyRole } from '@shared/db'
import { notify } from '@renderer/core/notify'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

const COMPANY_ROLE_OPTIONS = computed<{ value: GameCompanyRole; label: string }[]>(() => [
  { value: 'developer', label: m.value.library.roles.gameCompany.developer },
  { value: 'publisher', label: m.value.library.roles.gameCompany.publisher },
  { value: 'distributor', label: m.value.library.roles.gameCompany.distributor },
  { value: 'other', label: m.value.library.roles.gameCompany.other }
])

interface GameLinkItem {
  id: string
  gameId: string
  gameName: string
  gameCover: string | null
  role: GameCompanyRole
  note: string
  isSpoiler: boolean
  orderInCompany: number
  isNew?: boolean
}

interface Props {
  initialData?: GameLinkItem
  existingGameIds: string[]
  isAddMode: boolean
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  submit: [data: GameLinkItem]
}>()

// Form state
type FormData = Pick<
  GameLinkItem,
  'gameId' | 'gameName' | 'gameCover' | 'role' | 'note' | 'isSpoiler'
>

const formData = ref<FormData>({
  gameId: '',
  gameName: '',
  gameCover: null,
  role: 'developer',
  note: '',
  isSpoiler: false
})

// Initialize form state when dialog opens
watch(
  () => open.value,
  (isOpen) => {
    if (isOpen) {
      formData.value.gameId = props.initialData?.gameId ?? ''
      formData.value.gameName = props.initialData?.gameName ?? ''
      formData.value.gameCover = props.initialData?.gameCover ?? null
      formData.value.role = props.initialData?.role ?? 'developer'
      formData.value.note = props.initialData?.note ?? ''
      formData.value.isSpoiler = props.initialData?.isSpoiler ?? false
    }
  },
  { immediate: true }
)

const excludeIds = computed(() =>
  props.isAddMode
    ? props.existingGameIds
    : props.existingGameIds.filter((id) => id !== formData.value.gameId)
)

// Watch for game selection change - async side effect to fetch game info
watch(
  () => formData.value.gameId,
  async (gameId) => {
    if (!gameId) {
      formData.value.gameName = ''
      formData.value.gameCover = null
      return
    }
    const game = await db.query.games.findFirst({
      where: (g, { eq }) => eq(g.id, gameId)
    })
    if (game) {
      formData.value.gameName = game.name
      formData.value.gameCover = game.coverFile ?? null
    }
  }
)

function handleSubmit() {
  if (!formData.value.gameId) {
    notify.error(
      m.value.library.forms.selectEntityRequired({ label: m.value.library.entities.game })
    )
    return
  }
  emit('submit', {
    id: props.initialData?.id || nanoid(),
    gameId: formData.value.gameId,
    gameName: formData.value.gameName,
    gameCover: formData.value.gameCover,
    role: formData.value.role,
    note: formData.value.note.trim(),
    isSpoiler: formData.value.isSpoiler,
    orderInCompany: props.initialData?.orderInCompany ?? 0,
    isNew: props.isAddMode
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
          (props.isAddMode ? m.library.forms.addEntityTitle : m.library.forms.editEntityTitle)({
            label: m.library.entities.game
          })
        }}</DialogTitle>
      </DialogHeader>
      <Form @submit="handleSubmit">
        <DialogBody>
          <FieldGroup>
            <Field>
              <FieldLabel>{{ m.library.forms.gameLabel }}</FieldLabel>
              <FieldContent>
                <GameSelect
                  v-model="formData.gameId"
                  :exclude-ids="excludeIds"
                  :placeholder="
                    m.library.select.selectPlaceholder({ label: m.library.entities.game })
                  "
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>{{ m.library.forms.relationTypeLabel }}</FieldLabel>
              <FieldContent>
                <Select v-model="formData.role">
                  <SelectTrigger class="w-full">
                    <SelectValue :placeholder="m.library.forms.selectTypePlaceholder" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="option in COMPANY_ROLE_OPTIONS"
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
          <Button type="submit">{{ m.common.confirm }}</Button>
        </DialogFooter>
      </Form>
    </DialogContent>
  </Dialog>
</template>
