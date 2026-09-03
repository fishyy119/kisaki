<script setup lang="ts">
/**
 * Scanner Page
 *
 * Main scanner management page listing all configured scanners.
 */

import { computed } from 'vue'
import { useScanners } from '../composables'
import { StateView } from '@renderer/components/ui/state-view'
import { Table, TableBody, type TableColumn } from '@renderer/components/ui/table'
import { ScannerHeader, ScannerEmptyState, ScannerItem } from '../components'
import { useI18n } from '@renderer/composables/use-i18n'

// Data committed by the route query before the page mounts
const { entries, error } = useScanners()

const { m } = useI18n()

// Reads as a table down to about 48rem (name 12 + fixed 32 + padding); below
// the 4xl step the rows reflow into cards.
const columns = computed<TableColumn[]>(() => [
  { label: m.value.scanner.table.name },
  { label: m.value.scanner.table.type, width: '5rem', align: 'center' },
  { label: m.value.scanner.table.scraperProfile, width: '13%', align: 'center', tone: 'muted' },
  { label: m.value.scanner.table.targetCollection, width: '13%', align: 'center', tone: 'muted' },
  { label: m.value.scanner.table.newExisting, width: '10rem', align: 'center' },
  { label: m.value.scanner.table.status, width: '7rem', align: 'center' },
  { label: m.value.scanner.table.actions, width: '10rem', align: 'end', role: 'actions' }
])
</script>

<template>
  <StateView
    v-if="error"
    state="error"
    :error="error"
    class="h-full bg-background"
  />

  <div
    v-else
    class="flex flex-col h-full"
  >
    <!-- Page header -->
    <ScannerHeader />

    <!-- Main content - Table-like list -->
    <div class="flex-1 min-h-0 bg-background">
      <!-- Empty -->
      <ScannerEmptyState v-if="entries.length === 0" />

      <!-- Scanner list -->
      <Table
        v-else
        fixed-header
        inset
        reflow-below="4xl"
        :columns="columns"
      >
        <TableBody>
          <ScannerItem
            v-for="entry in entries"
            :key="entry.scanner.id"
            :scanner="entry.scanner"
            :target-collection-name="entry.targetCollectionName"
            :scraper-profile-name="entry.scraperProfileName"
          />
        </TableBody>
      </Table>
    </div>
  </div>
</template>
