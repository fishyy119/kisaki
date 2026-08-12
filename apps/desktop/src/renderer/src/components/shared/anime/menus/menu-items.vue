<!--
  AnimeMenuItems
  Unified anime menu items that work with both ContextMenu and DropdownMenu.
  Self-contained: fetches its own data and handles mutations internally.
  Pass different menu components via `components` prop for polymorphism.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { nanoid } from 'nanoid'
import { eq, and } from 'drizzle-orm'
import { Icon } from '@renderer/components/ui/icon'
import { getEntityIcon } from '@renderer/utils/format'
import { useAsyncData, useDbChanges, useI18n } from '@renderer/composables'
import { notify } from '@renderer/core/notify'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { ExtensionEntityMenuItems } from '@renderer/components/extension/entity-menus'
import { usePreferencesStore } from '@renderer/stores'
import { animes, collections, collectionAnimeLinks, type Anime } from '@shared/db'
import { AnimeStatus } from '@shared/db'
import type { MenuComponents } from '@renderer/types'

interface Props {
  animeId: string
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

// Status options for selection
const statusOptions = computed<{ value: AnimeStatus; label: string }[]>(() =>
  (['planned', 'watching', 'completed', 'onHold', 'dropped'] as const).map((value) => ({
    value,
    label: m.value.library.animeStatus[value]
  }))
)

const emit = defineEmits<{
  openScoreDialog: []
  openFilesConfigDialog: []
  openMediaDialog: []
  openMetadataUpdateDialog: []
  openExternalIdsDialog: []
  openMergeDialog: []
  openDeleteDialog: []
  openNewCollectionDialog: []
}>()

type CollectionData = { id: string; name: string }

interface AnimeMenuData {
  anime: Anime
  collectionsData: {
    containing: CollectionData[]
    notContaining: CollectionData[]
  }
}

async function fetchAnimeData(): Promise<AnimeMenuData | null> {
  // Fetch anime
  const animeData = await db.query.animes.findFirst({ where: eq(animes.id, props.animeId) })
  if (!animeData) return null

  // Fetch static collections only (dynamic collections can't be manually modified)
  const staticCollections = await db.query.collections.findMany({
    where: and(
      eq(collections.isDynamic, false),
      showNsfw.value ? undefined : eq(collections.isNsfw, false)
    )
  })
  const links = await db.query.collectionAnimeLinks.findMany({
    where: eq(collectionAnimeLinks.animeId, props.animeId)
  })
  const linkedCollectionIds = new Set(links.map((l) => l.collectionId))

  return {
    anime: animeData,
    collectionsData: {
      containing: staticCollections.filter((c) => linkedCollectionIds.has(c.id)),
      notContaining: staticCollections.filter((c) => !linkedCollectionIds.has(c.id))
    }
  }
}

const { data, refetch } = useAsyncData(fetchAnimeData, {
  watch: [() => props.animeId, showNsfw],
  enabled: () => props.enabled
})

const anime = computed(() => data.value?.anime ?? null)
const collectionsData = computed(() => data.value?.collectionsData ?? null)
const canOpenAnimeDir = computed(() => !!anime.value?.animeDirPath)

const extensionMenuInput = computed(
  () =>
    ({
      domain: 'anime',
      scope: 'single',
      entityId: props.animeId
    }) as const
)

useDbChanges(({ operation, table, id }) => {
  if (operation === 'updated') {
    if (table === 'animes' && id === props.animeId) refetch()
    if (table === 'collection_anime_links') refetch()
    if (table === 'collections') refetch()
  }
  if (operation === 'inserted') {
    if (table === 'collection_anime_links' || table === 'collections') refetch()
  }
  if (operation === 'deleted') {
    if (table === 'collection_anime_links' || table === 'collections') refetch()
  }
})

// Action handlers
async function handleAddToCollection(collectionId: string) {
  try {
    await db.insert(collectionAnimeLinks).values({
      id: nanoid(),
      collectionId,
      animeId: props.animeId
    })
    notify.success(m.value.library.feedback.addedToCollection)
  } catch {
    notify.error(m.value.library.feedback.addFailed)
  }
}

async function handleRemoveFromCollection(collectionId: string) {
  try {
    await db
      .delete(collectionAnimeLinks)
      .where(
        and(
          eq(collectionAnimeLinks.animeId, props.animeId),
          eq(collectionAnimeLinks.collectionId, collectionId)
        )
      )
    notify.success(m.value.library.feedback.removedFromCollection)
  } catch {
    notify.error(m.value.library.feedback.removeFailed)
  }
}

// Computed model for status dropdown
const statusModel = computed({
  get: () => anime.value?.status,
  set: async (status: AnimeStatus | undefined) => {
    if (!status) return
    try {
      await db.update(animes).set({ status }).where(eq(animes.id, props.animeId))
      notify.success(m.value.library.feedback.statusUpdated)
    } catch {
      notify.error(m.value.library.feedback.updateFailed)
    }
  }
})

async function handleToggleNsfw() {
  if (!anime.value) return
  try {
    await db.update(animes).set({ isNsfw: !anime.value.isNsfw }).where(eq(animes.id, props.animeId))
    notify.success(
      anime.value.isNsfw
        ? m.value.library.feedback.nsfwCleared
        : m.value.library.feedback.nsfwMarked
    )
  } catch {
    notify.error(m.value.common.operationFailed)
  }
}

async function handleToggleFavorite() {
  if (!anime.value) return
  try {
    await db
      .update(animes)
      .set({ isFavorite: !anime.value.isFavorite })
      .where(eq(animes.id, props.animeId))
    notify.success(
      anime.value.isFavorite
        ? m.value.library.feedback.favoriteRemoved
        : m.value.library.feedback.favoriteAdded
    )
  } catch {
    notify.error(m.value.common.operationFailed)
  }
}

async function handleOpenAnimeDir() {
  const pathToOpen = anime.value?.animeDirPath
  if (!pathToOpen) {
    notify.error(m.value.anime.detail.animeDirNotSet)
    return
  }
  const result = await ipcManager.invoke('native:open-path', { path: pathToOpen, ensure: 'folder' })
  if (!result.success) {
    notify.error(m.value.anime.files.openFolderFailed)
  }
}
</script>

<template>
  <!-- Only render when data is ready - no loading state to avoid flicker -->
  <template v-if="anime && collectionsData">
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

    <!-- Remove from Collection - only show if anime is in any collection -->
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

    <!-- Watch Status -->
    <component :is="props.components.Sub">
      <component :is="props.components.SubTrigger">
        <Icon
          icon="icon-[mdi--bookmark-outline]"
          class="size-4"
        />
        {{ m.anime.detail.watchStatus }}
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
    </component>

    <component :is="props.components.Separator" />

    <!-- Toggle Favorite -->
    <component
      :is="props.components.CheckboxItem"
      :model-value="!!anime.isFavorite"
      @select="handleToggleFavorite"
    >
      <Icon
        icon="icon-[mdi--heart-outline]"
        class="size-4"
      />
      {{ m.library.menu.favorite }}
    </component>

    <!-- Toggle NSFW -->
    <component
      :is="props.components.CheckboxItem"
      :model-value="!!anime.isNsfw"
      @select="handleToggleNsfw"
    >
      <Icon
        icon="icon-[mdi--coffee-outline]"
        class="size-4"
      />
      NSFW
    </component>

    <component :is="props.components.Separator" />

    <!-- Open Anime Directory -->
    <component
      :is="props.components.Item"
      :disabled="!canOpenAnimeDir"
      @select="handleOpenAnimeDir"
    >
      <Icon
        icon="icon-[mdi--folder-open-outline]"
        class="size-4"
      />
      {{ m.anime.detail.openAnimeDir }}
    </component>

    <!-- Files Configuration -->
    <component
      :is="props.components.Item"
      @select="emit('openFilesConfigDialog')"
    >
      <Icon
        icon="icon-[mdi--folder-cog-outline]"
        class="size-4"
      />
      {{ m.anime.filesConfig.title }}
    </component>

    <!-- Media Management -->
    <component
      :is="props.components.Item"
      @select="emit('openMediaDialog')"
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
