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
import { ScannerItemFormDialog } from './scanner-item-form-dialog'

// =============================================================================
// State
// =============================================================================

const isCreateDialogOpen = ref(false)
</script>

<template>
  <StateView
    state="empty"
    icon="icon-[mdi--folder-search-outline]"
    title="暂无扫描器"
    description="添加扫描器来自动发现并导入你的媒体文件"
    class="h-full"
  >
    <template #actions>
      <Button @click="isCreateDialogOpen = true">
        <Icon
          icon="icon-[mdi--folder-plus-outline]"
          class="size-4"
        />
        添加扫描器
      </Button>
    </template>
  </StateView>

  <ScannerItemFormDialog
    v-if="isCreateDialogOpen"
    v-model:open="isCreateDialogOpen"
  />
</template>
