<!--
  CharacterGamesItemFormDialog
  Dialog for adding/editing a game link with role type and note.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { db } from '@renderer/core/db'
import type { GameCharacterRole } from '@shared/db'
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
import { GameSelect } from '@renderer/components/shared/game'
import { notify } from '@renderer/core/notify'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

interface GameLinkData {
  gameId: string
  gameName: string
  gameCover: string | null
  role: GameCharacterRole
  note: string
  isSpoiler: boolean
}

interface Props {
  initialData?: GameLinkData
  excludeIds: string[]
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  submit: [data: GameLinkData]
}>()

const CHARACTER_ROLE_OPTIONS = computed<{ value: GameCharacterRole; label: string }[]>(() => [
  { value: 'main', label: m.value.library.roles.gameCharacter.main },
  { value: 'supporting', label: m.value.library.roles.gameCharacter.supporting },
  { value: 'cameo', label: m.value.library.roles.gameCharacter.cameo },
  { value: 'other', label: m.value.library.roles.gameCharacter.other }
])

// Form state
const formData = ref<GameLinkData>({
  gameId: '',
  gameName: '',
  gameCover: null,
  role: 'main',
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
        formData.value.gameId = props.initialData.gameId
        formData.value.gameName = props.initialData.gameName
        formData.value.gameCover = props.initialData.gameCover
        formData.value.role = props.initialData.role
        formData.value.note = props.initialData.note
        formData.value.isSpoiler = props.initialData.isSpoiler
      } else {
        formData.value.gameId = ''
        formData.value.gameName = ''
        formData.value.gameCover = null
        formData.value.role = 'main'
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
  return props.excludeIds.filter((id) => id !== formData.value.gameId)
})

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
      formData.value.gameCover = game.coverFile || null
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
    gameId: formData.value.gameId,
    gameName: formData.value.gameName || 'Unknown',
    gameCover: formData.value.gameCover,
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
                  :exclude-ids="selectExcludeIds"
                  :placeholder="
                    m.library.select.selectPlaceholder({ label: m.library.entities.game })
                  "
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>{{ m.library.forms.characterRoleLabel }}</FieldLabel>
              <FieldContent>
                <Select v-model="formData.role">
                  <SelectTrigger class="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="opt in CHARACTER_ROLE_OPTIONS"
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
