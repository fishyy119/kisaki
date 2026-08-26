<!--
Display corrections for scanned pages.
Boundary: it only edits the reader settings store; the page engine applies the
result, and the file on disk is never touched.
-->
<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { Separator } from '@renderer/components/ui/separator'
import { Switch } from '@renderer/components/ui/switch'
import { useI18n } from '@renderer/composables/use-i18n'
import { COMIC_DISPLAY_RANGES } from '@renderer/core/reader/display'
import { useReaderSettingsStore } from '@renderer/stores/reader-settings'
import SettingSlider from '../chrome/setting-slider.vue'

const { m } = useI18n()

const settings = useReaderSettingsStore()
const { brightness, contrast, autoCrop } = storeToRefs(settings)
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <Button
        variant="ghost"
        size="icon-sm"
        :tooltip="m.reader.display.open"
      >
        <Icon
          icon="icon-[mdi--brightness-6]"
          class="size-4"
        />
      </Button>
    </PopoverTrigger>
    <PopoverContent
      align="end"
      class="w-72 space-y-3"
    >
      <SettingSlider
        v-model="brightness"
        :label="m.reader.display.brightness"
        :min="COMIC_DISPLAY_RANGES.brightness.min"
        :max="COMIC_DISPLAY_RANGES.brightness.max"
        :step="COMIC_DISPLAY_RANGES.brightness.step"
        :display="m.reader.values.percent({ value: brightness })"
      />
      <SettingSlider
        v-model="contrast"
        :label="m.reader.display.contrast"
        :min="COMIC_DISPLAY_RANGES.contrast.min"
        :max="COMIC_DISPLAY_RANGES.contrast.max"
        :step="COMIC_DISPLAY_RANGES.contrast.step"
        :display="m.reader.values.percent({ value: contrast })"
      />

      <Separator />

      <div class="flex items-center justify-between gap-2">
        <span class="text-xs text-muted-foreground">{{ m.reader.display.autoCrop }}</span>
        <Switch v-model="autoCrop" />
      </div>

      <Button
        variant="outline"
        size="sm"
        class="w-full"
        @click="settings.resetComicDisplay()"
      >
        {{ m.reader.display.reset }}
      </Button>
    </PopoverContent>
  </Popover>
</template>
