<script setup lang="ts">
/**
 * Scanner Empty State
 *
 * Empty state component for scanner page.
 * Self-contained: handles its own dialog state.
 */

import { ref } from 'vue'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import { StateView } from '@renderer/components/ui/state-view'
import { ScannerFormDialog } from './scanner-form-dialog'
import { useI18n } from '@renderer/composables/use-i18n'

// =============================================================================
// State
// =============================================================================

const isCreateDialogOpen = ref(false)

const { m } = useI18n()
</script>

<template>
  <StateView
    state="empty"
    icon="icon-[mdi--folder-search-outline]"
    :title="m.scanner.emptyTitle"
    :description="m.scanner.emptyDescription"
    class="h-full"
  >
    <template #actions>
      <Button @click="isCreateDialogOpen = true">
        <Icon
          icon="icon-[mdi--folder-plus-outline]"
          class="size-4"
        />
        {{ m.scanner.addScanner }}
      </Button>
    </template>
  </StateView>

  <ScannerFormDialog
    v-if="isCreateDialogOpen"
    v-model:open="isCreateDialogOpen"
  />
</template>
