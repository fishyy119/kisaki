<!--
  EntityMenuItems
  Unified entity menu items that work with both ContextMenu and DropdownMenu.
  Self-contained: fetches its own data and handles mutations internally.
  Entity differences (collections store, status section, directory action,
  extra dialog entries) arrive via the menu spec registry.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { eq, and, asc } from 'drizzle-orm'
import { Icon } from '@renderer/components/ui/icon'
import { getEntityIcon } from '@renderer/utils/format'
import { useAsyncData, useDbChanges, useI18n } from '@renderer/composables'
import { notify } from '@renderer/core/notify'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { ExtensionEntityMenuItems } from '@renderer/components/extension/entity-menus'
import { usePreferencesStore } from '@renderer/stores'
import { collections } from '@shared/db'
import type { MenuComponents } from '@renderer/types'
import { ENTITY_TABLES, type TableEntityType } from '../entity-tables'
import { MENU_SPECS } from './menu-specs'

interface Props {
  entityType: TableEntityType
  entityId: string
  /** Whether to fetch data - for lazy loading in context menu */
  enabled?: boolean
  /** Menu component primitives to use */
  components: MenuComponents
}

const props = withDefaults(defineProps<Props>(), {
  enabled: true
})

const preferencesStore = usePreferencesStore()
const { showNsfw } = storeToRefs(preferencesStore)

const { m } = useI18n()

const emit = defineEmits<{
  openScoreDialog: []
  openAssetsDialog: []
  openMetadataUpdateDialog: []
  openExternalIdsDialog: []
  openMergeDialog: []
  openDeleteDialog: []
  openNewCollectionDialog: []
  /** Media-specific dialog entries declared by the menu spec. */
  openExtraDialog: [name: string]
}>()

const spec = computed(() => MENU_SPECS[props.entityType])
const table = computed(() => ENTITY_TABLES[props.entityType])

type CollectionData = { id: string; name: string }

interface EntityMenuEntry {
  status: string | null
  score: number | null
  isFavorite: boolean
  isNsfw: boolean
}

interface EntityMenuData {
  entry: EntityMenuEntry
  dirPath: string | null
  collectionsData: {
    containing: CollectionData[]
    notContaining: CollectionData[]
  }
}

async function fetchMenuData(): Promise<EntityMenuData | null> {
  const currentSpec = spec.value
  const rows = await db
    .select({
      score: table.value.score,
      isFavorite: table.value.isFavorite,
      isNsfw: table.value.isNsfw
    })
    .from(table.value)
    .where(eq(table.value.id, props.entityId))
    .limit(1)
  const base = rows[0]
  if (!base) return null

  const status = currentSpec.status ? await currentSpec.status.read(props.entityId) : null
  const dirPath = currentSpec.dir ? await currentSpec.dir.path(props.entityId) : null

  // Fetch static collections only (dynamic collections can't be manually modified)
  const staticCollections = await db.query.collections.findMany({
    where: and(
      eq(collections.isDynamic, false),
      showNsfw.value ? undefined : eq(collections.isNsfw, false)
    ),
    orderBy: asc(collections.order)
  })
  const linkedCollectionIds = await currentSpec.collections.linkedCollectionIds(props.entityId)

  return {
    entry: {
      status,
      score: base.score,
      isFavorite: base.isFavorite,
      isNsfw: base.isNsfw
    },
    dirPath,
    collectionsData: {
      containing: staticCollections.filter((c) => linkedCollectionIds.has(c.id)),
      notContaining: staticCollections.filter((c) => !linkedCollectionIds.has(c.id))
    }
  }
}

const { data, refetch } = useAsyncData(fetchMenuData, {
  watch: [() => props.entityId, showNsfw],
  enabled: () => props.enabled
})

const entry = computed(() => data.value?.entry ?? null)
const dirPath = computed(() => data.value?.dirPath ?? null)
const collectionsData = computed(() => data.value?.collectionsData ?? null)

const extensionMenuInput = computed(
  () =>
    ({
      domain: props.entityType,
      scope: 'single',
      entityId: props.entityId
    }) as const
)

useDbChanges(({ operation, table: changedTable, id }) => {
  const linkTable = spec.value.collections.table
  if (operation === 'updated') {
    if (changedTable === spec.value.entityTable && id === props.entityId) refetch()
    if (changedTable === linkTable || changedTable === 'collections') refetch()
    return
  }
  if (changedTable === linkTable || changedTable === 'collections') refetch()
})

// Computed for displaying score
const displayScore = computed(() => {
  if (entry.value?.score !== null && entry.value?.score !== undefined) {
    return (entry.value.score / 10).toFixed(1)
  }
  return null
})

const statusOptions = computed(() => spec.value.status?.options(m.value) ?? [])

// Computed model for the media status radio group
const statusModel = computed({
  get: () => entry.value?.status ?? undefined,
  set: async (status: string | undefined) => {
    if (!status || !spec.value.status) return
    try {
      await spec.value.status.write(props.entityId, status)
      notify.success(m.value.library.feedback.statusUpdated)
    } catch {
      notify.error(m.value.library.feedback.updateFailed)
    }
  }
})

// Action handlers
async function handleAddToCollection(collectionId: string) {
  try {
    await spec.value.collections.add(props.entityId, collectionId)
    notify.success(m.value.library.feedback.addedToCollection)
  } catch {
    notify.error(m.value.library.feedback.addFailed)
  }
}

async function handleRemoveFromCollection(collectionId: string) {
  try {
    await spec.value.collections.remove(props.entityId, collectionId)
    notify.success(m.value.library.feedback.removedFromCollection)
  } catch {
    notify.error(m.value.library.feedback.removeFailed)
  }
}

async function handleToggleFavorite() {
  if (!entry.value) return
  try {
    await db
      .update(table.value)
      .set({ isFavorite: !entry.value.isFavorite })
      .where(eq(table.value.id, props.entityId))
    notify.success(
      entry.value.isFavorite
        ? m.value.library.feedback.favoriteRemoved
        : m.value.library.feedback.favoriteAdded
    )
  } catch {
    notify.error(m.value.common.operationFailed)
  }
}

async function handleToggleNsfw() {
  if (!entry.value) return
  try {
    await db
      .update(table.value)
      .set({ isNsfw: !entry.value.isNsfw })
      .where(eq(table.value.id, props.entityId))
    notify.success(
      entry.value.isNsfw ? m.value.library.feedback.nsfwCleared : m.value.library.feedback.nsfwMarked
    )
  } catch {
    notify.error(m.value.common.operationFailed)
  }
}

async function handleOpenDir() {
  if (!dirPath.value) return
  const result = await ipcManager.invoke('native:open-path', {
    path: dirPath.value,
    ensure: 'folder'
  })
  if (!result.success) {
    notify.error(m.value.common.operationFailed)
  }
}
</script>

<template>
  <!-- Only render when data is ready - no loading state to avoid flicker -->
  <template v-if="entry && collectionsData">
    <!-- Add to Collection -->
    <component :is="props.components.Sub">
      <component :is="props.components.SubTrigger">
        <Icon
          icon="icon-[mdi--folder-plus-outline]"
          class="size-4"
        />
        {{ m.library.menu.addToCollection }}
      </component>
      <component
        :is="props.components.SubContent"
        class="min-w-[180px]"
      >
        <template v-if="collectionsData.notContaining.length > 0">
          <div class="max-h-[200px] overflow-auto">
            <component
              :is="props.components.Item"
              v-for="collection in collectionsData.notContaining"
              :key="collection.id"
              @select="handleAddToCollection(collection.id)"
            >
              <Icon
                :icon="getEntityIcon('collection')"
                class="size-4"
              />
              {{ collection.name }}
            </component>
          </div>
        </template>
        <component
          :is="props.components.Item"
          v-else
          disabled
        >
          <span class="text-muted-foreground">{{ m.library.menu.noCollections }}</span>
        </component>
        <component :is="props.components.Separator" />
        <component
          :is="props.components.Item"
          @select="emit('openNewCollectionDialog')"
        >
          <Icon
            icon="icon-[mdi--plus]"
            class="size-4"
          />
          {{ m.library.menu.newCollection }}
        </component>
      </component>
    </component>

    <!-- Remove from Collection - only show if the entry is in any collection -->
    <component
      :is="props.components.Sub"
      v-if="collectionsData.containing.length > 0"
    >
      <component :is="props.components.SubTrigger">
        <Icon
          icon="icon-[mdi--folder-remove-outline]"
          class="size-4"
        />
        {{ m.library.menu.removeFromCollection }}
      </component>
      <component
        :is="props.components.SubContent"
        class="min-w-[180px]"
      >
        <div class="max-h-[200px] overflow-auto">
          <component
            :is="props.components.Item"
            v-for="collection in collectionsData.containing"
            :key="collection.id"
            @select="handleRemoveFromCollection(collection.id)"
          >
            <Icon
              :icon="getEntityIcon('collection')"
              class="size-4"
            />
            {{ collection.name }}
          </component>
        </div>
      </component>
    </component>

    <component :is="props.components.Separator" />

    <!-- Media Status -->
    <component
      :is="props.components.Sub"
      v-if="spec.status"
    >
      <component :is="props.components.SubTrigger">
        <Icon
          icon="icon-[mdi--bookmark-outline]"
          class="size-4"
        />
        {{ spec.status.label(m) }}
      </component>
      <component
        :is="props.components.SubContent"
        class="min-w-[140px]"
      >
        <component
          :is="props.components.RadioGroup"
          v-model="statusModel"
        >
          <component
            :is="props.components.RadioItem"
            v-for="option in statusOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </component>
        </component>
      </component>
    </component>

    <!-- Edit Score -->
    <component
      :is="props.components.Item"
      @select="emit('openScoreDialog')"
    >
      <Icon
        icon="icon-[mdi--starburst-outline]"
        class="size-4"
      />
      {{ m.library.menu.editScore }}
      <span
        v-if="displayScore"
        class="ml-auto text-xs text-muted-foreground"
      >
        {{ displayScore }}
      </span>
    </component>

    <component :is="props.components.Separator" />

    <!-- Favorite & NSFW -->
    <component
      :is="props.components.CheckboxItem"
      :model-value="entry.isFavorite"
      @select="handleToggleFavorite"
    >
      <Icon
        icon="icon-[mdi--heart-outline]"
        class="size-4"
      />
      {{ m.library.menu.favorite }}
    </component>

    <component
      :is="props.components.CheckboxItem"
      :model-value="entry.isNsfw"
      @select="handleToggleNsfw"
    >
      <Icon
        icon="icon-[mdi--coffee-outline]"
        class="size-4"
      />
      NSFW
    </component>

    <component :is="props.components.Separator" />

    <!-- Open Entry Directory -->
    <component
      :is="props.components.Item"
      v-if="spec.dir"
      :disabled="!dirPath"
      @select="handleOpenDir"
    >
      <Icon
        icon="icon-[mdi--folder-open-outline]"
        class="size-4"
      />
      {{ spec.dir.label(m) }}
    </component>

    <!-- Media-specific dialog entries -->
    <component
      :is="props.components.Item"
      v-for="extra in spec.extraDialogs"
      :key="extra.name"
      @select="emit('openExtraDialog', extra.name)"
    >
      <Icon
        :icon="extra.icon"
        class="size-4"
      />
      {{ extra.label(m) }}
    </component>

    <!-- Asset Management -->
    <component
      :is="props.components.Item"
      @select="emit('openAssetsDialog')"
    >
      <Icon
        icon="icon-[mdi--image-multiple-outline]"
        class="size-4"
      />
      {{ m.library.menu.media }}
    </component>

    <!-- Metadata Update -->
    <component
      :is="props.components.Item"
      @select="emit('openMetadataUpdateDialog')"
    >
      <Icon
        icon="icon-[mdi--database-sync-outline]"
        class="size-4"
      />
      {{ m.library.menu.updateMetadata }}
    </component>

    <component
      :is="props.components.Item"
      @select="emit('openExternalIdsDialog')"
    >
      <Icon
        icon="icon-[mdi--card-text-outline]"
        class="size-4"
      />
      {{ m.library.menu.manageExternalIds }}
    </component>

    <component
      :is="props.components.Item"
      @select="emit('openMergeDialog')"
    >
      <Icon
        icon="icon-[mdi--source-merge]"
        class="size-4"
      />
      {{ m.library.menu.mergeDuplicates }}
    </component>

    <ExtensionEntityMenuItems
      :input="extensionMenuInput"
      :components="props.components"
      :enabled="props.enabled"
    />

    <component :is="props.components.Separator" />

    <!-- Delete -->
    <component
      :is="props.components.Item"
      variant="destructive"
      @select="emit('openDeleteDialog')"
    >
      <Icon
        icon="icon-[mdi--delete-outline]"
        class="size-4"
      />
      {{ m.common.delete }}
    </component>
  </template>
</template>
