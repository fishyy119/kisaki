/**
 * Reader Settings Store
 *
 * Device-level reading preferences: how text is set and how image pages are
 * shown. These follow the reader across entries and windows, so they persist
 * here rather than in the library — a resume position is what the user read,
 * this is only how they like to read it.
 *
 * Every preference is its own ref so a catalog that grows a setting still
 * rehydrates the ones already stored, and the new one keeps its default.
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  DEFAULT_READER_TYPOGRAPHY,
  type ReaderPageTint,
  type ReaderTypography,
  type ReaderWritingMode
} from '@renderer/core/reader/text/typography'
import { DEFAULT_PAGE_DISPLAY, type PageDisplay } from '@renderer/core/reader/image/display'
import type { PageFitMode, PageLayoutMode } from '@renderer/core/reader/image/layout'

export const useReaderSettingsStore = defineStore(
  'reader-settings',
  () => {
    const fontFamily = ref(DEFAULT_READER_TYPOGRAPHY.fontFamily)
    const fontSizePercent = ref(DEFAULT_READER_TYPOGRAPHY.fontSizePercent)
    const lineHeight = ref(DEFAULT_READER_TYPOGRAPHY.lineHeight)
    const paragraphSpacing = ref(DEFAULT_READER_TYPOGRAPHY.paragraphSpacing)
    const textWidth = ref(DEFAULT_READER_TYPOGRAPHY.textWidth)
    const justify = ref(DEFAULT_READER_TYPOGRAPHY.justify)
    const columns = ref(DEFAULT_READER_TYPOGRAPHY.columns)
    const tint = ref<ReaderPageTint>(DEFAULT_READER_TYPOGRAPHY.tint)
    const writingMode = ref<ReaderWritingMode>(DEFAULT_READER_TYPOGRAPHY.writingMode)

    const brightness = ref(DEFAULT_PAGE_DISPLAY.brightness)
    const contrast = ref(DEFAULT_PAGE_DISPLAY.contrast)
    const autoCrop = ref(DEFAULT_PAGE_DISPLAY.autoCrop)
    const pageLayout = ref<PageLayoutMode>('single')
    const pageFit = ref<PageFitMode>('page')

    const typography = computed<ReaderTypography>(() => ({
      fontFamily: fontFamily.value,
      fontSizePercent: fontSizePercent.value,
      lineHeight: lineHeight.value,
      paragraphSpacing: paragraphSpacing.value,
      textWidth: textWidth.value,
      justify: justify.value,
      columns: columns.value,
      tint: tint.value,
      writingMode: writingMode.value
    }))

    const pageDisplay = computed<PageDisplay>(() => ({
      brightness: brightness.value,
      contrast: contrast.value,
      autoCrop: autoCrop.value
    }))

    function resetTypography(): void {
      fontFamily.value = DEFAULT_READER_TYPOGRAPHY.fontFamily
      fontSizePercent.value = DEFAULT_READER_TYPOGRAPHY.fontSizePercent
      lineHeight.value = DEFAULT_READER_TYPOGRAPHY.lineHeight
      paragraphSpacing.value = DEFAULT_READER_TYPOGRAPHY.paragraphSpacing
      textWidth.value = DEFAULT_READER_TYPOGRAPHY.textWidth
      justify.value = DEFAULT_READER_TYPOGRAPHY.justify
      columns.value = DEFAULT_READER_TYPOGRAPHY.columns
      tint.value = DEFAULT_READER_TYPOGRAPHY.tint
      writingMode.value = DEFAULT_READER_TYPOGRAPHY.writingMode
    }

    /** Everything the page settings popover owns; page flow is the entry's. */
    function resetPageSettings(): void {
      brightness.value = DEFAULT_PAGE_DISPLAY.brightness
      contrast.value = DEFAULT_PAGE_DISPLAY.contrast
      autoCrop.value = DEFAULT_PAGE_DISPLAY.autoCrop
      pageLayout.value = 'single'
      pageFit.value = 'page'
    }

    return {
      fontFamily,
      fontSizePercent,
      lineHeight,
      paragraphSpacing,
      textWidth,
      justify,
      columns,
      tint,
      writingMode,
      brightness,
      contrast,
      autoCrop,
      pageLayout,
      pageFit,
      typography,
      pageDisplay,
      resetTypography,
      resetPageSettings
    }
  },
  {
    persist: {
      pick: [
        'fontFamily',
        'fontSizePercent',
        'lineHeight',
        'paragraphSpacing',
        'textWidth',
        'justify',
        'columns',
        'tint',
        'writingMode',
        'brightness',
        'contrast',
        'autoCrop',
        'pageLayout',
        'pageFit'
      ]
    }
  }
)
