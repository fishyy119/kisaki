<script setup lang="ts">
/**
 * ExplorerFooter - Bottom statistics
 *
 * Shows entity count and type, plus the locate affordance whenever the
 * current detail entity's row is not inside the list viewport.
 */

import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { Icon } from '@renderer/components/ui/icon'
import { useLibraryExplorerStore } from '../../stores'
import { useExplorerList, useExplorerLocator } from '../../composables'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

const store = useLibraryExplorerStore()
const { activeEntityType } = storeToRefs(store)
const { data } = useExplorerList()
const locator = useExplorerLocator()

const countText = computed(() =>
  m.value.library.counts[activeEntityType.value]({ count: data.value.totalCount })
)
</script>

<template>
  <div
    class="shrink-0 flex items-center h-8 px-3 border-t text-xs tabular-nums text-muted-foreground/60"
  >
    {{ countText }}

    <button
      v-if="locator.showLocateButton.value"
      class="ml-auto -mr-1.5 flex items-center justify-center size-5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent active:bg-accent/80 transition-colors"
      :title="m.library.explorer.locate"
      @click="locator.reveal('user')"
    >
      <Icon
        icon="icon-[mdi--crosshairs-gps]"
        class="size-3.5"
      />
    </button>
  </div>
</template>
