/**
 * Native dialog option helpers (renderer)
 *
 * Pure helpers for building `native:open-dialog` options.
 */

import type { OpenDialogOptions } from 'electron'

const DEFAULT_IMAGE_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'avif',
  'bmp',
  'tif',
  'tiff',
  'ico'
]

export function getOpenImageDialogOptions(
  options: {
    title?: string
    extensions?: string[]
    filterName?: string
  } = {}
): OpenDialogOptions {
  const {
    title = 'Select image',
    extensions = DEFAULT_IMAGE_EXTENSIONS,
    filterName = 'Images'
  } = options

  return {
    title,
    filters: [{ name: filterName, extensions }],
    properties: ['openFile']
  }
}

/** Mirrors the containers the main-process file recognition accepts. */
const DEFAULT_VIDEO_EXTENSIONS = [
  'mkv',
  'mp4',
  'm4v',
  'mov',
  'avi',
  'wmv',
  'flv',
  'webm',
  'ts',
  'm2ts',
  'mpg',
  'mpeg',
  'rmvb',
  'ogm'
]

export function getOpenVideoDialogOptions(
  options: {
    title?: string
    extensions?: string[]
    filterName?: string
  } = {}
): OpenDialogOptions {
  const {
    title = 'Select video',
    extensions = DEFAULT_VIDEO_EXTENSIONS,
    filterName = 'Videos'
  } = options

  return {
    title,
    filters: [{ name: filterName, extensions }],
    properties: ['openFile']
  }
}

/** Mirrors the containers the main-process comic recognition accepts. */
const DEFAULT_COMIC_EXTENSIONS = ['cbz', 'zip', 'cbr', 'rar', 'pdf']

export function getOpenComicDialogOptions(): OpenDialogOptions {
  return {
    title: 'Select comic file',
    filters: [{ name: 'Comics', extensions: DEFAULT_COMIC_EXTENSIONS }],
    properties: ['openFile']
  }
}

/** Mirrors the containers the main-process novel recognition accepts. */
const DEFAULT_BOOK_EXTENSIONS = ['epub', 'mobi', 'azw3', 'azw', 'fb2', 'txt', 'pdf']

export function getOpenBookDialogOptions(): OpenDialogOptions {
  return {
    title: 'Select book file',
    filters: [{ name: 'Books', extensions: DEFAULT_BOOK_EXTENSIONS }],
    properties: ['openFile']
  }
}
