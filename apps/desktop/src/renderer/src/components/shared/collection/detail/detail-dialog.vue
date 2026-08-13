<!--
  CollectionDetailDialog

  Dialog view for collection details.
  Supports entity type switching and editing entities.
-->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { GameDetailDialog } from '@renderer/components/shared/game'
import { AnimeDetailDialog } from '@renderer/components/shared/anime'
import { CharacterDetailDialog } from '@renderer/components/shared/character'
import { PersonDetailDialog } from '@renderer/components/shared/person'
import { CompanyDetailDialog } from '@renderer/components/shared/company'
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
import { SegmentedControl, SegmentedControlItem } from '@renderer/components/ui/segmented-control'
import { getEntityIcon } from '@renderer/utils/format'
import { useCollectionDialogProvider, useDbChanges, useRenderState } from '@renderer/composables'
import { type ContentEntityType, CONTENT_ENTITY_TYPES } from '@shared/common'
import CollectionDetailContent from './detail-content.vue'
import { CollectionDropdownMenu } from '../menus'
import { CollectionEntitiesFormDialog } from '../forms'
import { useI18n } from '@renderer/composables'

const { m } = useI18n()

interface Props {
  collectionId: string
}

const props = defineProps<Props>()
const open = defineModel<boolean>('open', { required: true })

// Establish provider
const { collection, entityType, entityCounts, setEntityType, isLoading, error } =
  useCollectionDialogProvider(() => props.collectionId)
const state = useRenderState(isLoading, error, collection)

useDbChanges(({ operation, table, id }) => {
  if (operation !== 'deleted') return
  if (table === 'collections' && id === props.collectionId) {
    open.value = false
  }
})

// Edit entities dialog state
const editEntitiesOpen = ref(false)

// Scroll container ref for VirtualGrid (access via $el)
const dialogBodyRef = ref<InstanceType<typeof DialogBody>>()

type EntityClickPayload = { type: ContentEntityType; id: string }

const openGameId = ref<string | null>(null)
const openAnimeId = ref<string | null>(null)
const openCharacterId = ref<string | null>(null)
const openPersonId = ref<string | null>(null)
const openCompanyId = ref<string | null>(null)

const gameDialogOpen = computed({
  get: () => openGameId.value !== null,
  set: (value) => {
    if (!value) openGameId.value = null
  }
})
const animeDialogOpen = computed({
  get: () => openAnimeId.value !== null,
  set: (value) => {
    if (!value) openAnimeId.value = null
  }
})
const characterDialogOpen = computed({
  get: () => openCharacterId.value !== null,
  set: (value) => {
    if (!value) openCharacterId.value = null
  }
})
const personDialogOpen = computed({
  get: () => openPersonId.value !== null,
  set: (value) => {
    if (!value) openPersonId.value = null
  }
})
const companyDialogOpen = computed({
  get: () => openCompanyId.value !== null,
  set: (value) => {
    if (!value) openCompanyId.value = null
  }
})

function handleEntityClick(payload: EntityClickPayload) {
  openGameId.value = null
  openAnimeId.value = null
  openCharacterId.value = null
  openPersonId.value = null
  openCompanyId.value = null

  switch (payload.type) {
    case 'game':
      openGameId.value = payload.id
      return
    case 'anime':
      openAnimeId.value = payload.id
      return
    case 'character':
      openCharacterId.value = payload.id
      return
    case 'person':
      openPersonId.value = payload.id
      return
    case 'company':
      openCompanyId.value = payload.id
      return
    default:
      payload.type satisfies never
  }
}

const editEntitiesOpenComputed = computed({
  get: () => editEntitiesOpen.value,
  set: (value) => {
    editEntitiesOpen.value = value
  }
})

// Computed model for entityType to use with v-model
const entityTypeModel = computed({
  get: () => entityType.value,
  set: (value: ContentEntityType) => setEntityType(value)
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-4xl max-h-[90vh] flex flex-col">
      <!-- Loading / Error / Not Found -->
      <DialogBody v-if="state !== 'success'">
        <StateView
          :state="state"
          :error="error"
          :icon="getEntityIcon('collection')"
          :title="m.library.detail.notFoundTitle({ label: m.library.entities.collection })"
          :description="
            m.library.detail.notFoundDescription({ label: m.library.entities.collection })
          "
          class="py-12"
        />
      </DialogBody>

      <!-- Content -->
      <template v-else-if="collection">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Icon
              :icon="getEntityIcon('collection')"
              class="size-4 text-muted-foreground"
            />
            {{ collection.name }}
          </DialogTitle>
        </DialogHeader>
        <DialogBody
          ref="dialogBodyRef"
          class="flex-1 min-h-0 overflow-auto"
        >
          <CollectionDetailContent
            :scroll-parent="dialogBodyRef?.$el"
            @entity-click="handleEntityClick"
          />
        </DialogBody>
        <DialogFooter>
          <div class="flex items-center justify-between w-full">
            <!-- Left: Entity type tabs -->
            <SegmentedControl v-model="entityTypeModel">
              <SegmentedControlItem
                v-for="type in CONTENT_ENTITY_TYPES"
                :key="type"
                :value="type"
              >
                {{ m.library.entities[type] }}
                <span
                  v-if="entityCounts[type] > 0"
                  class="ml-1 text-[10px] text-muted-foreground"
                >
                  ({{ entityCounts[type] }})
                </span>
              </SegmentedControlItem>
            </SegmentedControl>

            <!-- Right: Action buttons -->
            <div class="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                @click="editEntitiesOpen = true"
              >
                <Icon
                  icon="icon-[mdi--format-list-numbered]"
                  class="size-4 mr-1.5"
                />
                {{ m.library.menu.editContent }}
              </Button>
              <CollectionDropdownMenu :collection-id="collection!.id" />
            </div>
          </div>
        </DialogFooter>
      </template>
    </DialogContent>
  </Dialog>

  <!-- Edit entities dialog -->
  <CollectionEntitiesFormDialog
    v-if="editEntitiesOpen"
    v-model:open="editEntitiesOpenComputed"
    :collection-id="props.collectionId"
  />

  <!-- Entity Dialogs -->
  <GameDetailDialog
    v-if="openGameId"
    v-model:open="gameDialogOpen"
    :game-id="openGameId"
  />
  <AnimeDetailDialog
    v-if="openAnimeId"
    v-model:open="animeDialogOpen"
    :anime-id="openAnimeId"
  />
  <CharacterDetailDialog
    v-if="openCharacterId"
    v-model:open="characterDialogOpen"
    :character-id="openCharacterId"
  />
  <PersonDetailDialog
    v-if="openPersonId"
    v-model:open="personDialogOpen"
    :person-id="openPersonId"
  />
  <CompanyDetailDialog
    v-if="openCompanyId"
    v-model:open="companyDialogOpen"
    :company-id="openCompanyId"
  />
</template>
