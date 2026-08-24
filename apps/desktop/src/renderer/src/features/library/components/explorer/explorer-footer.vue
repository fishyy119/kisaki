<script setup lang="ts">
/**
 * ExplorerFooter - Bottom statistics
 *
 * Shows entity count and type.
 */

import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useLibraryExplorerStore } from '../../stores'
import { useExplorerList } from '../../composables'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

const store = useLibraryExplorerStore()
const { activeEntityType } = storeToRefs(store)
const { data } = useExplorerList()

const countText = computed(() =>
  m.value.library.counts[activeEntityType.value]({ count: data.value.totalCount })
)
</script>

<template>
  <div
    class="shrink-0 flex items-center h-8 px-3 border-t text-xs tabular-nums text-muted-foreground/60"
  >
    {{ countText }}
  </div>
</template>
