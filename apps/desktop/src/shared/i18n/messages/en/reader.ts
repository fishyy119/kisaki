/** Reader window: the image pager and the reflowable text engine share one shell. */
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
    writingMode: 'Text direction',
    writingModeBook: 'Book',
    writingModeVertical: 'Vertical',
    writingModeHorizontal: 'Horizontal',
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
    noFile: 'This unit has no readable file',
    openFailed: 'Could not open this unit',
    nextUnitHint: 'Reached the end — continue with the next unit'
  },

  image: {
    settingsOpen: 'Page settings',
    pageFlow: 'Page flow',
    pageFlowRtl: 'Right to left',
    pageFlowLtr: 'Left to right',
    pageFlowVertical: 'Vertical scroll',
    pageLayout: 'Page layout',
    layoutSingle: 'Single',
    layoutDouble: 'Double',
    coverAlone: 'Cover on its own',
    fit: 'Fit',
    fitPage: 'Fit page',
    fitWidth: 'Fit width',
    fitHeight: 'Fit height',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    brightness: 'Brightness',
    contrast: 'Contrast',
    autoCrop: 'Trim page margins',
    reset: 'Reset page settings',
    pageLoadFailed: 'Could not load this page',
    emptyPages: 'This file has no readable pages'
  },

  shortcuts: {
    open: 'Keyboard shortcuts',
    title: 'Keyboard shortcuts',
    turnPage: 'Turn page',
    switchUnit: 'Previous or next unit',
    jumpEdges: 'First or last page',
    jumpToPage: 'Go to page',
    zoom: 'Zoom in, out, or reset',
    ctrlWheel: 'Ctrl+Wheel',
    search: 'Search in book',
    bookmark: 'Bookmark this place',
    navigation: 'Toggle navigation',
    fullScreen: 'Toggle full screen',
    closeReader: 'Close the reader'
  }
}
