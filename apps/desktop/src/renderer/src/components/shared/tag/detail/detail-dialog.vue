<!--
  TagDetailDialog
  Dialog view of a tag: identity in the header, the browse surface in a
  fixed-height body so the band never shifts, the tag's operations in the
  footer.
-->
<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Badge } from '@renderer/components/ui/badge'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { MarkdownContent } from '@renderer/components/ui/markdown'
import { StateView } from '@renderer/components/ui/state-view'
import { EntityDetailDialog, type EntityDetailTarget } from '@renderer/components/shared/entity'
import { useDbChanges, useI18n, useRenderState, useTagDialogProvider } from '@renderer/composables'
import { getEntityIcon } from '@renderer/utils/format'
import type { ContentEntityType } from '@shared/common'
import TagDetailActions from './detail-actions.vue'
import TagDetailContent from './detail-content.vue'

interface Props {
  entityId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const { m } = useI18n()

const {
  tag,
  isLoading,
  error,
  params: { query }
} = useTagDialogProvider(() => props.entityId)
const state = useRenderState(isLoading, error, tag)

useDbChanges(({ changes }) => {
  const deleted = changes.some(
    (change) =>
      change.operation === 'deleted' && change.table === 'tags' && change.id === props.entityId
  )
  if (deleted) open.value = false
})

const openEntity = ref<EntityDetailTarget | null>(null)

function handleOpen(entityType: ContentEntityType, entityId: string) {
  openEntity.value = { entityType, entityId }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="flex max-w-4xl flex-col">
      <!-- Loading / Error / Not Found -->
      <DialogBody v-if="state !== 'success'">
        <StateView
          :state="state"
          :error="error"
          icon="icon-[mdi--tag-off-outline]"
          :title="m.library.detail.notFoundTitle({ label: m.library.entities.tag })"
          :description="m.library.detail.notFoundDescription({ label: m.library.entities.tag })"
          class="py-12"
        />
      </DialogBody>

      <template v-else-if="tag">
        <DialogHeader>
          <div class="flex items-center gap-2">
            <DialogTitle class="flex items-center gap-2">
              <Icon
                :icon="getEntityIcon('tag')"
                class="size-4 text-muted-foreground"
              />
              {{ tag.name }}
            </DialogTitle>
            <Badge
              v-if="tag.isNsfw"
              variant="destructive"
              class="px-1.5 py-0"
            >
              NSFW
            </Badge>
          </div>
          <MarkdownContent
            v-if="tag.description"
            :content="tag.description"
            class="mt-1 line-clamp-2 text-sm text-muted-foreground prose-p:my-0"
          />
        </DialogHeader>

        <DialogBody class="flex h-[min(72vh,660px)] flex-col p-0">
          <TagDetailContent
            v-model:query="query"
            class="min-h-0 flex-1"
            @open="handleOpen"
          />
        </DialogBody>

        <DialogFooter>
          <TagDetailActions :tag-id="tag.id" />
        </DialogFooter>
      </template>
    </DialogContent>
  </Dialog>

  <!-- Detail dialog of the clicked entity -->
  <EntityDetailDialog v-model:target="openEntity" />
</template>
