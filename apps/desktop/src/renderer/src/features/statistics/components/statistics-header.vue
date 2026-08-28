<!--
  Statistics Header

  Page header with:
  - Title and icon
  - Report type navigation (RouterLinks styled as ghost buttons)
  - Period navigator (prev/next buttons with label) - hidden for overview
  - Media scope filter (all media or one media type)
-->

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@renderer/composables/use-i18n'
import { useStatistics } from '../composables'
import { STATISTICS_ROUTE_NAMES } from '../routes'
import { isPeriodBeforeCurrent, shiftPeriod } from '../period'
import { getEntityIcon } from '@renderer/utils/format'
import { MEDIA_TYPES } from '@shared/common'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import {
  PageHeader,
  PageHeaderNav,
  PageHeaderTitle,
  type PageHeaderNavItem
} from '@renderer/components/ui/page-header'
import { SegmentedControl, SegmentedControlItem } from '@renderer/components/ui/segmented-control'

const { m } = useI18n()

const { reportType, currentPeriod, setCurrentPeriod, periodDisplay, mediaFilter } = useStatistics()

// Report type navigation items
const reportNavItems = computed<PageHeaderNavItem[]>(() => [
  { label: m.value.statistics.tabs.overview, routeName: STATISTICS_ROUTE_NAMES.overview },
  { label: m.value.statistics.tabs.weekly, routeName: STATISTICS_ROUTE_NAMES.weekly },
  { label: m.value.statistics.tabs.monthly, routeName: STATISTICS_ROUTE_NAMES.monthly },
  { label: m.value.statistics.tabs.yearly, routeName: STATISTICS_ROUTE_NAMES.yearly }
])

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
      :title="m.statistics.title"
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

      <!-- Media scope filter -->
      <SegmentedControl v-model="mediaFilter">
        <SegmentedControlItem value="all">
          <div class="flex items-center gap-1.5">
            <Icon
              icon="icon-[mdi--view-grid-outline]"
              class="size-4"
            />
            <span>{{ m.common.all }}</span>
          </div>
        </SegmentedControlItem>
        <SegmentedControlItem
          v-for="type in MEDIA_TYPES"
          :key="type"
          :value="type"
        >
          <div class="flex items-center gap-1.5">
            <Icon
              :icon="getEntityIcon(type)"
              class="size-4"
            />
            <span>{{ m.library.entities[type] }}</span>
          </div>
        </SegmentedControlItem>
      </SegmentedControl>
    </template>
  </PageHeader>
</template>
