<!--
  CompanyGamesFormDialog
  Dialog for editing company's related games grouped by role.
  Uses two-layer pattern: outer handles data fetching, inner handles form state.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { eq, asc } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db } from '@renderer/core/db'
import { gameCompanyLinks } from '@shared/db'
import type { GameCompanyRole } from '@shared/db'
import { useAsyncData, useRenderState } from '@renderer/composables'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { StateView } from '@renderer/components/ui/state-view'
import { Button } from '@renderer/components/ui/button'
import { DeleteConfirmDialog } from '@renderer/components/ui/delete-confirm-dialog'
import { SpoilerConfirmDialog } from '@renderer/components/ui/spoiler-confirm-dialog'
import { notify } from '@renderer/core/notify'
import { ListItem, ListItemActions } from '@renderer/components/ui/list-item'
import { CoverImage } from '@renderer/components/ui/cover-image'
import { getAttachmentUrl } from '@renderer/utils/attachment'
import { getEntityIcon, getSpoilerDisplay } from '@renderer/utils/format'
import CompanyGamesItemFormDialog from './game-item-form-dialog.vue'
import { createLogger } from '@renderer/core/log'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

const log = createLogger('Company')

const COMPANY_ROLE_ORDER: GameCompanyRole[] = ['developer', 'publisher', 'distributor', 'other']
const COMPANY_ROLE_LABELS = computed<Record<string, string>>(() => ({
  developer: m.value.library.roles.gameCompany.developer,
  publisher: m.value.library.roles.gameCompany.publisher,
  distributor: m.value.library.roles.gameCompany.distributor,
  other: m.value.library.roles.gameCompany.other
}))

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
  companyId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

// Form state
const items = ref<GameLinkItem[]>([])
const deleteId = ref<string | null>(null)
const formOpen = ref(false)
const editingItem = ref<GameLinkItem | undefined>(undefined)
const isAddMode = ref(false)
const isSaving = ref(false)
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

// Fetch game links when dialog opens
const {
  data: fetchedData,
  isLoading,
  error
} = useAsyncData(
  async () => {
    const links = await db.query.gameCompanyLinks.findMany({
      where: eq(gameCompanyLinks.companyId, props.companyId),
      orderBy: asc(gameCompanyLinks.orderInCompany),
      with: { game: true }
    })
    return links.map((link) => ({
      id: link.id,
      gameId: link.gameId,
      gameName: link.game?.name || '',
      gameCover: link.game?.coverFile || null,
      role: link.role as GameCompanyRole,
      note: link.note || '',
      isSpoiler: link.isSpoiler,
      orderInCompany: link.orderInCompany
    }))
  },
  {
    watch: [() => props.companyId],
    enabled: () => open.value
  }
)
const state = useRenderState(isLoading, error, fetchedData)

// Initialize form state when data loads
watch(fetchedData, (data) => {
  items.value = data ? [...data] : []
})

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

// Group items by type
const groupedItems = computed(() => {
  const groups: Record<GameCompanyRole, GameLinkItem[]> = {
    developer: [],
    publisher: [],
    distributor: [],
    other: []
  }
  for (const item of items.value) {
    groups[item.role].push(item)
  }
  return groups
})

async function handleSave() {
  isSaving.value = true
  try {
    // Delete all existing links for this company
    await db.delete(gameCompanyLinks).where(eq(gameCompanyLinks.companyId, props.companyId))

    // Insert new links with order by type groups
    if (items.value.length > 0) {
      let globalOrder = 0
      const values: {
        id: string
        companyId: string
        gameId: string
        isSpoiler: boolean
        role: GameCompanyRole
        note: string | null
        orderInCompany: number
      }[] = []

      for (const role of COMPANY_ROLE_ORDER) {
        for (const item of groupedItems.value[role]) {
          values.push({
            id: item.isNew ? nanoid() : item.id,
            companyId: props.companyId,
            gameId: item.gameId,
            isSpoiler: item.isSpoiler,
            role: item.role,
            note: item.note || null,
            orderInCompany: globalOrder++
          })
        }
      }

      if (values.length > 0) {
        await db.insert(gameCompanyLinks).values(values)
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

function handleAddClick() {
  editingItem.value = undefined
  isAddMode.value = true
  formOpen.value = true
}

function handleEditClick(item: GameLinkItem) {
  editingItem.value = item
  isAddMode.value = false
  formOpen.value = true
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

function handleFormSubmit(data: GameLinkItem) {
  if (isAddMode.value) {
    items.value.push(data)
  } else {
    const index = items.value.findIndex((item) => item.id === data.id)
    if (index !== -1) {
      items.value[index] = data
    }
  }
}

function handleDeleteConfirm() {
  if (deleteId.value !== null) {
    const index = items.value.findIndex((item) => item.id === deleteId.value)
    if (index !== -1) {
      items.value.splice(index, 1)
    }
    deleteId.value = null
  }
}

function handleMoveUp(role: GameCompanyRole, index: number) {
  const roleItems = groupedItems.value[role]
  if (index > 0) {
    // Find items in main array and swap
    const itemA = roleItems[index]
    const itemB = roleItems[index - 1]
    const indexA = items.value.findIndex((i) => i.id === itemA.id)
    const indexB = items.value.findIndex((i) => i.id === itemB.id)
    if (indexA !== -1 && indexB !== -1) {
      const temp = items.value[indexA]
      items.value[indexA] = items.value[indexB]
      items.value[indexB] = temp
    }
  }
}

function handleMoveDown(role: GameCompanyRole, index: number) {
  const roleItems = groupedItems.value[role]
  if (index < roleItems.length - 1) {
    const itemA = roleItems[index]
    const itemB = roleItems[index + 1]
    const indexA = items.value.findIndex((i) => i.id === itemA.id)
    const indexB = items.value.findIndex((i) => i.id === itemB.id)
    if (indexA !== -1 && indexB !== -1) {
      const temp = items.value[indexA]
      items.value[indexA] = items.value[indexB]
      items.value[indexB] = temp
    }
  }
}

const deleteDialogOpen = computed({
  get: () => deleteId.value !== null,
  set: (v) => {
    if (!v) deleteId.value = null
  }
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-lg">
      <template v-if="state === 'loading'">
        <DialogBody>
          <StateView
            state="loading"
            class="py-8"
          />
        </DialogBody>
      </template>

      <template v-else>
        <DialogHeader>
          <DialogTitle>{{ m.library.forms.editCompanyGames }}</DialogTitle>
        </DialogHeader>
        <DialogBody class="overflow-auto max-h-[60vh]">
          <div
            v-if="items.length === 0"
            class="text-sm text-muted-foreground text-center py-8"
          >
            {{ m.library.forms.emptyListHint({ label: m.library.entities.game }) }}
          </div>
          <div
            v-else
            class="space-y-2"
          >
            <template
              v-for="role in COMPANY_ROLE_ORDER"
              :key="role"
            >
              <div v-if="groupedItems[role].length > 0">
                <h4 class="text-xs font-medium text-muted-foreground mb-2">
                  {{ COMPANY_ROLE_LABELS[role] }}
                </h4>
                <div class="space-y-1">
                  <ListItem
                    v-for="({ link, spoiler, coverUrl }, index) in withSpoiler(groupedItems[role])"
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
                        :is-last="index === groupedItems[role].length - 1"
                        @move-up="handleMoveUp(role, index)"
                        @move-down="handleMoveDown(role, index)"
                        @edit="handleEditClick(link)"
                        @delete="deleteId = link.id"
                      />
                    </template>
                  </ListItem>
                </div>
              </div>
            </template>
          </div>
        </DialogBody>
        <DialogFooter class="flex justify-between">
          <Button
            variant="outline"
            @click="handleAddClick"
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
              @click="open = false"
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

  <CompanyGamesItemFormDialog
    v-if="formOpen"
    v-model:open="formOpen"
    :initial-data="editingItem"
    :existing-game-ids="existingGameIds"
    :is-add-mode="isAddMode"
    @submit="handleFormSubmit"
  />

  <DeleteConfirmDialog
    v-model:open="deleteDialogOpen"
    :entity-label="m.library.entities.game"
    @confirm="handleDeleteConfirm"
  />

  <SpoilerConfirmDialog
    v-if="spoilerConfirmOpen"
    v-model:open="spoilerConfirmOpen"
    @confirm="handleRevealSpoilersConfirm"
  />
</template>
