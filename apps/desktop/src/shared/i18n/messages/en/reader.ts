/** Reader window: the comic pager and the novel text engine share one shell. */
export const reader = {
  loading: 'Opening…',
  loadFailed: 'Could not open the reader',
  close: 'Close',

  chrome: {
    navigation: 'Navigation',
    enterFullScreen: 'Full screen'
  },

  panel: {
    outline: 'Contents',
    pages: 'Pages',
    marks: 'Marks',
    search: 'Search',
    outlineHeading: 'In this unit',
    noPages: 'This unit has no pages to preview'
  },

  display: {
    open: 'Page display',
    brightness: 'Brightness',
    contrast: 'Contrast',
    autoCrop: 'Trim page margins',
    reset: 'Reset display'
  },

  search: {
    open: 'Search in book',
    placeholder: 'Search in book',
    noResults: 'No matches',
    unnamedSection: 'Untitled section',
    tooMany: ({ count }: { count: number }) =>
      `Showing the first ${count} matches — narrow the search to see fewer`
  },

  footnote: {
    title: 'Note'
  },

  marks: {
    addBookmark: 'Bookmark',
    highlight: 'Highlight',
    copy: 'Copy',
    dismiss: 'Dismiss',
    edit: 'Edit mark',
    color: 'Highlight color',
    notePlaceholder: 'Note',
    saveNote: 'Save',
    remove: 'Remove',
    empty: 'No marks yet',
    bookmarksHeading: 'Bookmarks',
    highlightsHeading: 'Highlights',
    page: ({ page }: { page: number }) => `Page ${page}`,
    bookmarkAdded: 'Bookmark added',
    bookmarkRemoved: 'Bookmark removed',
    failed: 'Could not save that mark'
  },

  /** Bare setting readouts, shared by every reader surface that shows one. */
  values: {
    percent: ({ value }: { value: number }) => `${value}%`,
    pixels: ({ value }: { value: number }) => `${value} px`,
    ratio: ({ value }: { value: number }) => value.toFixed(1),
    em: ({ value }: { value: number }) => `${value} em`
  },

  progress: {
    pageOf: ({ page, total }: { page: number; total: number | null }) =>
      total === null ? `${page} / ?` : `${page} / ${total}`,
    jumpToPage: 'Go to page',
    jump: 'Go',
    elapsed: ({ minutes }: { minutes: number }) => `${minutes} min`
  },

  typography: {
    open: 'Typography',
    font: 'Font',
    fontBook: 'Book',
    fontSerif: 'Serif',
    fontSans: 'Sans',
    fontCustom: 'Custom',
    customFont: 'Font family name',
    fontPick: 'Pick a font',
    fontSearch: 'Search fonts',
    fontSize: 'Text size',
    lineHeight: 'Line height',
    paragraphSpacing: 'Paragraph spacing',
    textWidth: 'Column width',
    twoColumns: 'Two columns',
    justify: 'Justify text',
    tint: 'Page tint',
    tintTheme: 'Theme',
    tintPaper: 'Paper',
    tintSepia: 'Sepia',
    reset: 'Reset typography'
  },

  units: {
    comicLabel: 'Unit',
    novelLabel: 'Volume',
    previous: 'Previous unit',
    next: 'Next unit',
    endOfUnit: 'End of this unit',
    lastUnit: 'This is the last unit',
    readBadge: 'Read',
    noFile: 'This unit has no readable file'
  },

  comic: {
    pageFlow: 'Page flow',
    pageFlowRtl: 'Right to left',
    pageFlowLtr: 'Left to right',
    pageFlowVertical: 'Vertical scroll',
    spread: 'Two-page spread',
    coverAlone: 'Cover on its own',
    fitWidth: 'Fit width',
    fitHeight: 'Fit height',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    pageLoadFailed: 'Could not load this page',
    emptyPages: 'This file has no readable pages',
    openFailed: 'Could not open this unit',
    nextUnitHint: 'Reached the end — continue with the next unit'
  },

  novel: {
    openFailed: 'Could not open this volume'
  },

  shortcuts: {
    open: 'Keyboard shortcuts',
    title: 'Keyboard shortcuts',
    turnPage: 'Turn page',
    switchUnit: 'Previous or next unit',
    jumpEdges: 'First or last page',
    jumpToPage: 'Go to page',
    zoom: 'Zoom in, out, or reset',
    search: 'Search in book',
    bookmark: 'Bookmark this place',
    navigation: 'Toggle navigation',
    fullScreen: 'Toggle full screen',
    closeReader: 'Close the reader'
  }
}
