/**
 * Reader Settings Store
 *
 * Device-level reading preferences: how text is set and how comic pages are
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
  type ReaderTypography
} from '@renderer/core/reader/typography'
import { DEFAULT_COMIC_DISPLAY, type ComicDisplay } from '@renderer/core/reader/display'

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

    const brightness = ref(DEFAULT_COMIC_DISPLAY.brightness)
    const contrast = ref(DEFAULT_COMIC_DISPLAY.contrast)
    const autoCrop = ref(DEFAULT_COMIC_DISPLAY.autoCrop)

    const typography = computed<ReaderTypography>(() => ({
      fontFamily: fontFamily.value,
      fontSizePercent: fontSizePercent.value,
      lineHeight: lineHeight.value,
      paragraphSpacing: paragraphSpacing.value,
      textWidth: textWidth.value,
      justify: justify.value,
      columns: columns.value,
      tint: tint.value
    }))

    const comicDisplay = computed<ComicDisplay>(() => ({
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
    }

    function resetComicDisplay(): void {
      brightness.value = DEFAULT_COMIC_DISPLAY.brightness
      contrast.value = DEFAULT_COMIC_DISPLAY.contrast
      autoCrop.value = DEFAULT_COMIC_DISPLAY.autoCrop
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
      brightness,
      contrast,
      autoCrop,
      typography,
      comicDisplay,
      resetTypography,
      resetComicDisplay
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
        'brightness',
        'contrast',
        'autoCrop'
      ]
    }
  }
)
