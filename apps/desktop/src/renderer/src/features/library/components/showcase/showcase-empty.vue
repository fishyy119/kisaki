<!--
  LibraryShowcaseEmpty - Empty state
  Shown when there are no sections configured.
-->
<script setup lang="ts">
import { Button } from '@renderer/components/ui/button'
import { useI18n } from '@renderer/composables/use-i18n'

interface Emits {
  (e: 'addSection'): void
}

const emit = defineEmits<Emits>()

const { m } = useI18n()
</script>

<template>
  <div class="h-full flex flex-col items-center justify-center text-center p-8">
    <span class="icon-[mdi--view-dashboard-outline] size-16 text-muted-foreground/30 mb-4" />
    <h2 class="text-lg font-medium mb-2">{{ m.library.showcase.emptyTitle }}</h2>
    <p class="text-sm text-muted-foreground mb-6 max-w-sm">
      {{ m.library.showcase.emptyDescription }}
    </p>
    <Button @click="emit('addSection')">
      <span class="icon-[mdi--plus] size-4 mr-2" />
      {{ m.library.showcase.addFirstSection }}
    </Button>
  </div>
</template>
