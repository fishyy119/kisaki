<!--
  AnimeCharactersFormDialog
  Dialog for editing anime characters grouped by role.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { nanoid } from 'nanoid'
import { eq, asc } from 'drizzle-orm'
import { Icon } from '@renderer/components/ui/icon'
import { db } from '@renderer/core/db'
import { animeCharacterLinks } from '@shared/db'
import type { AnimeCharacterRole } from '@shared/db'
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
import { CoverImage } from '@renderer/components/ui/cover-image'
import { getAttachmentUrl } from '@renderer/utils/attachment'
import { getEntityIcon, getSpoilerDisplay } from '@renderer/utils/format'
import AnimeCharactersItemFormDialog from './character-item-form-dialog.vue'
import { createLogger } from '@renderer/core/log'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

const log = createLogger('Anime')

interface Props {
  animeId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

interface CharacterLinkItem {
  id: string
  characterId: string
  characterName: string
  characterPhoto: string | null
  role: AnimeCharacterRole
  note: string
  isSpoiler: boolean
  orderInAnime: number
  isNew?: boolean
}

const CHARACTER_ROLE_ORDER: AnimeCharacterRole[] = ['main', 'supporting', 'cameo', 'other']

const CHARACTER_ROLE_LABELS = computed<Record<string, string>>(
  () => m.value.library.roles.animeCharacter
)

// Form state
const items = ref<CharacterLinkItem[]>([])
const editingItem = ref<CharacterLinkItem | null>(null)
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

// Fetch anime characters when dialog opens
const { data: results, isLoading } = useAsyncData(
  () =>
    db.query.animeCharacterLinks.findMany({
      where: eq(animeCharacterLinks.animeId, props.animeId),
      with: { character: true },
      orderBy: asc(animeCharacterLinks.orderInAnime)
    }),
  {
    watch: [() => props.animeId],
    enabled: () => open.value
  }
)

// Initialize form state when data loads
watch(results, (data) => {
  if (data) {
    items.value = data
      .filter((link) => link.character)
      .map((link) => ({
        id: link.id,
        characterId: link.characterId,
        characterName: link.character!.name,
        characterPhoto: link.character!.photoFile,
        role: link.role,
        note: link.note || '',
        isSpoiler: link.isSpoiler,
        orderInAnime: link.orderInAnime
      }))
  }
})

// Grouped characters by role
const groupedCharacters = computed(() => {
  const grouped = Object.fromEntries(
    CHARACTER_ROLE_ORDER.map((role) => [role, [] as CharacterLinkItem[]])
  ) as Record<AnimeCharacterRole, CharacterLinkItem[]>
  items.value.forEach((item) => {
    grouped[item.role].push(item)
  })
  for (const role of CHARACTER_ROLE_ORDER) {
    grouped[role].sort((a, b) => a.orderInAnime - b.orderInAnime)
  }
  return grouped
})

// Existing character IDs for excluding from select
const existingCharacterIds = computed(() => items.value.map((item) => item.characterId))

// Pair each link with its spoiler-aware display texts and thumbnail URL
function withSpoiler(links: CharacterLinkItem[]) {
  return links.map((link) => ({
    link,
    spoiler: getSpoilerDisplay(
      link.characterName,
      link.note,
      link.isSpoiler,
      spoilersRevealed.value
    ),
    photoUrl: link.characterPhoto
      ? getAttachmentUrl('characters', link.characterId, link.characterPhoto, {
          width: 100,
          height: 100
        })
      : null
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
    characterId: editingItem.value.characterId,
    characterName: editingItem.value.characterName,
    characterPhoto: editingItem.value.characterPhoto,
    role: editingItem.value.role,
    note: editingItem.value.note,
    isSpoiler: editingItem.value.isSpoiler
  }
})

async function handleSave() {
  isSaving.value = true
  try {
    await db.delete(animeCharacterLinks).where(eq(animeCharacterLinks.animeId, props.animeId))

    if (items.value.length > 0) {
      const linksToInsert: {
        id: string
        animeId: string
        characterId: string
        isSpoiler: boolean
        role: AnimeCharacterRole
        note: string | null
        orderInAnime: number
      }[] = []

      for (const role of CHARACTER_ROLE_ORDER) {
        const roleLinks = groupedCharacters.value[role]
        roleLinks.forEach((link, index) => {
          linksToInsert.push({
            id: link.isNew ? nanoid() : link.id,
            animeId: props.animeId,
            characterId: link.characterId,
            isSpoiler: link.isSpoiler,
            role: link.role,
            note: link.note || null,
            orderInAnime: index
          })
        })
      }

      if (linksToInsert.length > 0) {
        await db.insert(animeCharacterLinks).values(linksToInsert)
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

function handleMoveUp(role: AnimeCharacterRole, index: number) {
  if (index <= 0) return
  const roleLinks = [...groupedCharacters.value[role]]
  ;[roleLinks[index - 1], roleLinks[index]] = [roleLinks[index], roleLinks[index - 1]]
  roleLinks.forEach((link, i) => {
    link.orderInAnime = i
  })
  const otherItems = items.value.filter((item) => item.role !== role)
  items.value = [...otherItems, ...roleLinks]
}

function handleMoveDown(role: AnimeCharacterRole, index: number) {
  const roleLinks = [...groupedCharacters.value[role]]
  if (index >= roleLinks.length - 1) return
  ;[roleLinks[index], roleLinks[index + 1]] = [roleLinks[index + 1], roleLinks[index]]
  roleLinks.forEach((link, i) => {
    link.orderInAnime = i
  })
  const otherItems = items.value.filter((item) => item.role !== role)
  items.value = [...otherItems, ...roleLinks]
}

function handleRemove(id: string) {
  items.value = items.value.filter((item) => item.id !== id)
  deleteId.value = null
}

function handleEdit(item: CharacterLinkItem) {
  editingItem.value = { ...item }
  isAddMode.value = false
  itemFormOpen.value = true
}

function handleAddNew() {
  editingItem.value = {
    id: nanoid(),
    characterId: '',
    characterName: '',
    characterPhoto: null,
    role: 'main',
    note: '',
    isSpoiler: false,
    orderInAnime: items.value.length,
    isNew: true
  }
  isAddMode.value = true
  itemFormOpen.value = true
}

function handleItemFormSubmit(data: {
  characterId: string
  characterName: string
  characterPhoto: string | null
  role: AnimeCharacterRole
  note: string
  isSpoiler: boolean
}) {
  const updatedItem: CharacterLinkItem = {
    id: editingItem.value!.id,
    characterId: data.characterId,
    characterName: data.characterName,
    characterPhoto: data.characterPhoto,
    role: data.role,
    note: data.note,
    isSpoiler: data.isSpoiler,
    orderInAnime: editingItem.value!.orderInAnime,
    isNew: editingItem.value!.isNew
  }

  if (isAddMode.value) {
    const roleLinks = groupedCharacters.value[updatedItem.role]
    updatedItem.orderInAnime = roleLinks.length
    items.value.push(updatedItem)
  } else {
    const index = items.value.findIndex((item) => item.id === updatedItem.id)
    if (index !== -1) {
      if (editingItem.value && editingItem.value.role !== updatedItem.role) {
        const newRoleLinks = groupedCharacters.value[updatedItem.role]
        updatedItem.orderInAnime = newRoleLinks.length
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
          <DialogTitle>{{ m.library.forms.editAnimeCharacters }}</DialogTitle>
        </DialogHeader>
        <DialogBody class="overflow-auto max-h-[60vh]">
          <div class="space-y-4">
            <p
              v-if="items.length === 0"
              class="text-sm text-muted-foreground text-center py-8"
            >
              {{ m.library.forms.emptyListHint({ label: m.library.entities.character }) }}
            </p>
            <template v-else>
              <template
                v-for="role in CHARACTER_ROLE_ORDER"
                :key="role"
              >
                <div v-if="groupedCharacters[role].length > 0">
                  <h4 class="text-xs font-medium text-muted-foreground mb-2">
                    {{ CHARACTER_ROLE_LABELS[role] }}
                  </h4>
                  <div class="space-y-1">
                    <ListItem
                      v-for="({ link, spoiler, photoUrl }, index) in withSpoiler(
                        groupedCharacters[role]
                      )"
                      :key="link.id"
                      :icon="
                        spoiler.hidden ? 'icon-[mdi--eye-off-outline]' : getEntityIcon('character')
                      "
                      :title="spoiler.name"
                      :description="spoiler.note"
                    >
                      <template
                        v-if="photoUrl && !spoiler.hidden"
                        #leading
                      >
                        <CoverImage
                          :src="photoUrl"
                          :alt="spoiler.name"
                          class="size-10 shrink-0 rounded-md border shadow-raised"
                        />
                      </template>
                      <template
                        v-if="!spoiler.hidden"
                        #actions
                      >
                        <ListItemActions
                          movable
                          :is-first="index === 0"
                          :is-last="index === groupedCharacters[role].length - 1"
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
            {{ m.library.detail.addEntity({ label: m.library.entities.character }) }}
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
    :entity-label="m.library.forms.linkLabels.character"
    mode="remove"
    @confirm="deleteId !== null && handleRemove(deleteId)"
  />

  <!-- Character item form dialog -->
  <AnimeCharactersItemFormDialog
    v-if="itemFormOpen"
    v-model:open="itemFormOpen"
    :initial-data="itemFormInitialData"
    :exclude-ids="existingCharacterIds"
    @submit="handleItemFormSubmit"
  />

  <SpoilerConfirmDialog
    v-if="spoilerConfirmOpen"
    v-model:open="spoilerConfirmOpen"
    @confirm="handleRevealSpoilersConfirm"
  />
</template>
