<!--
  CollectionMenuItems
  Unified collection menu items that work with both ContextMenu and DropdownMenu.
  Self-contained: fetches its own data and handles mutations internally.
  Pass different menu components via `components` prop for polymorphism.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { eq } from 'drizzle-orm'
import { Icon } from '@renderer/components/ui/icon'
import { useLiveQuery, useI18n } from '@renderer/composables'
import { notify } from '@renderer/core/notify'
import { db } from '@renderer/core/db'
import { ExtensionEntityMenuItems } from '@renderer/components/extension/entity-menus'
import { EntityCopyMenuItems } from '@renderer/components/shared/entity'
import { collections, type Collection } from '@shared/db'
import type { MenuComponents } from '@renderer/types'

interface Props {
  collectionId: string
  /** Whether to fetch data - for lazy loading in context menu */
  enabled?: boolean
  /** Menu component primitives to use */
  components: MenuComponents
}

const props = withDefaults(defineProps<Props>(), {
  enabled: true
})

const { m } = useI18n()

const emit = defineEmits<{
  openEditMetadataDialog: []
  openEditEntitiesDialog: []
  openEditFilterDialog: []
  openConvertDialog: []
  openMergeDialog: []
  openDeleteDialog: []
}>()

async function fetchCollection(): Promise<Collection | null> {
  const data = await db.query.collections.findFirst({
    where: eq(collections.id, props.collectionId)
  })
  return data ?? null
}

const { data: collection } = useLiveQuery(fetchCollection, {
  watch: [() => props.collectionId],
  enabled: () => props.enabled,
  invalidate: { tables: ['collections'] }
})

const isDynamic = computed(() => collection.value?.isDynamic ?? false)

const extensionMenuInput = computed(
  () =>
    ({
      domain: 'collection',
      scope: 'single',
      entityId: props.collectionId
    }) as const
)

async function handleToggleNsfw() {
  if (!collection.value) return
  try {
    await db
      .update(collections)
      .set({ isNsfw: !collection.value.isNsfw })
      .where(eq(collections.id, props.collectionId))
    notify.success(
      collection.value.isNsfw
        ? m.value.library.feedback.nsfwCleared
        : m.value.library.feedback.nsfwMarked
    )
  } catch {
    notify.error(m.value.feedback.operationFailed)
  }
}
</script>

<template>
  <!-- Only render when data is ready - no loading state to avoid flicker -->
  <template v-if="collection">
    <!-- Edit Collection Metadata -->
    <component
      :is="props.components.Item"
      @select="emit('openEditMetadataDialog')"
    >
      <Icon
        icon="icon-[mdi--pencil-outline]"
        class="size-4"
      />
      {{ m.library.menu.editInfo }}
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

    <!-- Static: Edit Entities -->
    <component
      :is="props.components.Item"
      v-if="!isDynamic"
      @select="emit('openEditEntitiesDialog')"
    >
      <Icon
        icon="icon-[mdi--format-list-numbered]"
        class="size-4"
      />
      {{ m.library.menu.editContent }}
    </component>

    <!-- Dynamic: Edit Filter -->
    <component
      :is="props.components.Item"
      v-if="isDynamic"
      @select="emit('openEditFilterDialog')"
    >
      <Icon
        icon="icon-[mdi--filter-outline]"
        class="size-4"
      />
      {{ m.library.menu.editFilter }}
    </component>

    <!-- Dynamic: Convert to Static -->
    <template v-if="isDynamic">
      <component
        :is="props.components.Item"
        @select="emit('openConvertDialog')"
      >
        <Icon
          icon="icon-[mdi--subdirectory-arrow-left]"
          class="size-4"
        />
        {{ m.library.menu.convertToStatic }}
      </component>
    </template>

    <component :is="props.components.Separator" />

    <!-- NSFW -->
    <component
      :is="props.components.CheckboxItem"
      :model-value="!!collection.isNsfw"
      @select="handleToggleNsfw"
    >
      <Icon
        icon="icon-[mdi--coffee-outline]"
        class="size-4"
      />
      NSFW
    </component>

    <ExtensionEntityMenuItems
      :input="extensionMenuInput"
      :components="props.components"
      :enabled="props.enabled"
    />

    <component :is="props.components.Separator" />

    <EntityCopyMenuItems
      entity-type="collection"
      :entity-id="props.collectionId"
      :components="props.components"
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
      {{ m.actions.delete }}
    </component>
  </template>
</template>
