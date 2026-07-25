<!--
  CompanyBatchMenuItems
  Menu items for batch operations on multiple companies.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { nanoid } from 'nanoid'
import { and, eq, inArray } from 'drizzle-orm'
import { Icon } from '@renderer/components/ui/icon'
import { getEntityIcon } from '@renderer/utils/format'
import {
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent
} from '@renderer/components/ui/context-menu'
import { useAsyncData, useI18n } from '@renderer/composables'
import { notify } from '@renderer/core/notify'
import { db } from '@renderer/core/db'
import { usePreferencesStore } from '@renderer/stores'
import { companies, collections, collectionCompanyLinks } from '@shared/db'

interface Props {
  companyIds: string[]
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

type CollectionRow = { id: string; name: string; order: number }
type LinkRow = { collectionId: string; entityId: string }

async function fetchMenuData(): Promise<{ collections: CollectionRow[]; links: LinkRow[] }> {
  const ids = props.companyIds

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
      collectionId: collectionCompanyLinks.collectionId,
      entityId: collectionCompanyLinks.companyId
    })
    .from(collectionCompanyLinks)
    .where(inArray(collectionCompanyLinks.companyId, ids))

  return {
    collections: staticCollections.map((c) => ({ id: c.id, name: c.name, order: c.order })),
    links
  }
}

const { data, refetch } = useAsyncData(fetchMenuData, {
  watch: [() => props.companyIds, showNsfw],
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

const selectedEntityCount = computed(() => props.companyIds.length)

const collectionsAddable = computed(() =>
  staticCollections.value.filter(
    (c) => (linkMap.value.get(c.id)?.size ?? 0) < selectedEntityCount.value
  )
)

const collectionsRemovable = computed(() =>
  staticCollections.value.filter((c) => (linkMap.value.get(c.id)?.size ?? 0) > 0)
)

async function handleAddToCollection(collectionId: string) {
  const ids = props.companyIds
  if (ids.length === 0) return

  const existing = linkMap.value.get(collectionId) ?? new Set<string>()
  const missingIds = ids.filter((id) => !existing.has(id))
  if (missingIds.length === 0) return

  try {
    await db.insert(collectionCompanyLinks).values(
      missingIds.map((companyId) => ({
        id: nanoid(),
        collectionId,
        companyId,
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
  const ids = props.companyIds
  if (ids.length === 0) return

  try {
    await db
      .delete(collectionCompanyLinks)
      .where(
        and(
          eq(collectionCompanyLinks.collectionId, collectionId),
          inArray(collectionCompanyLinks.companyId, ids)
        )
      )
    notify.success(m.value.library.feedback.removedFromCollection)
    await refetch()
  } catch {
    notify.error(m.value.library.feedback.removeFailed)
  }
}

async function handleSetFavorite(isFavorite: boolean) {
  const ids = props.companyIds
  if (ids.length === 0) return

  try {
    await db.update(companies).set({ isFavorite }).where(inArray(companies.id, ids))
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
