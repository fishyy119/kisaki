<!--
  AnimeBatchMenuItems
  Menu items for batch operations on multiple anime entries.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { nanoid } from 'nanoid'
import { and, eq, inArray } from 'drizzle-orm'
import { Icon } from '@renderer/components/ui/icon'
import { getEntityIcon } from '@renderer/utils/format'
import {
  ContextMenuCheckboxItem,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent
} from '@renderer/components/ui/context-menu'
import { useAsyncData, useI18n } from '@renderer/composables'
import { notify } from '@renderer/core/notify'
import { db } from '@renderer/core/db'
import { ExtensionEntityMenuItems } from '@renderer/components/extension/entity-menus'
import { usePreferencesStore } from '@renderer/stores'
import { collections, collectionAnimeLinks, animes } from '@shared/db'
import type { MenuComponents } from '@renderer/types'

interface Props {
  animeIds: string[]
  enabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  enabled: true
})

const preferencesStore = usePreferencesStore()
const { showNsfw } = storeToRefs(preferencesStore)

const { m } = useI18n()

const emit = defineEmits<{
  openMetadataUpdateDialog: []
  openDeleteDialog: []
}>()

const contextMenuComponents: MenuComponents = {
  Item: ContextMenuItem,
  Sub: ContextMenuSub,
  SubTrigger: ContextMenuSubTrigger,
  SubContent: ContextMenuSubContent,
  Separator: ContextMenuSeparator,
  CheckboxItem: ContextMenuCheckboxItem,
  RadioGroup: ContextMenuRadioGroup,
  RadioItem: ContextMenuRadioItem
}

const extensionMenuInput = computed(
  () =>
    ({
      domain: 'anime',
      scope: 'batch',
      entityIds: props.animeIds
    }) as const
)

type CollectionRow = { id: string; name: string; order: number }
type LinkRow = { collectionId: string; entityId: string }

async function fetchMenuData(): Promise<{ collections: CollectionRow[]; links: LinkRow[] }> {
  const ids = props.animeIds

  const staticCollections = await db.query.collections.findMany({
    where: and(
      eq(collections.isDynamic, false),
      showNsfw.value ? undefined : eq(collections.isNsfw, false)
    ),
    orderBy: (c, { asc }) => asc(c.order)
  })

  if (ids.length === 0) {
    return {
      collections: staticCollections.map((c) => ({ id: c.id, name: c.name, order: c.order })),
      links: []
    }
  }

  const links = await db
    .select({
      collectionId: collectionAnimeLinks.collectionId,
      entityId: collectionAnimeLinks.animeId
    })
    .from(collectionAnimeLinks)
    .where(inArray(collectionAnimeLinks.animeId, ids))

  return {
    collections: staticCollections.map((c) => ({ id: c.id, name: c.name, order: c.order })),
    links
  }
}

const { data, refetch } = useAsyncData(fetchMenuData, {
  watch: [() => props.animeIds, showNsfw],
  enabled: () => props.enabled
})

const staticCollections = computed(() => data.value?.collections ?? [])
const links = computed(() => data.value?.links ?? [])

const linkMap = computed(() => {
  const map = new Map<string, Set<string>>()
  for (const link of links.value) {
    const set = map.get(link.collectionId) ?? new Set<string>()
    set.add(link.entityId)
    map.set(link.collectionId, set)
  }
  return map
})

const selectedEntityCount = computed(() => props.animeIds.length)

const collectionsAddable = computed(() =>
  staticCollections.value.filter(
    (c) => (linkMap.value.get(c.id)?.size ?? 0) < selectedEntityCount.value
  )
)

const collectionsRemovable = computed(() =>
  staticCollections.value.filter((c) => (linkMap.value.get(c.id)?.size ?? 0) > 0)
)

async function handleAddToCollection(collectionId: string) {
  const ids = props.animeIds
  if (ids.length === 0) return

  const existing = linkMap.value.get(collectionId) ?? new Set<string>()
  const missingIds = ids.filter((id) => !existing.has(id))
  if (missingIds.length === 0) return

  try {
    await db.insert(collectionAnimeLinks).values(
      missingIds.map((animeId) => ({
        id: nanoid(),
        collectionId,
        animeId,
        orderInCollection: 0
      }))
    )
    notify.success(m.value.library.feedback.addedToCollection)
    await refetch()
  } catch {
    notify.error(m.value.library.feedback.addFailed)
  }
}

async function handleRemoveFromCollection(collectionId: string) {
  const ids = props.animeIds
  if (ids.length === 0) return

  try {
    await db
      .delete(collectionAnimeLinks)
      .where(
        and(
          eq(collectionAnimeLinks.collectionId, collectionId),
          inArray(collectionAnimeLinks.animeId, ids)
        )
      )
    notify.success(m.value.library.feedback.removedFromCollection)
    await refetch()
  } catch {
    notify.error(m.value.library.feedback.removeFailed)
  }
}

async function handleSetFavorite(isFavorite: boolean) {
  const ids = props.animeIds
  if (ids.length === 0) return

  try {
    await db.update(animes).set({ isFavorite }).where(inArray(animes.id, ids))
    notify.success(
      isFavorite ? m.value.library.feedback.favoriteAdded : m.value.library.feedback.favoriteRemoved
    )
  } catch {
    notify.error(m.value.common.operationFailed)
  }
}
</script>

<template>
  <ContextMenuLabel>{{ m.common.selectedCount({ count: selectedEntityCount }) }}</ContextMenuLabel>
  <ContextMenuSeparator />

  <!-- Add to collection -->
  <ContextMenuSub>
    <ContextMenuSubTrigger>
      <Icon
        icon="icon-[mdi--folder-plus-outline]"
        class="size-4"
      />
      {{ m.library.menu.addToCollection }}
    </ContextMenuSubTrigger>
    <ContextMenuSubContent class="min-w-[180px]">
      <template v-if="collectionsAddable.length > 0">
        <div class="max-h-[240px] overflow-auto">
          <ContextMenuItem
            v-for="collection in collectionsAddable"
            :key="collection.id"
            @select="handleAddToCollection(collection.id)"
          >
            <Icon
              :icon="getEntityIcon('collection')"
              class="size-4"
            />
            {{ collection.name }}
          </ContextMenuItem>
        </div>
      </template>
      <ContextMenuItem
        v-else
        disabled
      >
        <span class="text-muted-foreground">{{ m.library.menu.noCollections }}</span>
      </ContextMenuItem>
    </ContextMenuSubContent>
  </ContextMenuSub>

  <!-- Remove from collection -->
  <ContextMenuSub>
    <ContextMenuSubTrigger>
      <Icon
        icon="icon-[mdi--folder-remove-outline]"
        class="size-4"
      />
      {{ m.library.menu.removeFromCollection }}
    </ContextMenuSubTrigger>
    <ContextMenuSubContent class="min-w-[180px]">
      <template v-if="collectionsRemovable.length > 0">
        <div class="max-h-[240px] overflow-auto">
          <ContextMenuItem
            v-for="collection in collectionsRemovable"
            :key="collection.id"
            @select="handleRemoveFromCollection(collection.id)"
          >
            <Icon
              :icon="getEntityIcon('collection')"
              class="size-4"
            />
            {{ collection.name }}
          </ContextMenuItem>
        </div>
      </template>
      <ContextMenuItem
        v-else
        disabled
      >
        <span class="text-muted-foreground">{{ m.library.menu.noCollections }}</span>
      </ContextMenuItem>
    </ContextMenuSubContent>
  </ContextMenuSub>

  <ContextMenuSeparator />

  <!-- Favorite -->
  <ContextMenuItem @select="handleSetFavorite(true)">
    <Icon
      icon="icon-[mdi--heart-outline]"
      class="size-4"
    />
    {{ m.library.menu.setFavorite }}
  </ContextMenuItem>
  <ContextMenuItem @select="handleSetFavorite(false)">
    <Icon
      icon="icon-[mdi--heart-off-outline]"
      class="size-4"
    />
    {{ m.library.menu.unsetFavorite }}
  </ContextMenuItem>

  <ContextMenuSeparator />

  <ContextMenuItem @select="emit('openMetadataUpdateDialog')">
    <Icon
      icon="icon-[mdi--database-sync-outline]"
      class="size-4"
    />
    {{ m.library.menu.batchUpdateMetadata }}
  </ContextMenuItem>

  <ExtensionEntityMenuItems
    :input="extensionMenuInput"
    :components="contextMenuComponents"
    :enabled="props.enabled"
  />

  <!-- Delete -->
  <ContextMenuItem
    variant="destructive"
    @select="emit('openDeleteDialog')"
  >
    <Icon
      icon="icon-[mdi--delete-outline]"
      class="size-4"
    />
    {{ m.library.menu.batchDelete }}
  </ContextMenuItem>
</template>
