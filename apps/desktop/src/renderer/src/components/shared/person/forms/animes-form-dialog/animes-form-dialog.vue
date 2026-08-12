<!--
  PersonAnimesFormDialog
  Dialog for editing person's related animes grouped by staff role.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { nanoid } from 'nanoid'
import { eq, asc } from 'drizzle-orm'
import { Icon } from '@renderer/components/ui/icon'
import { db } from '@renderer/core/db'
import { animePersonLinks, type AnimePersonRole } from '@shared/db'
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
import PersonAnimesItemFormDialog from './anime-item-form-dialog.vue'
import { createLogger } from '@renderer/core/log'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

const log = createLogger('Person')

interface Props {
  personId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

interface AnimeLinkItem {
  id: string
  animeId: string
  animeName: string
  animeCover: string | null
  role: AnimePersonRole
  note: string
  isSpoiler: boolean
  orderInPerson: number
  isNew?: boolean
}

const PERSON_ROLE_ORDER: AnimePersonRole[] = [
  'originalCreator',
  'director',
  'series',
  'scenario',
  'episodeDirector',
  'characterDesign',
  'animationDirector',
  'animation',
  'art',
  'photography',
  'sound',
  'music',
  'producer',
  'other'
]

const PERSON_ROLE_LABELS = computed<Record<string, string>>(() => m.value.library.roles.animePerson)

// Form state
const items = ref<AnimeLinkItem[]>([])
const editingItem = ref<AnimeLinkItem | null>(null)
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

// Fetch person animes when dialog opens
const { data: results, isLoading } = useAsyncData(
  () =>
    db.query.animePersonLinks.findMany({
      where: eq(animePersonLinks.personId, props.personId),
      with: { anime: true },
      orderBy: asc(animePersonLinks.orderInPerson)
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
      .filter((link) => link.anime)
      .map((link) => ({
        id: link.id,
        animeId: link.animeId,
        animeName: link.anime!.name,
        animeCover: link.anime!.coverFile,
        role: link.role,
        note: link.note || '',
        isSpoiler: link.isSpoiler,
        orderInPerson: link.orderInPerson
      }))
  }
})

// Grouped animes by role
const groupedAnimes = computed(() => {
  const grouped = Object.fromEntries(
    PERSON_ROLE_ORDER.map((role) => [role, [] as AnimeLinkItem[]])
  ) as Record<AnimePersonRole, AnimeLinkItem[]>
  items.value.forEach((item) => {
    grouped[item.role].push(item)
  })
  for (const role of PERSON_ROLE_ORDER) {
    grouped[role].sort((a, b) => a.orderInPerson - b.orderInPerson)
  }
  return grouped
})

// Existing anime IDs for excluding from select
const existingAnimeIds = computed(() => items.value.map((item) => item.animeId))

// Pair each link with its spoiler-aware display texts and thumbnail URL
function withSpoiler(links: AnimeLinkItem[]) {
  return links.map((link) => ({
    link,
    spoiler: getSpoilerDisplay(link.animeName, link.note, link.isSpoiler, spoilersRevealed.value),
    coverUrl: link.animeCover
      ? getAttachmentUrl('animes', link.animeId, link.animeCover, { width: 100, height: 100 })
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
    animeId: editingItem.value.animeId,
    animeName: editingItem.value.animeName,
    animeCover: editingItem.value.animeCover,
    role: editingItem.value.role,
    note: editingItem.value.note,
    isSpoiler: editingItem.value.isSpoiler
  }
})

async function handleSave() {
  isSaving.value = true
  try {
    await db.delete(animePersonLinks).where(eq(animePersonLinks.personId, props.personId))

    if (items.value.length > 0) {
      const linksToInsert: {
        id: string
        personId: string
        animeId: string
        isSpoiler: boolean
        role: AnimePersonRole
        note: string | null
        orderInPerson: number
      }[] = []

      for (const role of PERSON_ROLE_ORDER) {
        const roleLinks = groupedAnimes.value[role]
        roleLinks.forEach((link, index) => {
          linksToInsert.push({
            id: link.isNew ? nanoid() : link.id,
            personId: props.personId,
            animeId: link.animeId,
            isSpoiler: link.isSpoiler,
            role: link.role,
            note: link.note || null,
            orderInPerson: index
          })
        })
      }

      if (linksToInsert.length > 0) {
        await db.insert(animePersonLinks).values(linksToInsert)
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

function handleMoveUp(role: AnimePersonRole, index: number) {
  if (index <= 0) return
  const roleLinks = [...groupedAnimes.value[role]]
  ;[roleLinks[index - 1], roleLinks[index]] = [roleLinks[index], roleLinks[index - 1]]
  roleLinks.forEach((link, i) => {
    link.orderInPerson = i
  })
  const otherItems = items.value.filter((item) => item.role !== role)
  items.value = [...otherItems, ...roleLinks]
}

function handleMoveDown(role: AnimePersonRole, index: number) {
  const roleLinks = [...groupedAnimes.value[role]]
  if (index >= roleLinks.length - 1) return
  ;[roleLinks[index], roleLinks[index + 1]] = [roleLinks[index + 1], roleLinks[index]]
  roleLinks.forEach((link, i) => {
    link.orderInPerson = i
  })
  const otherItems = items.value.filter((item) => item.role !== role)
  items.value = [...otherItems, ...roleLinks]
}

function handleRemove(id: string) {
  items.value = items.value.filter((item) => item.id !== id)
  deleteId.value = null
}

function handleEdit(item: AnimeLinkItem) {
  editingItem.value = { ...item }
  isAddMode.value = false
  itemFormOpen.value = true
}

function handleAddNew() {
  editingItem.value = {
    id: nanoid(),
    animeId: '',
    animeName: '',
    animeCover: null,
    role: 'other',
    note: '',
    isSpoiler: false,
    orderInPerson: items.value.length,
    isNew: true
  }
  isAddMode.value = true
  itemFormOpen.value = true
}

function handleItemFormSubmit(data: {
  animeId: string
  animeName: string
  animeCover: string | null
  role: AnimePersonRole
  note: string
  isSpoiler: boolean
}) {
  const updatedItem: AnimeLinkItem = {
    id: editingItem.value!.id,
    animeId: data.animeId,
    animeName: data.animeName,
    animeCover: data.animeCover,
    role: data.role,
    note: data.note,
    isSpoiler: data.isSpoiler,
    orderInPerson: editingItem.value!.orderInPerson,
    isNew: editingItem.value!.isNew
  }

  if (isAddMode.value) {
    const roleLinks = groupedAnimes.value[updatedItem.role]
    updatedItem.orderInPerson = roleLinks.length
    items.value.push(updatedItem)
  } else {
    const index = items.value.findIndex((item) => item.id === updatedItem.id)
    if (index !== -1) {
      if (editingItem.value && editingItem.value.role !== updatedItem.role) {
        const newRoleLinks = groupedAnimes.value[updatedItem.role]
        updatedItem.orderInPerson = newRoleLinks.length
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
          <DialogTitle>{{ m.library.forms.editPersonAnimes }}</DialogTitle>
        </DialogHeader>
        <DialogBody class="overflow-auto max-h-[60vh]">
          <div class="space-y-4">
            <p
              v-if="items.length === 0"
              class="text-sm text-muted-foreground text-center py-8"
            >
              {{ m.library.forms.emptyListHint({ label: m.library.entities.anime }) }}
            </p>
            <template v-else>
              <template
                v-for="role in PERSON_ROLE_ORDER"
                :key="role"
              >
                <div v-if="groupedAnimes[role].length > 0">
                  <h4 class="text-xs font-medium text-muted-foreground mb-2">
                    {{ PERSON_ROLE_LABELS[role] }}
                  </h4>
                  <div class="space-y-1">
                    <ListItem
                      v-for="({ link, spoiler, coverUrl }, index) in withSpoiler(
                        groupedAnimes[role]
                      )"
                      :key="link.id"
                      :icon="
                        spoiler.hidden ? 'icon-[mdi--eye-off-outline]' : getEntityIcon('anime')
                      "
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
                          :is-last="index === groupedAnimes[role].length - 1"
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
            {{ m.library.detail.addEntity({ label: m.library.entities.anime }) }}
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
    :entity-label="m.library.forms.linkLabels.anime"
    mode="remove"
    @confirm="deleteId !== null && handleRemove(deleteId)"
  />

  <!-- Anime item form dialog -->
  <PersonAnimesItemFormDialog
    v-if="itemFormOpen"
    v-model:open="itemFormOpen"
    :initial-data="itemFormInitialData"
    :exclude-ids="existingAnimeIds"
    @submit="handleItemFormSubmit"
  />

  <SpoilerConfirmDialog
    v-if="spoilerConfirmOpen"
    v-model:open="spoilerConfirmOpen"
    @confirm="handleRevealSpoilersConfirm"
  />
</template>
