<script setup lang="ts">
/**
 * Scanner Page
 *
 * Main scanner management page.
 * Provides scanner context and displays list of scanners.
 */

import { useScannerProvider } from '../composables'
import { useRenderState } from '@renderer/composables'
import { StateView } from '@renderer/components/ui/state-view'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@renderer/components/ui/table'
import { ScannerHeader, ScannerEmptyState, ScannerItem } from '../components'

// =============================================================================
// Context Provider
// =============================================================================

const { scanners, isLoading } = useScannerProvider()
const state = useRenderState(isLoading, null, scanners)

const SCANNER_TABLE_COLUMNS = ['', '6rem', '8rem', '7rem', '7rem', '5rem', '11rem']
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Page header -->
    <ScannerHeader />

    <!-- Main content - Table-like list -->
    <div class="flex-1 min-h-0 bg-background">
      <!-- Loading -->
      <StateView
        v-if="state === 'loading'"
        state="loading"
        class="h-full"
      />

      <!-- Empty -->
      <ScannerEmptyState v-else-if="scanners.length === 0" />

      <!-- Scanner list -->
      <Table
        v-else
        fixed-header
        :columns="SCANNER_TABLE_COLUMNS"
      >
        <template #header>
          <TableHeader>
            <TableRow class="h-8">
              <TableHead class="pl-4">名称</TableHead>
              <TableHead class="text-center">类型</TableHead>
              <TableHead class="text-center">刮削配置</TableHead>
              <TableHead class="text-center">目标合集</TableHead>
              <TableHead class="text-center">新增 / 已存</TableHead>
              <TableHead class="text-center">状态</TableHead>
              <TableHead class="pr-4 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
        </template>

        <TableBody>
          <ScannerItem
            v-for="scanner in scanners"
            :key="scanner.id"
            :scanner="scanner"
          />
        </TableBody>
      </Table>
    </div>
  </div>
</template>
