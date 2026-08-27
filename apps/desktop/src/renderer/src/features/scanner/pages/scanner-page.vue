<script setup lang="ts">
/**
 * Scanner Page
 *
 * Main scanner management page listing all configured scanners.
 */

import { useScanners } from '../composables'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@renderer/components/ui/table'
import { ScannerHeader, ScannerEmptyState, ScannerItem } from '../components'
import { useI18n } from '@renderer/composables/use-i18n'

// Data settled during navigation by the route loader
const { scanners } = useScanners()

const SCANNER_TABLE_COLUMNS = ['', '5rem', '13%', '13%', '10rem', '7rem', '10rem']

const { m } = useI18n()
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Page header -->
    <ScannerHeader />

    <!-- Main content - Table-like list -->
    <div class="flex-1 min-h-0 bg-background">
      <!-- Empty -->
      <ScannerEmptyState v-if="scanners.length === 0" />

      <!-- Scanner list -->
      <Table
        v-else
        fixed-header
        :columns="SCANNER_TABLE_COLUMNS"
      >
        <template #header>
          <TableHeader>
            <TableRow class="h-8">
              <TableHead class="pl-4">{{ m.scanner.table.name }}</TableHead>
              <TableHead class="text-center">{{ m.scanner.table.type }}</TableHead>
              <TableHead class="text-center">{{ m.scanner.table.scraperProfile }}</TableHead>
              <TableHead class="text-center">{{ m.scanner.table.targetCollection }}</TableHead>
              <TableHead class="text-center">{{ m.scanner.table.newExisting }}</TableHead>
              <TableHead class="text-center">{{ m.scanner.table.status }}</TableHead>
              <TableHead class="pr-4 text-right">{{ m.scanner.table.actions }}</TableHead>
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
