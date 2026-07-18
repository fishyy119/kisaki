<!--
  Statistics Header

  Page header with:
  - Title and icon
  - Report type navigation (RouterLinks styled as ghost buttons)
  - Period navigator (prev/next buttons with label) - hidden for overview
  - Media type selector
-->

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useStatistics } from '../composables'
import { isPeriodBeforeCurrent, shiftPeriod } from '../period'
import { getEntityIcon } from '@renderer/utils/format'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import {
  PageHeader,
  PageHeaderNav,
  PageHeaderTitle,
  type PageHeaderNavItem
} from '@renderer/components/ui/page-header'
import { SegmentedControl, SegmentedControlItem } from '@renderer/components/ui/segmented-control'

const { reportType, currentPeriod, setCurrentPeriod, periodDisplay } = useStatistics()

// Media type (currently only game, future expansion)
const mediaType = ref<'game'>('game')

// Report type navigation items
const reportNavItems: PageHeaderNavItem[] = [
  { label: '总览', routeName: 'statistics-overview' },
  { label: '周报', routeName: 'statistics-weekly' },
  { label: '月报', routeName: 'statistics-monthly' },
  { label: '年报', routeName: 'statistics-yearly' }
]

// Period navigation - only shown for non-overview reports
const showPeriodNav = computed(() => reportType.value !== 'overview')

function navigatePeriod(direction: 'prev' | 'next') {
  const delta = direction === 'prev' ? -1 : 1
  setCurrentPeriod(shiftPeriod(reportType.value, currentPeriod.value, delta))
}

// Only periods before the current one may navigate forward
const canNavigateNext = computed(() => {
  if (reportType.value === 'overview') return false
  return isPeriodBeforeCurrent(reportType.value, currentPeriod.value)
})
</script>

<template>
  <PageHeader>
    <!-- Left: Title + Report Type Navigation -->
    <PageHeaderTitle
      title="统计"
      icon="icon-[mdi--chart-box-outline]"
    />
    <PageHeaderNav :items="reportNavItems" />

    <!-- Right: Period Navigator + Media Selector -->
    <template #actions>
      <!-- Period Navigator (hidden for overview) -->
      <div
        v-if="showPeriodNav"
        class="flex items-center gap-1"
      >
        <Button
          variant="ghost"
          size="icon-sm"
          @click="navigatePeriod('prev')"
        >
          <Icon
            icon="icon-[mdi--chevron-left]"
            class="size-4"
          />
        </Button>
        <span class="min-w-32 text-center text-sm font-medium">
          {{ periodDisplay.label }}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          :disabled="!canNavigateNext"
          @click="navigatePeriod('next')"
        >
          <Icon
            icon="icon-[mdi--chevron-right]"
            class="size-4"
          />
        </Button>
      </div>

      <!-- Media Type Selector -->
      <SegmentedControl v-model="mediaType">
        <SegmentedControlItem value="game">
          <div class="flex items-center gap-1.5">
            <Icon
              :icon="getEntityIcon('game')"
              class="size-4"
            />
            <span>游戏</span>
          </div>
        </SegmentedControlItem>
      </SegmentedControl>
    </template>
  </PageHeader>
</template>
