<!--
  CharacterPersonsFormDialog
  Dialog for editing character persons grouped by type.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { nanoid } from 'nanoid'
import { eq, asc } from 'drizzle-orm'
import { Icon } from '@renderer/components/ui/icon'
import { db } from '@renderer/core/db'
import { characterPersonLinks, type CharacterPersonRole } from '@shared/db'
import { useAsyncData } from '@renderer/composables'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { StateView } from '@renderer/components/ui/state-view'
import { DeleteConfirmDialog } from '@renderer/components/ui/delete-confirm-dialog'
import { SpoilerConfirmDialog } from '@renderer/components/ui/spoiler-confirm-dialog'
import { Button } from '@renderer/components/ui/button'
import { notify } from '@renderer/core/notify'
import { ListItem, ListItemActions } from '@renderer/components/ui/list-item'
import { getEntityIcon, getSpoilerDisplay } from '@renderer/utils/format'
import CharacterPersonsItemFormDialog from './person-item-form-dialog.vue'
import { createLogger } from '@renderer/core/log'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

const log = createLogger('Character')

interface Props {
  characterId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

interface PersonLinkItem {
  id: string
  personId: string
  personName: string
  role: CharacterPersonRole
  note: string
  isSpoiler: boolean
  orderInCharacter: number
  isNew?: boolean
}

const PERSON_ROLE_LABELS = computed<Record<string, string>>(() => ({
  actor: m.value.library.roles.characterPerson.actor,
  illustration: m.value.library.roles.characterPerson.illustration,
  designer: m.value.library.roles.characterPerson.designer,
  other: m.value.library.roles.characterPerson.other
}))

const PERSON_ROLE_ORDER: CharacterPersonRole[] = ['actor', 'illustration', 'designer', 'other']

// Form state
const items = ref<PersonLinkItem[]>([])
const editingItem = ref<PersonLinkItem | null>(null)
const isAddMode = ref(false)
const deleteId = ref<string | null>(null)
const isSaving = ref(false)
const itemFormOpen = ref(false)
const spoilersRevealed = ref(false)
const spoilerConfirmOpen = ref(false)

watch(
  () => open.value,
  (isOpen) => {
    if (!isOpen) {
      spoilersRevealed.value = false
      spoilerConfirmOpen.value = false
    }
  }
)

// Fetch character persons when dialog opens
const { data: results, isLoading } = useAsyncData(
  () =>
    db.query.characterPersonLinks.findMany({
      where: eq(characterPersonLinks.characterId, props.characterId),
      with: { person: true },
      orderBy: asc(characterPersonLinks.orderInCharacter)
    }),
  {
    watch: [() => props.characterId],
    enabled: () => open.value
  }
)

// Initialize form state when data loads
watch(results, (data) => {
  if (data) {
    items.value = data
      .filter((link) => link.person)
      .map((link) => ({
        id: link.id,
        personId: link.personId,
        personName: link.person!.name,
        role: (link.role || 'other') as CharacterPersonRole,
        note: link.note || '',
        isSpoiler: link.isSpoiler,
        orderInCharacter: link.orderInCharacter
      }))
  }
})

// Grouped persons by type
const groupedPersons = computed(() => {
  const grouped: Record<CharacterPersonRole, PersonLinkItem[]> = {
    actor: [],
    illustration: [],
    designer: [],
    other: []
  }
  items.value.forEach((item) => {
    grouped[item.role].push(item)
  })
  for (const role of PERSON_ROLE_ORDER) {
    grouped[role].sort((a, b) => a.orderInCharacter - b.orderInCharacter)
  }
  return grouped
})

// Existing person IDs for excluding from select
const existingPersonIds = computed(() => items.value.map((item) => item.personId))

// Pair each link with its spoiler-aware display texts
function withSpoiler(links: PersonLinkItem[]) {
  return links.map((link) => ({
    link,
    spoiler: getSpoilerDisplay(link.personName, link.note, link.isSpoiler, spoilersRevealed.value)
  }))
}

// Delete dialog state
const deleteDialogOpen = computed({
  get: () => deleteId.value !== null,
  set: (v) => {
    if (!v) deleteId.value = null
  }
})

// Item form initial data
const itemFormInitialData = computed(() => {
  if (!editingItem.value || isAddMode.value) return undefined
  return {
    personId: editingItem.value.personId,
    personName: editingItem.value.personName,
    role: editingItem.value.role,
    note: editingItem.value.note,
    isSpoiler: editingItem.value.isSpoiler
  }
})

async function handleSave() {
  isSaving.value = true
  try {
    await db
      .delete(characterPersonLinks)
      .where(eq(characterPersonLinks.characterId, props.characterId))

    if (items.value.length > 0) {
      const linksToInsert: {
        id: string
        characterId: string
        personId: string
        isSpoiler: boolean
        role: CharacterPersonRole
        note: string | null
        orderInCharacter: number
      }[] = []

      for (const role of PERSON_ROLE_ORDER) {
        const roleLinks = groupedPersons.value[role]
        roleLinks.forEach((link, index) => {
          linksToInsert.push({
            id: link.isNew ? nanoid() : link.id,
            characterId: props.characterId,
            personId: link.personId,
            isSpoiler: link.isSpoiler,
            role: link.role,
            note: link.note || null,
            orderInCharacter: index
          })
        })
      }

      if (linksToInsert.length > 0) {
        await db.insert(characterPersonLinks).values(linksToInsert)
      }
    }

    notify.success(m.value.common.saved)
    open.value = false
  } catch (error) {
    log.error('Save failed:', error)
    notify.error(m.value.library.feedback.saveFailedRetry)
  } finally {
    isSaving.value = false
  }
}

function handleMoveUp(role: CharacterPersonRole, index: number) {
  if (index <= 0) return
  const roleLinks = [...groupedPersons.value[role]]
  ;[roleLinks[index - 1], roleLinks[index]] = [roleLinks[index], roleLinks[index - 1]]
  roleLinks.forEach((link, i) => {
    link.orderInCharacter = i
  })
  const otherItems = items.value.filter((item) => item.role !== role)
  items.value = [...otherItems, ...roleLinks]
}

function handleMoveDown(role: CharacterPersonRole, index: number) {
  const roleLinks = [...groupedPersons.value[role]]
  if (index >= roleLinks.length - 1) return
  ;[roleLinks[index], roleLinks[index + 1]] = [roleLinks[index + 1], roleLinks[index]]
  roleLinks.forEach((link, i) => {
    link.orderInCharacter = i
  })
  const otherItems = items.value.filter((item) => item.role !== role)
  items.value = [...otherItems, ...roleLinks]
}

function handleRemove(id: string) {
  items.value = items.value.filter((item) => item.id !== id)
  deleteId.value = null
}

function handleEdit(item: PersonLinkItem) {
  editingItem.value = { ...item }
  isAddMode.value = false
  itemFormOpen.value = true
}

function handleAddNew() {
  editingItem.value = {
    id: nanoid(),
    personId: '',
    personName: '',
    role: 'actor',
    note: '',
    isSpoiler: false,
    orderInCharacter: items.value.length,
    isNew: true
  }
  isAddMode.value = true
  itemFormOpen.value = true
}

function handleItemFormSubmit(data: {
  personId: string
  personName: string
  role: CharacterPersonRole
  note: string
  isSpoiler: boolean
}) {
  const updatedItem: PersonLinkItem = {
    id: editingItem.value!.id,
    personId: data.personId,
    personName: data.personName,
    role: data.role,
    note: data.note,
    isSpoiler: data.isSpoiler,
    orderInCharacter: editingItem.value!.orderInCharacter,
    isNew: editingItem.value!.isNew
  }

  if (isAddMode.value) {
    const roleLinks = groupedPersons.value[updatedItem.role]
    updatedItem.orderInCharacter = roleLinks.length
    items.value.push(updatedItem)
  } else {
    const index = items.value.findIndex((item) => item.id === updatedItem.id)
    if (index !== -1) {
      if (editingItem.value && editingItem.value.role !== updatedItem.role) {
        const newRoleLinks = groupedPersons.value[updatedItem.role]
        updatedItem.orderInCharacter = newRoleLinks.length
      }
      items.value[index] = updatedItem
    }
  }

  itemFormOpen.value = false
  editingItem.value = null
  isAddMode.value = false
}

function handleCancel() {
  open.value = false
}

function handleToggleSpoilers() {
  if (spoilersRevealed.value) {
    spoilersRevealed.value = false
    return
  }
  spoilerConfirmOpen.value = true
}

function handleRevealSpoilersConfirm() {
  spoilersRevealed.value = true
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-lg">
      <!-- Loading state -->
      <template v-if="isLoading || !results">
        <DialogBody>
          <StateView
            state="loading"
            class="py-8"
          />
        </DialogBody>
      </template>

      <!-- Form content -->
      <template v-else>
        <DialogHeader>
          <DialogTitle>{{ m.library.forms.editCharacterPersons }}</DialogTitle>
        </DialogHeader>
        <DialogBody class="overflow-auto max-h-[60vh]">
          <div class="space-y-4">
            <p
              v-if="items.length === 0"
              class="text-sm text-muted-foreground text-center py-8"
            >
              {{ m.library.forms.emptyListHint({ label: m.library.entities.person }) }}
            </p>
            <template v-else>
              <template
                v-for="role in PERSON_ROLE_ORDER"
                :key="role"
              >
                <div v-if="groupedPersons[role].length > 0">
                  <h4 class="text-xs font-medium text-muted-foreground mb-2">
                    {{ PERSON_ROLE_LABELS[role] }}
                  </h4>
                  <div class="space-y-1">
                    <ListItem
                      v-for="({ link, spoiler }, index) in withSpoiler(groupedPersons[role])"
                      :key="link.id"
                      :icon="
                        spoiler.hidden ? 'icon-[mdi--eye-off-outline]' : getEntityIcon('person')
                      "
                      :title="spoiler.name"
                      :description="spoiler.note"
                    >
                      <template
                        v-if="!spoiler.hidden"
                        #actions
                      >
                        <ListItemActions
                          movable
                          :is-first="index === 0"
                          :is-last="index === groupedPersons[role].length - 1"
                          @move-up="handleMoveUp(role, index)"
                          @move-down="handleMoveDown(role, index)"
                          @edit="handleEdit(link)"
                          @delete="deleteId = link.id"
                        />
                      </template>
                    </ListItem>
                  </div>
                </div>
              </template>
            </template>
          </div>
        </DialogBody>
        <DialogFooter class="flex justify-between">
          <Button
            variant="outline"
            @click="handleAddNew"
          >
            <Icon
              icon="icon-[mdi--plus]"
              class="size-4 mr-1.5"
            />
            {{ m.library.detail.addEntity({ label: m.library.entities.person }) }}
          </Button>
          <div class="flex gap-2">
            <Button
              variant="outline"
              @click="handleToggleSpoilers"
            >
              <Icon
                :icon="spoilersRevealed ? 'icon-[mdi--eye-off-outline]' : 'icon-[mdi--eye-outline]'"
                class="size-4 mr-1.5"
              />
              {{ spoilersRevealed ? m.library.forms.hideSpoilers : m.library.forms.showSpoilers }}
            </Button>
            <Button
              variant="outline"
              @click="handleCancel"
            >
              {{ m.common.cancel }}
            </Button>
            <Button
              :disabled="isSaving"
              @click="handleSave"
            >
              {{ m.common.save }}
            </Button>
          </div>
        </DialogFooter>
      </template>
    </DialogContent>
  </Dialog>

  <!-- Delete confirmation dialog -->
  <DeleteConfirmDialog
    v-if="deleteDialogOpen"
    v-model:open="deleteDialogOpen"
    :entity-label="m.library.forms.linkLabels.person"
    mode="remove"
    @confirm="deleteId !== null && handleRemove(deleteId)"
  />

  <!-- Person item form dialog -->
  <CharacterPersonsItemFormDialog
    v-if="itemFormOpen"
    v-model:open="itemFormOpen"
    :initial-data="itemFormInitialData"
    :exclude-ids="existingPersonIds"
    @submit="handleItemFormSubmit"
  />

  <SpoilerConfirmDialog
    v-if="spoilerConfirmOpen"
    v-model:open="spoilerConfirmOpen"
    @confirm="handleRevealSpoilersConfirm"
  />
</template>
