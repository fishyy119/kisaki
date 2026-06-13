<script setup lang="ts">
/**
 * Scanner Page
 *
 * Main scanner management page.
 * Provides scanner context and displays list of scanners.
 */

import { useScannerProvider } from '../composables'
import { useRenderState } from '@renderer/composables'
import { Spinner } from '@renderer/components/ui/spinner'
import { ScannerHeader, ScannerEmptyState, ScannerItem } from '../components'
import { SCANNER_LIST_GRID_TEMPLATE } from '../utils/scanner-list-layout'

// =============================================================================
// Context Provider
// =============================================================================

const { scanners, isLoading } = useScannerProvider()
const state = useRenderState(isLoading, null, scanners)
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Page header -->
    <ScannerHeader />

    <!-- Main content - Table-like list -->
    <div class="flex-1 min-h-0">
      <!-- Loading -->
      <div
        v-if="state === 'loading'"
        class="flex items-center justify-center h-full"
      >
        <Spinner class="size-8" />
      </div>

      <!-- Empty -->
      <ScannerEmptyState v-else-if="scanners.length === 0" />

      <!-- Scanner list -->
      <div
        v-else
        class="h-full overflow-auto"
      >
        <!-- Table header -->
        <div
          class="sticky top-0 z-10 grid items-center h-8 px-4 text-xs font-medium text-muted-foreground border-b border-border bg-background"
          :style="{ gridTemplateColumns: SCANNER_LIST_GRID_TEMPLATE }"
        >
          <div class="min-w-0">名称</div>
          <div class="text-center">类型</div>
          <div class="text-center">刮削配置</div>
          <div class="text-center">目标合集</div>
          <div class="text-center">新增 / 已存</div>
          <div class="text-center">状态</div>
          <div class="text-right">操作</div>
        </div>

        <!-- Scanner rows -->
        <div class="divide-y divide-border/50">
          <ScannerItem
            v-for="scanner in scanners"
            :key="scanner.id"
            :scanner="scanner"
          />
        </div>
      </div>
    </div>
  </div>
</template>
