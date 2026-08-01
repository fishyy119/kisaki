<!--
  CharacterMenuItems
  Unified character menu items that work with both ContextMenu and DropdownMenu.
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
import { ExtensionEntityMenuItems } from '@renderer/components/extension/entity-menus'
import { usePreferencesStore } from '@renderer/stores'
import { characters, collections, collectionCharacterLinks, type Character } from '@shared/db'
import type { MenuComponents } from '@renderer/types'

interface Props {
  characterId: string
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
  openMediaDialog: []
  openMetadataUpdateDialog: []
  openExternalIdsDialog: []
  openMergeDialog: []
  openDeleteDialog: []
  openNewCollectionDialog: []
}>()

type CollectionData = { id: string; name: string }

interface CharacterMenuData {
  character: Character
  collectionsData: {
    containing: CollectionData[]
    notContaining: CollectionData[]
  }
}

async function fetchCharacter(): Promise<CharacterMenuData | null> {
  const characterData = await db.query.characters.findFirst({
    where: eq(characters.id, props.characterId)
  })
  if (!characterData) return null

  // Fetch static collections only (dynamic collections can't be manually modified)
  const staticCollections = await db.query.collections.findMany({
    where: and(
      eq(collections.isDynamic, false),
      showNsfw.value ? undefined : eq(collections.isNsfw, false)
    ),
    orderBy: (c, { asc }) => asc(c.order)
  })
  const links = await db.query.collectionCharacterLinks.findMany({
    where: eq(collectionCharacterLinks.characterId, props.characterId)
  })
  const linkedCollectionIds = new Set(links.map((l) => l.collectionId))

  return {
    character: characterData,
    collectionsData: {
      containing: staticCollections.filter((c) => linkedCollectionIds.has(c.id)),
      notContaining: staticCollections.filter((c) => !linkedCollectionIds.has(c.id))
    }
  }
}

const { data, refetch } = useAsyncData(fetchCharacter, {
  watch: [() => props.characterId, showNsfw],
  enabled: () => props.enabled
})

const character = computed(() => data.value?.character ?? null)
const collectionsData = computed(() => data.value?.collectionsData ?? null)

const extensionMenuInput = computed(
  () =>
    ({
      domain: 'character',
      scope: 'single',
      entityId: props.characterId
    }) as const
)

useDbChanges(({ operation, table, id }) => {
  if (operation === 'updated') {
    if (table === 'characters' && id === props.characterId) refetch()
    if (table === 'collection_character_links') refetch()
    if (table === 'collections') refetch()
  }
  if (operation === 'inserted') {
    if (table === 'collection_character_links' || table === 'collections') refetch()
  }
  if (operation === 'deleted') {
    if (table === 'collection_character_links' || table === 'collections') refetch()
  }
})

// Action handlers
async function handleAddToCollection(collectionId: string) {
  try {
    await db.insert(collectionCharacterLinks).values({
      id: nanoid(),
      collectionId,
      characterId: props.characterId
    })
    notify.success(m.value.library.feedback.addedToCollection)
  } catch {
    notify.error(m.value.library.feedback.addFailed)
  }
}

async function handleRemoveFromCollection(collectionId: string) {
  try {
    await db
      .delete(collectionCharacterLinks)
      .where(
        and(
          eq(collectionCharacterLinks.characterId, props.characterId),
          eq(collectionCharacterLinks.collectionId, collectionId)
        )
      )
    notify.success(m.value.library.feedback.removedFromCollection)
  } catch {
    notify.error(m.value.library.feedback.removeFailed)
  }
}

async function handleToggleFavorite() {
  if (!character.value) return
  try {
    await db
      .update(characters)
      .set({ isFavorite: !character.value.isFavorite })
      .where(eq(characters.id, props.characterId))
    notify.success(
      character.value.isFavorite
        ? m.value.library.feedback.favoriteRemoved
        : m.value.library.feedback.favoriteAdded
    )
  } catch {
    notify.error(m.value.common.operationFailed)
  }
}

async function handleToggleNsfw() {
  if (!character.value) return
  try {
    await db
      .update(characters)
      .set({ isNsfw: !character.value.isNsfw })
      .where(eq(characters.id, props.characterId))
    notify.success(
      character.value.isNsfw
        ? m.value.library.feedback.nsfwCleared
        : m.value.library.feedback.nsfwMarked
    )
  } catch {
    notify.error(m.value.common.operationFailed)
  }
}

const displayScore = computed(() =>
  character.value?.score !== null && character.value?.score !== undefined
    ? (character.value.score / 10).toFixed(1)
    : null
)
</script>

<template>
  <!-- Only render when data is ready - no loading state to avoid flicker -->
  <template v-if="character && collectionsData">
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

    <!-- Remove from Collection - only show if character is in any collection -->
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
      :model-value="!!character.isFavorite"
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
      :model-value="!!character.isNsfw"
      @select="handleToggleNsfw"
    >
      <Icon
        icon="icon-[mdi--coffee-outline]"
        class="size-4"
      />
      NSFW
    </component>

    <component :is="props.components.Separator" />

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
