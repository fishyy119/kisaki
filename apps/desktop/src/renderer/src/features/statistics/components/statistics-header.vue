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
import { getYearWeek, getWeekStartDate } from '@renderer/utils/datetime'
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
  const current = currentPeriod.value
  const delta = direction === 'prev' ? -1 : 1

  switch (reportType.value) {
    case 'weekly': {
      // Navigate weeks
      const date = getWeekStartDate(current.year, current.week!)
      date.setDate(date.getDate() + delta * 7)
      const { year, week } = getYearWeek(date)
      setCurrentPeriod({ year, week })
      break
    }
    case 'monthly': {
      // Navigate months
      let newMonth = current.month! + delta
      let newYear = current.year
      if (newMonth < 1) {
        newMonth = 12
        newYear--
      }
      if (newMonth > 12) {
        newMonth = 1
        newYear++
      }
      setCurrentPeriod({ year: newYear, month: newMonth })
      break
    }
    case 'yearly': {
      // Navigate years
      setCurrentPeriod({ year: current.year + delta })
      break
    }
  }
}

// Check if can navigate to future
const canNavigateNext = computed(() => {
  const now = new Date()
  const current = currentPeriod.value

  switch (reportType.value) {
    case 'weekly': {
      const { year, week } = getYearWeek(now)
      return current.year < year || (current.year === year && current.week! < week)
    }
    case 'monthly':
      return (
        current.year < now.getFullYear() ||
        (current.year === now.getFullYear() && current.month! < now.getMonth() + 1)
      )
    case 'yearly':
      return current.year < now.getFullYear()
    default:
      return false
  }
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
