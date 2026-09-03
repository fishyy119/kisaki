<!--
  EntityCopyMenuItems
  The "Copy" submenu of every entity menu: the entity's stable references for
  automation and sharing. Ids are never displayed as fields; this action is how
  the UI hands them out. The launch link exists only for consumable media.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { useI18n } from '@renderer/composables/use-i18n'
import { copyToClipboard } from '@renderer/core/clipboard'
import type { MenuComponents } from '@renderer/types'
import { buildLaunchDeeplinkUrl, buildOpenDeeplinkUrl } from '@shared/deeplink'
import { isMediaType, type AllEntityType } from '@shared/entity-types'

interface Props {
  entityType: AllEntityType
  entityId: string
  components: MenuComponents
}

const props = defineProps<Props>()

const { m } = useI18n()

const mediaType = computed(() => (isMediaType(props.entityType) ? props.entityType : null))

function handleCopyId() {
  void copyToClipboard(props.entityId)
}

function handleCopyPageLink() {
  void copyToClipboard(buildOpenDeeplinkUrl(props.entityType, props.entityId))
}

function handleCopyLaunchLink() {
  if (!mediaType.value) return
  void copyToClipboard(buildLaunchDeeplinkUrl(mediaType.value, props.entityId))
}
</script>

<template>
  <component :is="props.components.Sub">
    <component :is="props.components.SubTrigger">
      <Icon
        icon="icon-[mdi--content-copy]"
        class="size-4"
      />
      {{ m.library.menu.copy }}
    </component>
    <component
      :is="props.components.SubContent"
      class="min-w-44"
    >
      <component
        :is="props.components.Item"
        @select="handleCopyId"
      >
        {{ m.library.menu.copyId }}
      </component>
      <component
        :is="props.components.Item"
        @select="handleCopyPageLink"
      >
        {{ m.library.menu.copyPageLink }}
      </component>
      <component
        :is="props.components.Item"
        v-if="mediaType"
        @select="handleCopyLaunchLink"
      >
        {{ m.library.menu.copyLaunchLink }}
      </component>
    </component>
  </component>
</template>
