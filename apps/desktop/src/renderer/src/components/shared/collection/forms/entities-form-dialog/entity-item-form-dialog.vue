<!--
  CollectionEntitiesItemFormDialog
  Dialog for adding or editing an entity link in a collection.
-->
<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { notify } from '@renderer/core/notify'
import { db } from '@renderer/core/db'
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
import { GameSelect } from '@renderer/components/shared/game'
import { AnimeSelect } from '@renderer/components/shared/anime'
import { CharacterSelect } from '@renderer/components/shared/character'
import { PersonSelect } from '@renderer/components/shared/person'
import { CompanySelect } from '@renderer/components/shared/company'
import type { ContentEntityType } from '@shared/common'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

interface EntityLink {
  id: string
  entityId: string
  entityName: string
  entityType: ContentEntityType
  note: string
  orderInCollection: number
  isNew?: boolean
}

interface EntityConfig {
  label: string
}

const ENTITY_CONFIG = computed<Record<ContentEntityType, EntityConfig>>(() => ({
  game: { label: m.value.library.entities.game },
  anime: { label: m.value.library.entities.anime },
  character: { label: m.value.library.entities.character },
  person: { label: m.value.library.entities.person },
  company: { label: m.value.library.entities.company }
}))

interface Props {
  entityType: ContentEntityType
  initialData?: EntityLink
  existingEntityIds: string[]
  isAddMode: boolean
}

const props = defineProps<Props>()
const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  submit: [data: EntityLink]
}>()

// Form state
type FormData = Pick<EntityLink, 'entityId' | 'entityName' | 'note'>

const formData = ref<FormData>({
  entityId: '',
  entityName: '',
  note: ''
})

// Initialize form when dialog opens
watch(
  () => open.value,
  (isOpen) => {
    if (isOpen) {
      formData.value.entityId = props.initialData?.entityId || ''
      formData.value.entityName = props.initialData?.entityName || ''
      formData.value.note = props.initialData?.note || ''
    }
  },
  { immediate: true }
)

// Watch for entity selection change - async side effect to fetch entity name
watch(
  () => formData.value.entityId,
  async (id) => {
    if (!id) {
      formData.value.entityName = ''
      return
    }

    let name = 'Unknown'

    switch (props.entityType) {
      case 'game': {
        const entity = await db.query.games.findFirst({
          where: eq(db._.fullSchema.games.id, id)
        })
        if (entity) name = entity.name
        break
      }
      case 'anime': {
        const entity = await db.query.animes.findFirst({
          where: eq(db._.fullSchema.animes.id, id)
        })
        if (entity) name = entity.name
        break
      }
      case 'character': {
        const entity = await db.query.characters.findFirst({
          where: eq(db._.fullSchema.characters.id, id)
        })
        if (entity) name = entity.name
        break
      }
      case 'person': {
        const entity = await db.query.persons.findFirst({
          where: eq(db._.fullSchema.persons.id, id)
        })
        if (entity) name = entity.name
        break
      }
      case 'company': {
        const entity = await db.query.companies.findFirst({
          where: eq(db._.fullSchema.companies.id, id)
        })
        if (entity) name = entity.name
        break
      }
      default:
        props.entityType satisfies never
    }

    formData.value.entityName = name
  }
)

function handleSubmit() {
  if (!formData.value.entityId) {
    notify.error(
      m.value.library.forms.selectEntityRequired({
        label: ENTITY_CONFIG.value[props.entityType].label
      })
    )
    return
  }
  emit('submit', {
    id: props.initialData?.id || nanoid(),
    entityId: formData.value.entityId,
    entityName: formData.value.entityName || 'Unknown',
    entityType: props.entityType,
    note: formData.value.note.trim(),
    orderInCollection: props.initialData?.orderInCollection ?? 0,
    isNew: props.isAddMode
  })
  open.value = false
}

const excludeIds = computed(() => {
  if (props.isAddMode) {
    return props.existingEntityIds
  }
  return props.existingEntityIds.filter((id) => id !== props.initialData?.entityId)
})

const config = computed(() => ENTITY_CONFIG.value[props.entityType])
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-sm">
      <DialogHeader>
        <DialogTitle>{{
          (props.isAddMode ? m.library.forms.addEntityTitle : m.library.forms.editEntityTitle)({
            label: config.label
          })
        }}</DialogTitle>
      </DialogHeader>
      <Form @submit="handleSubmit">
        <DialogBody>
          <FieldGroup>
            <Field>
              <FieldLabel>{{ config.label }}</FieldLabel>
              <FieldContent>
                <GameSelect
                  v-if="props.entityType === 'game'"
                  v-model="formData.entityId"
                  :exclude-ids="excludeIds"
                  :placeholder="m.library.select.selectPlaceholder({ label: config.label })"
                />
                <AnimeSelect
                  v-else-if="props.entityType === 'anime'"
                  v-model="formData.entityId"
                  :exclude-ids="excludeIds"
                  :placeholder="m.library.select.selectPlaceholder({ label: config.label })"
                />
                <CharacterSelect
                  v-else-if="props.entityType === 'character'"
                  v-model="formData.entityId"
                  :exclude-ids="excludeIds"
                  :placeholder="m.library.select.selectPlaceholder({ label: config.label })"
                />
                <PersonSelect
                  v-else-if="props.entityType === 'person'"
                  v-model="formData.entityId"
                  :exclude-ids="excludeIds"
                  :placeholder="m.library.select.selectPlaceholder({ label: config.label })"
                />
                <CompanySelect
                  v-else-if="props.entityType === 'company'"
                  v-model="formData.entityId"
                  :exclude-ids="excludeIds"
                  :placeholder="m.library.select.selectPlaceholder({ label: config.label })"
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
          <Button type="submit">{{ m.common.save }}</Button>
        </DialogFooter>
      </Form>
    </DialogContent>
  </Dialog>
</template>
