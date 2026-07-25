<!--
  PersonGamesFormDialog
  Dialog for editing person's related games grouped by role.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { nanoid } from 'nanoid'
import { eq, asc } from 'drizzle-orm'
import { Icon } from '@renderer/components/ui/icon'
import { db } from '@renderer/core/db'
import { gamePersonLinks, type GamePersonType } from '@shared/db'
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
import PersonGamesItemFormDialog from './game-item-form-dialog.vue'
import { createLogger } from '@renderer/core/log'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

const log = createLogger('Person')

interface Props {
  personId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

interface GameLinkItem {
  id: string
  gameId: string
  gameName: string
  gameCover: string | null
  type: GamePersonType
  note: string
  isSpoiler: boolean
  orderInPerson: number
  isNew?: boolean
}

const PERSON_TYPE_LABELS = computed<Record<string, string>>(() => ({
  director: m.value.library.roles.gamePerson.director,
  scenario: m.value.library.roles.gamePerson.scenario,
  illustration: m.value.library.roles.gamePerson.illustration,
  music: m.value.library.roles.gamePerson.music,
  programmer: m.value.library.roles.gamePerson.programmer,
  actor: m.value.library.roles.gamePerson.actor,
  other: m.value.library.roles.gamePerson.other
}))

const PERSON_TYPE_ORDER: GamePersonType[] = [
  'director',
  'scenario',
  'illustration',
  'music',
  'programmer',
  'actor',
  'other'
]

// Form state
const items = ref<GameLinkItem[]>([])
const editingItem = ref<GameLinkItem | null>(null)
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

// Fetch person games when dialog opens
const { data: results, isLoading } = useAsyncData(
  () =>
    db.query.gamePersonLinks.findMany({
      where: eq(gamePersonLinks.personId, props.personId),
      with: { game: true },
      orderBy: asc(gamePersonLinks.orderInPerson)
    }),
  {
    watch: [() => props.personId],
    enabled: () => open.value
  }
)

// Initialize form state when data loads
watch(results, (data) => {
  if (data) {
    items.value = data
      .filter((link) => link.game)
      .map((link) => ({
        id: link.id,
        gameId: link.gameId,
        gameName: link.game!.name,
        gameCover: link.game!.coverFile,
        type: link.type as GamePersonType,
        note: link.note || '',
        isSpoiler: link.isSpoiler,
        orderInPerson: link.orderInPerson
      }))
  }
})

// Grouped games by type
const groupedGames = computed(() => {
  const grouped: Record<GamePersonType, GameLinkItem[]> = {
    director: [],
    scenario: [],
    illustration: [],
    music: [],
    programmer: [],
    actor: [],
    other: []
  }
  items.value.forEach((item) => {
    grouped[item.type].push(item)
  })
  for (const type of PERSON_TYPE_ORDER) {
    grouped[type].sort((a, b) => a.orderInPerson - b.orderInPerson)
  }
  return grouped
})

// Existing game IDs for excluding from select
const existingGameIds = computed(() => items.value.map((item) => item.gameId))

// Pair each link with its spoiler-aware display texts and thumbnail URL
function withSpoiler(links: GameLinkItem[]) {
  return links.map((link) => ({
    link,
    spoiler: getSpoilerDisplay(link.gameName, link.note, link.isSpoiler, spoilersRevealed.value),
    coverUrl: link.gameCover
      ? getAttachmentUrl('games', link.gameId, link.gameCover, { width: 100, height: 100 })
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
    gameId: editingItem.value.gameId,
    gameName: editingItem.value.gameName,
    gameCover: editingItem.value.gameCover,
    type: editingItem.value.type,
    note: editingItem.value.note,
    isSpoiler: editingItem.value.isSpoiler
  }
})

async function handleSave() {
  isSaving.value = true
  try {
    await db.delete(gamePersonLinks).where(eq(gamePersonLinks.personId, props.personId))

    if (items.value.length > 0) {
      const linksToInsert: {
        id: string
        personId: string
        gameId: string
        isSpoiler: boolean
        type: GamePersonType
        note: string | null
        orderInPerson: number
      }[] = []

      for (const type of PERSON_TYPE_ORDER) {
        const typeLinks = groupedGames.value[type]
        typeLinks.forEach((link, index) => {
          linksToInsert.push({
            id: link.isNew ? nanoid() : link.id,
            personId: props.personId,
            gameId: link.gameId,
            isSpoiler: link.isSpoiler,
            type: link.type,
            note: link.note || null,
            orderInPerson: index
          })
        })
      }

      if (linksToInsert.length > 0) {
        await db.insert(gamePersonLinks).values(linksToInsert)
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

function handleMoveUp(type: GamePersonType, index: number) {
  if (index <= 0) return
  const typeLinks = [...groupedGames.value[type]]
  ;[typeLinks[index - 1], typeLinks[index]] = [typeLinks[index], typeLinks[index - 1]]
  typeLinks.forEach((link, i) => {
    link.orderInPerson = i
  })
  const otherItems = items.value.filter((item) => item.type !== type)
  items.value = [...otherItems, ...typeLinks]
}

function handleMoveDown(type: GamePersonType, index: number) {
  const typeLinks = [...groupedGames.value[type]]
  if (index >= typeLinks.length - 1) return
  ;[typeLinks[index], typeLinks[index + 1]] = [typeLinks[index + 1], typeLinks[index]]
  typeLinks.forEach((link, i) => {
    link.orderInPerson = i
  })
  const otherItems = items.value.filter((item) => item.type !== type)
  items.value = [...otherItems, ...typeLinks]
}

function handleRemove(id: string) {
  items.value = items.value.filter((item) => item.id !== id)
  deleteId.value = null
}

function handleEdit(item: GameLinkItem) {
  editingItem.value = { ...item }
  isAddMode.value = false
  itemFormOpen.value = true
}

function handleAddNew() {
  editingItem.value = {
    id: nanoid(),
    gameId: '',
    gameName: '',
    gameCover: null,
    type: 'other',
    note: '',
    isSpoiler: false,
    orderInPerson: items.value.length,
    isNew: true
  }
  isAddMode.value = true
  itemFormOpen.value = true
}

function handleItemFormSubmit(data: {
  gameId: string
  gameName: string
  gameCover: string | null
  type: GamePersonType
  note: string
  isSpoiler: boolean
}) {
  const updatedItem: GameLinkItem = {
    id: editingItem.value!.id,
    gameId: data.gameId,
    gameName: data.gameName,
    gameCover: data.gameCover,
    type: data.type,
    note: data.note,
    isSpoiler: data.isSpoiler,
    orderInPerson: editingItem.value!.orderInPerson,
    isNew: editingItem.value!.isNew
  }

  if (isAddMode.value) {
    const typeLinks = groupedGames.value[updatedItem.type]
    updatedItem.orderInPerson = typeLinks.length
    items.value.push(updatedItem)
  } else {
    const index = items.value.findIndex((item) => item.id === updatedItem.id)
    if (index !== -1) {
      if (editingItem.value && editingItem.value.type !== updatedItem.type) {
        const newTypeLinks = groupedGames.value[updatedItem.type]
        updatedItem.orderInPerson = newTypeLinks.length
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
          <DialogTitle>{{ m.library.forms.editPersonGames }}</DialogTitle>
        </DialogHeader>
        <DialogBody class="overflow-auto max-h-[60vh]">
          <div class="space-y-4">
            <p
              v-if="items.length === 0"
              class="text-sm text-muted-foreground text-center py-8"
            >
              {{ m.library.forms.emptyListHint({ label: m.library.entities.game }) }}
            </p>
            <template v-else>
              <template
                v-for="type in PERSON_TYPE_ORDER"
                :key="type"
              >
                <div v-if="groupedGames[type].length > 0">
                  <h4 class="text-xs font-medium text-muted-foreground mb-2">
                    {{ PERSON_TYPE_LABELS[type] }}
                  </h4>
                  <div class="space-y-1">
                    <ListItem
                      v-for="({ link, spoiler, coverUrl }, index) in withSpoiler(
                        groupedGames[type]
                      )"
                      :key="link.id"
                      :icon="spoiler.hidden ? 'icon-[mdi--eye-off-outline]' : getEntityIcon('game')"
                      :title="spoiler.name"
                      :description="spoiler.note"
                    >
                      <template
                        v-if="coverUrl && !spoiler.hidden"
                        #leading
                      >
                        <CoverImage
                          :src="coverUrl"
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
                          :is-last="index === groupedGames[type].length - 1"
                          @move-up="handleMoveUp(type, index)"
                          @move-down="handleMoveDown(type, index)"
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
            {{ m.library.detail.addEntity({ label: m.library.entities.game }) }}
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
    :entity-label="m.library.forms.linkLabels.game"
    mode="remove"
    @confirm="deleteId !== null && handleRemove(deleteId)"
  />

  <!-- Game item form dialog -->
  <PersonGamesItemFormDialog
    v-if="itemFormOpen"
    v-model:open="itemFormOpen"
    :initial-data="itemFormInitialData"
    :exclude-ids="existingGameIds"
    @submit="handleItemFormSubmit"
  />

  <SpoilerConfirmDialog
    v-if="spoilerConfirmOpen"
    v-model:open="spoilerConfirmOpen"
    @confirm="handleRevealSpoilersConfirm"
  />
</template>
