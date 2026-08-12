<!--
  GameCompaniesFormDialog
  Dialog for editing game companies grouped by type.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { nanoid } from 'nanoid'
import { eq, asc } from 'drizzle-orm'
import { Icon } from '@renderer/components/ui/icon'
import { db } from '@renderer/core/db'
import { gameCompanyLinks } from '@shared/db'
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
import GameCompaniesItemFormDialog from './company-item-form-dialog.vue'
import { createLogger } from '@renderer/core/log'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

const log = createLogger('Game')

interface Props {
  gameId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

type CompanyRole = 'developer' | 'publisher' | 'distributor' | 'other'

interface CompanyLinkItem {
  id: string
  companyId: string
  companyName: string
  role: CompanyRole
  note: string
  isSpoiler: boolean
  orderInGame: number
  isNew?: boolean
}

const COMPANY_ROLE_LABELS = computed<Record<string, string>>(() => ({
  developer: m.value.library.roles.gameCompany.developer,
  publisher: m.value.library.roles.gameCompany.publisher,
  distributor: m.value.library.roles.gameCompany.distributor,
  other: m.value.library.roles.gameCompany.other
}))

const COMPANY_ROLE_ORDER: CompanyRole[] = ['developer', 'publisher', 'distributor', 'other']

// Form state
const items = ref<CompanyLinkItem[]>([])
const editingItem = ref<CompanyLinkItem | null>(null)
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

// Fetch game companies when dialog opens
const { data: results, isLoading } = useAsyncData(
  () =>
    db.query.gameCompanyLinks.findMany({
      where: eq(gameCompanyLinks.gameId, props.gameId),
      with: { company: true },
      orderBy: asc(gameCompanyLinks.orderInGame)
    }),
  {
    watch: [() => props.gameId],
    enabled: () => open.value
  }
)

// Initialize form state when data loads
watch(results, (data) => {
  if (data) {
    items.value = data
      .filter((link) => link.company)
      .map((link) => ({
        id: link.id,
        companyId: link.companyId,
        companyName: link.company!.name,
        role: link.role as CompanyRole,
        note: link.note || '',
        isSpoiler: link.isSpoiler,
        orderInGame: link.orderInGame
      }))
  }
})

// Grouped companies by type
const groupedCompanies = computed(() => {
  const grouped: Record<CompanyRole, CompanyLinkItem[]> = {
    developer: [],
    publisher: [],
    distributor: [],
    other: []
  }
  items.value.forEach((item) => {
    grouped[item.role].push(item)
  })
  for (const role of COMPANY_ROLE_ORDER) {
    grouped[role].sort((a, b) => a.orderInGame - b.orderInGame)
  }
  return grouped
})

// Existing company IDs for excluding from select
const existingCompanyIds = computed(() => items.value.map((item) => item.companyId))

// Pair each link with its spoiler-aware display texts
function withSpoiler(links: CompanyLinkItem[]) {
  return links.map((link) => ({
    link,
    spoiler: getSpoilerDisplay(link.companyName, link.note, link.isSpoiler, spoilersRevealed.value)
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
    companyId: editingItem.value.companyId,
    companyName: editingItem.value.companyName,
    role: editingItem.value.role,
    note: editingItem.value.note,
    isSpoiler: editingItem.value.isSpoiler
  }
})

async function handleSave() {
  isSaving.value = true
  try {
    await db.delete(gameCompanyLinks).where(eq(gameCompanyLinks.gameId, props.gameId))

    if (items.value.length > 0) {
      const linksToInsert: {
        id: string
        gameId: string
        companyId: string
        isSpoiler: boolean
        role: CompanyRole
        note: string | null
        orderInGame: number
      }[] = []

      for (const role of COMPANY_ROLE_ORDER) {
        const roleLinks = groupedCompanies.value[role]
        roleLinks.forEach((link, index) => {
          linksToInsert.push({
            id: link.isNew ? nanoid() : link.id,
            gameId: props.gameId,
            companyId: link.companyId,
            isSpoiler: link.isSpoiler,
            role: link.role,
            note: link.note || null,
            orderInGame: index
          })
        })
      }

      if (linksToInsert.length > 0) {
        await db.insert(gameCompanyLinks).values(linksToInsert)
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

function handleMoveUp(role: CompanyRole, index: number) {
  if (index <= 0) return
  const roleLinks = [...groupedCompanies.value[role]]
  ;[roleLinks[index - 1], roleLinks[index]] = [roleLinks[index], roleLinks[index - 1]]
  roleLinks.forEach((link, i) => {
    link.orderInGame = i
  })
  const otherItems = items.value.filter((item) => item.role !== role)
  items.value = [...otherItems, ...roleLinks]
}

function handleMoveDown(role: CompanyRole, index: number) {
  const roleLinks = [...groupedCompanies.value[role]]
  if (index >= roleLinks.length - 1) return
  ;[roleLinks[index], roleLinks[index + 1]] = [roleLinks[index + 1], roleLinks[index]]
  roleLinks.forEach((link, i) => {
    link.orderInGame = i
  })
  const otherItems = items.value.filter((item) => item.role !== role)
  items.value = [...otherItems, ...roleLinks]
}

function handleRemove(id: string) {
  items.value = items.value.filter((item) => item.id !== id)
  deleteId.value = null
}

function handleEdit(item: CompanyLinkItem) {
  editingItem.value = { ...item }
  isAddMode.value = false
  itemFormOpen.value = true
}

function handleAddNew() {
  editingItem.value = {
    id: nanoid(),
    companyId: '',
    companyName: '',
    role: 'developer',
    note: '',
    isSpoiler: false,
    orderInGame: items.value.length,
    isNew: true
  }
  isAddMode.value = true
  itemFormOpen.value = true
}

function handleItemFormSubmit(data: {
  companyId: string
  companyName: string
  role: CompanyRole
  note: string
  isSpoiler: boolean
}) {
  const updatedItem: CompanyLinkItem = {
    id: editingItem.value!.id,
    companyId: data.companyId,
    companyName: data.companyName,
    role: data.role,
    note: data.note,
    isSpoiler: data.isSpoiler,
    orderInGame: editingItem.value!.orderInGame,
    isNew: editingItem.value!.isNew
  }

  if (isAddMode.value) {
    const roleLinks = groupedCompanies.value[updatedItem.role]
    updatedItem.orderInGame = roleLinks.length
    items.value.push(updatedItem)
  } else {
    const index = items.value.findIndex((item) => item.id === updatedItem.id)
    if (index !== -1) {
      if (editingItem.value && editingItem.value.role !== updatedItem.role) {
        const newRoleLinks = groupedCompanies.value[updatedItem.role]
        updatedItem.orderInGame = newRoleLinks.length
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
          <DialogTitle>{{ m.library.forms.editGameCompanies }}</DialogTitle>
        </DialogHeader>
        <DialogBody class="overflow-auto max-h-[60vh]">
          <div class="space-y-4">
            <p
              v-if="items.length === 0"
              class="text-sm text-muted-foreground text-center py-8"
            >
              {{ m.library.forms.emptyListHint({ label: m.library.entities.company }) }}
            </p>
            <template v-else>
              <template
                v-for="role in COMPANY_ROLE_ORDER"
                :key="role"
              >
                <div v-if="groupedCompanies[role].length > 0">
                  <h4 class="text-xs font-medium text-muted-foreground mb-2">
                    {{ COMPANY_ROLE_LABELS[role] }}
                  </h4>
                  <div class="space-y-1">
                    <ListItem
                      v-for="({ link, spoiler }, index) in withSpoiler(groupedCompanies[role])"
                      :key="link.id"
                      :icon="
                        spoiler.hidden ? 'icon-[mdi--eye-off-outline]' : getEntityIcon('company')
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
                          :is-last="index === groupedCompanies[role].length - 1"
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
            {{ m.library.detail.addEntity({ label: m.library.entities.company }) }}
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
    :entity-label="m.library.forms.linkLabels.company"
    mode="remove"
    @confirm="deleteId !== null && handleRemove(deleteId)"
  />

  <!-- Company item form dialog -->
  <GameCompaniesItemFormDialog
    v-if="itemFormOpen"
    v-model:open="itemFormOpen"
    :initial-data="itemFormInitialData"
    :exclude-ids="existingCompanyIds"
    @submit="handleItemFormSubmit"
  />

  <SpoilerConfirmDialog
    v-if="spoilerConfirmOpen"
    v-model:open="spoilerConfirmOpen"
    @confirm="handleRevealSpoilersConfirm"
  />
</template>
