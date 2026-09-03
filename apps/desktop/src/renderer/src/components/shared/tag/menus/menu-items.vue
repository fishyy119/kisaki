<!--
  TagMenuItems
  Unified tag menu items that work with both ContextMenu and DropdownMenu.
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
import { tags, type Tag } from '@shared/db'
import type { MenuComponents } from '@renderer/types'

interface Props {
  tagId: string
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
  openEditDialog: []
  openMergeDialog: []
  openDeleteDialog: []
}>()

async function fetchTag(): Promise<Tag | null> {
  const data = await db.query.tags.findFirst({ where: eq(tags.id, props.tagId) })
  return data ?? null
}

const { data: tag } = useLiveQuery(fetchTag, {
  watch: [() => props.tagId],
  enabled: () => props.enabled,
  invalidate: { tables: ['tags'] }
})

const extensionMenuInput = computed(
  () =>
    ({
      domain: 'tag',
      scope: 'single',
      entityId: props.tagId
    }) as const
)

async function handleToggleNsfw() {
  if (!tag.value) return
  try {
    await db.update(tags).set({ isNsfw: !tag.value.isNsfw }).where(eq(tags.id, props.tagId))
    notify.success(
      tag.value.isNsfw ? m.value.library.feedback.nsfwCleared : m.value.library.feedback.nsfwMarked
    )
  } catch {
    notify.error(m.value.feedback.operationFailed)
  }
}
</script>

<template>
  <!-- Only render when data is ready - no loading state to avoid flicker -->
  <template v-if="tag">
    <!-- Edit -->
    <component
      :is="props.components.Item"
      @select="emit('openEditDialog')"
    >
      <Icon
        icon="icon-[mdi--pencil-outline]"
        class="size-4"
      />
      {{ m.actions.edit }}
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

    <component :is="props.components.Separator" />

    <!-- NSFW -->
    <component
      :is="props.components.CheckboxItem"
      :model-value="!!tag.isNsfw"
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
      entity-type="tag"
      :entity-id="props.tagId"
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
