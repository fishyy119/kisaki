<!--
Typography controls for reflowable volumes.
Boundary: it only edits the reader settings store; applying them to the book is
the novel shell's job, so every surface stays in step with one source.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import { Input } from '@renderer/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { SegmentedControl, SegmentedControlItem } from '@renderer/components/ui/segmented-control'
import { Separator } from '@renderer/components/ui/separator'
import { Switch } from '@renderer/components/ui/switch'
import { VirtualizedCombobox } from '@renderer/components/ui/virtualized-combobox'
import { useI18n } from '@renderer/composables/use-i18n'
import { formatFontFamilyValue, listInstalledFontFamilies } from '@renderer/core/reader/text/fonts'
import {
  READER_FONT_FAMILIES,
  READER_TYPOGRAPHY_RANGES,
  READER_WRITING_MODES,
  type ReaderFontPreset,
  type ReaderPageTint,
  type ReaderWritingMode
} from '@renderer/core/reader/text/typography'
import { useReaderSettingsStore } from '@renderer/stores/reader-settings'
import SettingSlider from '../chrome/setting-slider.vue'

const { m } = useI18n()

const settings = useReaderSettingsStore()
const {
  fontFamily,
  fontSizePercent,
  lineHeight,
  paragraphSpacing,
  textWidth,
  justify,
  columns,
  tint,
  writingMode
} = storeToRefs(settings)

/** The reading font is one of the presets, or a family named by the reader. */
type FontChoice = ReaderFontPreset | 'custom'

const FONT_CHOICES: FontChoice[] = ['book', 'serif', 'sans', 'custom']
const TINTS: ReaderPageTint[] = ['theme', 'paper', 'sepia']

const fontChoiceLabels = computed<Record<FontChoice, string>>(() => ({
  book: m.value.reader.typography.fontBook,
  serif: m.value.reader.typography.fontSerif,
  sans: m.value.reader.typography.fontSans,
  custom: m.value.reader.typography.fontCustom
}))

const tintLabels = computed<Record<ReaderPageTint, string>>(() => ({
  theme: m.value.reader.typography.tintTheme,
  paper: m.value.reader.typography.tintPaper,
  sepia: m.value.reader.typography.tintSepia
}))

const writingModeLabels = computed<Record<ReaderWritingMode, string>>(() => ({
  book: m.value.reader.typography.writingModeBook,
  vertical: m.value.reader.typography.writingModeVertical,
  horizontal: m.value.reader.typography.writingModeHorizontal
}))

const open = ref(false)
const installedFonts = ref<string[]>([])
/**
 * Set while the reader is choosing their own family. Only the resulting family
 * is stored, so this carries the step in between — custom picked, nothing chosen
 * yet — which no stored value can express.
 */
const customMode = ref(false)

// Enumerating installed fonts needs a user gesture, which opening this panel is.
watch(open, (isOpen) => {
  if (isOpen) void loadInstalledFonts()
})

const activeFontChoice = computed<FontChoice>(() => {
  if (customMode.value) return 'custom'
  const preset = FONT_CHOICES.find(
    (choice) => choice !== 'custom' && READER_FONT_FAMILIES[choice] === fontFamily.value
  )
  return preset ?? 'custom'
})

const fontEntities = computed(() =>
  installedFonts.value.map((family) => ({ id: family, name: family }))
)

/** The chosen family, matched back from the stored CSS value. */
const selectedFontIds = computed<string[]>(() => {
  const match = installedFonts.value.find(
    (family) => formatFontFamilyValue(family) === fontFamily.value
  )
  return match ? [match] : []
})

/** Family typed by hand; empty while a preset is active. */
const customFamily = computed<string>({
  get: () => (activeFontChoice.value === 'custom' ? fontFamily.value : ''),
  set: (value) => {
    fontFamily.value = value
  }
})

async function loadInstalledFonts(): Promise<void> {
  installedFonts.value = await listInstalledFontFamilies()
}

function selectFontChoice(choice: FontChoice): void {
  if (choice === 'custom') {
    customMode.value = true
    // A refused enumeration is not remembered, and this click is a fresh gesture.
    void loadInstalledFonts()
    return
  }

  customMode.value = false
  fontFamily.value = READER_FONT_FAMILIES[choice]
}

function selectFont(ids: string[]): void {
  const family = ids[0]
  fontFamily.value = family ? formatFontFamilyValue(family) : ''
}

function handleFontChoice(value: string | undefined): void {
  if (value === 'book' || value === 'serif' || value === 'sans' || value === 'custom') {
    selectFontChoice(value)
  }
}

function handleWritingModeChange(value: string | undefined): void {
  if (value === 'book' || value === 'vertical' || value === 'horizontal') {
    writingMode.value = value
  }
}

function handleTintChange(value: string | undefined): void {
  if (value === 'theme' || value === 'paper' || value === 'sepia') tint.value = value
}

const twoColumns = computed<boolean>({
  get: () => columns.value > 1,
  set: (value) => {
    columns.value = value ? 2 : 1
  }
})
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        variant="ghost"
        size="icon-sm"
        :tooltip="m.reader.typography.open"
      >
        <Icon
          icon="icon-[mdi--format-font]"
          class="size-4"
        />
      </Button>
    </PopoverTrigger>
    <PopoverContent
      align="end"
      class="w-80 space-y-3"
    >
      <div class="space-y-1.5">
        <span class="text-xs text-muted-foreground">{{ m.reader.typography.font }}</span>
        <SegmentedControl
          :model-value="activeFontChoice"
          class="w-full"
          @update:model-value="handleFontChoice"
        >
          <SegmentedControlItem
            v-for="choice in FONT_CHOICES"
            :key="choice"
            :value="choice"
            class="min-w-0 flex-1"
          >
            <span class="truncate">{{ fontChoiceLabels[choice] }}</span>
          </SegmentedControlItem>
        </SegmentedControl>

        <template v-if="activeFontChoice === 'custom'">
          <VirtualizedCombobox
            v-if="fontEntities.length > 0"
            :entities="fontEntities"
            :selected-ids="selectedFontIds"
            :placeholder="m.reader.typography.fontSearch"
            :empty-text="m.reader.typography.fontPick"
            @update:selected-ids="selectFont"
          />
          <Input
            v-else
            v-model="customFamily"
            :placeholder="m.reader.typography.customFont"
          />
        </template>
      </div>

      <Separator />

      <SettingSlider
        v-model="fontSizePercent"
        :label="m.reader.typography.fontSize"
        :min="READER_TYPOGRAPHY_RANGES.fontSizePercent.min"
        :max="READER_TYPOGRAPHY_RANGES.fontSizePercent.max"
        :step="READER_TYPOGRAPHY_RANGES.fontSizePercent.step"
        :display="m.reader.values.percent({ value: fontSizePercent })"
      />
      <SettingSlider
        v-model="lineHeight"
        :label="m.reader.typography.lineHeight"
        :min="READER_TYPOGRAPHY_RANGES.lineHeight.min"
        :max="READER_TYPOGRAPHY_RANGES.lineHeight.max"
        :step="READER_TYPOGRAPHY_RANGES.lineHeight.step"
        :display="m.reader.values.ratio({ value: lineHeight })"
      />
      <SettingSlider
        v-model="paragraphSpacing"
        :label="m.reader.typography.paragraphSpacing"
        :min="READER_TYPOGRAPHY_RANGES.paragraphSpacing.min"
        :max="READER_TYPOGRAPHY_RANGES.paragraphSpacing.max"
        :step="READER_TYPOGRAPHY_RANGES.paragraphSpacing.step"
        :display="m.reader.values.em({ value: paragraphSpacing })"
      />
      <SettingSlider
        v-model="textWidth"
        :label="m.reader.typography.textWidth"
        :min="READER_TYPOGRAPHY_RANGES.textWidth.min"
        :max="READER_TYPOGRAPHY_RANGES.textWidth.max"
        :step="READER_TYPOGRAPHY_RANGES.textWidth.step"
        :display="m.reader.values.pixels({ value: textWidth })"
      />

      <div class="flex items-center justify-between gap-2">
        <span class="text-xs text-muted-foreground">{{ m.reader.typography.twoColumns }}</span>
        <Switch v-model="twoColumns" />
      </div>
      <div class="flex items-center justify-between gap-2">
        <span class="text-xs text-muted-foreground">{{ m.reader.typography.justify }}</span>
        <Switch v-model="justify" />
      </div>

      <Separator />

      <div class="space-y-1.5">
        <span class="text-xs text-muted-foreground">{{ m.reader.typography.writingMode }}</span>
        <SegmentedControl
          :model-value="writingMode"
          class="w-full"
          @update:model-value="handleWritingModeChange"
        >
          <SegmentedControlItem
            v-for="option in READER_WRITING_MODES"
            :key="option"
            :value="option"
            class="flex-1"
          >
            {{ writingModeLabels[option] }}
          </SegmentedControlItem>
        </SegmentedControl>
      </div>

      <div class="space-y-1.5">
        <span class="text-xs text-muted-foreground">{{ m.reader.typography.tint }}</span>
        <SegmentedControl
          :model-value="tint"
          class="w-full"
          @update:model-value="handleTintChange"
        >
          <SegmentedControlItem
            v-for="option in TINTS"
            :key="option"
            :value="option"
            class="flex-1"
          >
            {{ tintLabels[option] }}
          </SegmentedControlItem>
        </SegmentedControl>
      </div>

      <Button
        variant="outline"
        size="sm"
        class="w-full"
        @click="settings.resetTypography()"
      >
        {{ m.reader.typography.reset }}
      </Button>
    </PopoverContent>
  </Popover>
</template>
