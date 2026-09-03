<script setup lang="ts">
/**
 * ExplorerFooter - Bottom statistics
 *
 * Shows entity count and type, plus the scroll aids: back to top once the
 * list is scrolled deep, and the locate affordance whenever the current
 * detail entity's row is not inside the list viewport. The footer is the
 * explorer's home for the back-to-top device (a surface with a footer strip
 * hosts it there rather than as an overlay); the explorer wires the device
 * to its scroll region and hands the footer the controls.
 */

import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { Icon } from '@renderer/components/ui/icon'
import { BACK_TO_TOP_ICON, type BackToTopControls } from '@renderer/components/ui/scroll-region'
import { useLibraryExplorerStore } from '../../stores'
import { useExplorerList, useExplorerLocator } from '../../composables'
import { useI18n } from '@renderer/composables/use-i18n'

const props = defineProps<{
  /** Back-to-top controls of the explorer list's scroll region. */
  backToTop: BackToTopControls
}>()

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

    <div class="ml-auto -mr-1.5 flex items-center gap-0.5">
      <button
        v-if="props.backToTop.visible.value"
        type="button"
        class="flex items-center justify-center size-5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent active:bg-accent/80 transition-colors"
        :title="m.actions.backToTop"
        @click="props.backToTop.scrollToTop()"
      >
        <Icon
          :icon="BACK_TO_TOP_ICON"
          class="size-3.5"
        />
      </button>

      <button
        v-if="locator.showLocateButton.value"
        type="button"
        class="flex items-center justify-center size-5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent active:bg-accent/80 transition-colors"
        :title="m.library.explorer.locate"
        @click="locator.reveal('user')"
      >
        <Icon
          icon="icon-[mdi--crosshairs-gps]"
          class="size-3.5"
        />
      </button>
    </div>
  </div>
</template>
