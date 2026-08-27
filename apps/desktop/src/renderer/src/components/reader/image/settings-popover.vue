<!--
Every presentation setting of image-rendered units in one place: page flow,
how pages share a screen, how they fit the viewport, and the display
corrections applied to scanned pages — the image engine's counterpart of the
text engine's typography popover.
Boundary: layout, fit, and display corrections are device preferences in the
reader settings store; page flow belongs to the entry being read, so the shell
owns it through the model and decides whether the choice persists.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import type { ComicReadingDirection } from '@shared/db/contracts/enums'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { SegmentedControl, SegmentedControlItem } from '@renderer/components/ui/segmented-control'
import { Separator } from '@renderer/components/ui/separator'
import { Switch } from '@renderer/components/ui/switch'
import { useI18n } from '@renderer/composables/use-i18n'
import { PAGE_DISPLAY_RANGES } from '@renderer/core/reader/image/display'
import type { PageFitMode } from '@renderer/core/reader/image/layout'
import { useReaderSettingsStore } from '@renderer/stores/reader-settings'
import SettingSlider from '../chrome/setting-slider.vue'

const pageFlow = defineModel<ComicReadingDirection>('pageFlow', { required: true })

const { m } = useI18n()
const settings = useReaderSettingsStore()
const { pageLayout, pageFit, brightness, contrast, autoCrop } = storeToRefs(settings)

const FLOW_OPTIONS: ComicReadingDirection[] = ['rtl', 'ltr', 'vertical']

const flowLabels = computed<Record<ComicReadingDirection, string>>(() => ({
  rtl: m.value.reader.image.pageFlowRtl,
  ltr: m.value.reader.image.pageFlowLtr,
  vertical: m.value.reader.image.pageFlowVertical
}))

const fitOptions = computed<{ value: PageFitMode; label: string; icon: string }[]>(() => [
  { value: 'page', label: m.value.reader.image.fitPage, icon: 'icon-[mdi--fit-to-page-outline]' },
  {
    value: 'width',
    label: m.value.reader.image.fitWidth,
    icon: 'icon-[mdi--arrow-expand-horizontal]'
  },
  {
    value: 'height',
    label: m.value.reader.image.fitHeight,
    icon: 'icon-[mdi--arrow-expand-vertical]'
  }
])

const isVertical = computed(() => pageFlow.value === 'vertical')

/** Single or double; the cover offset rides on double as a separate switch. */
const layoutChoice = computed<string>({
  get: () => (pageLayout.value === 'single' ? 'single' : 'double'),
  set: (value) => {
    if (value === 'single') pageLayout.value = 'single'
    else if (pageLayout.value === 'single') pageLayout.value = 'double-cover'
  }
})

const coverAlone = computed<boolean>({
  get: () => pageLayout.value === 'double-cover',
  set: (value) => {
    pageLayout.value = value ? 'double-cover' : 'double'
  }
})

function handleFlowChange(value: string | undefined): void {
  if (value === 'rtl' || value === 'ltr' || value === 'vertical') pageFlow.value = value
}

function handleFitChange(value: string | undefined): void {
  if (value === 'page' || value === 'width' || value === 'height') pageFit.value = value
}
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <Button
        variant="ghost"
        size="icon-sm"
        :tooltip="m.reader.image.settingsOpen"
      >
        <Icon
          icon="icon-[mdi--tune-variant]"
          class="size-4"
        />
      </Button>
    </PopoverTrigger>
    <PopoverContent
      align="end"
      class="w-80 space-y-3"
    >
      <div class="space-y-1.5">
        <span class="text-xs text-muted-foreground">{{ m.reader.image.pageFlow }}</span>
        <SegmentedControl
          :model-value="pageFlow"
          class="w-full"
          @update:model-value="handleFlowChange"
        >
          <SegmentedControlItem
            v-for="option in FLOW_OPTIONS"
            :key="option"
            :value="option"
            class="flex-1"
          >
            {{ flowLabels[option] }}
          </SegmentedControlItem>
        </SegmentedControl>
      </div>

      <Separator />

      <div class="space-y-1.5">
        <span class="text-xs text-muted-foreground">{{ m.reader.image.pageLayout }}</span>
        <SegmentedControl
          v-model="layoutChoice"
          class="w-full"
        >
          <SegmentedControlItem
            value="single"
            class="flex-1"
            :disabled="isVertical"
          >
            <Icon
              icon="icon-[mdi--crop-portrait]"
              class="size-3.5"
            />
            {{ m.reader.image.layoutSingle }}
          </SegmentedControlItem>
          <SegmentedControlItem
            value="double"
            class="flex-1"
            :disabled="isVertical"
          >
            <Icon
              icon="icon-[mdi--book-open-blank-variant-outline]"
              class="size-3.5"
            />
            {{ m.reader.image.layoutDouble }}
          </SegmentedControlItem>
        </SegmentedControl>

        <!-- The cover offset only exists as a refinement of facing pages. -->
        <div
          v-if="!isVertical && layoutChoice === 'double'"
          class="flex items-center justify-between gap-2 pt-1"
        >
          <span class="text-xs text-muted-foreground">{{ m.reader.image.coverAlone }}</span>
          <Switch v-model="coverAlone" />
        </div>
      </div>

      <div class="space-y-1.5">
        <span class="text-xs text-muted-foreground">{{ m.reader.image.fit }}</span>
        <SegmentedControl
          :model-value="pageFit"
          class="w-full"
          @update:model-value="handleFitChange"
        >
          <SegmentedControlItem
            v-for="option in fitOptions"
            :key="option.value"
            :value="option.value"
            class="flex-1"
            :disabled="isVertical"
          >
            <Icon
              :icon="option.icon"
              class="size-3.5"
            />
            {{ option.label }}
          </SegmentedControlItem>
        </SegmentedControl>
      </div>

      <Separator />

      <SettingSlider
        v-model="brightness"
        :label="m.reader.image.brightness"
        :min="PAGE_DISPLAY_RANGES.brightness.min"
        :max="PAGE_DISPLAY_RANGES.brightness.max"
        :step="PAGE_DISPLAY_RANGES.brightness.step"
        :display="m.reader.values.percent({ value: brightness })"
      />
      <SettingSlider
        v-model="contrast"
        :label="m.reader.image.contrast"
        :min="PAGE_DISPLAY_RANGES.contrast.min"
        :max="PAGE_DISPLAY_RANGES.contrast.max"
        :step="PAGE_DISPLAY_RANGES.contrast.step"
        :display="m.reader.values.percent({ value: contrast })"
      />

      <div class="flex items-center justify-between gap-2">
        <span class="text-xs text-muted-foreground">{{ m.reader.image.autoCrop }}</span>
        <Switch v-model="autoCrop" />
      </div>

      <!-- Page flow stays: it is a fact about the entry, not a preference. -->
      <Button
        variant="outline"
        size="sm"
        class="w-full"
        @click="settings.resetPageSettings()"
      >
        {{ m.reader.image.reset }}
      </Button>
    </PopoverContent>
  </Popover>
</template>
