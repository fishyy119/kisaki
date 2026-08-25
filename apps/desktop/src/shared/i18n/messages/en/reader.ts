/** Reader window: the comic pager and the novel text engine share one shell. */
export const reader = {
  loading: 'Opening…',
  loadFailed: 'Could not open the reader',
  close: 'Close',

  units: {
    comicLabel: 'Unit',
    novelLabel: 'Volume',
    previous: 'Previous unit',
    next: 'Next unit',
    endOfUnit: 'End of this unit',
    lastUnit: 'This is the last unit',
    readBadge: 'Read',
    noFile: 'This unit has no readable file',
    unsupportedFile: 'This file format cannot be displayed by the built-in reader'
  },

  comic: {
    pageFlow: 'Page flow',
    pageFlowRtl: 'Right to left',
    pageFlowLtr: 'Left to right',
    pageFlowVertical: 'Vertical scroll',
    fitWidth: 'Fit width',
    fitHeight: 'Fit height',
    pageLoadFailed: 'Could not load this page',
    emptyPages: 'This file has no readable pages',
    nextChapterHint: 'Reached the end — continue with the next unit'
  },

  novel: {
    progress: ({ percent }: { percent: number }) => `${percent}%`,
    toc: 'Table of contents',
    emptyToc: 'No table of contents',
    fontSize: 'Font size',
    fontSizeDecrease: 'Smaller text',
    fontSizeIncrease: 'Larger text',
    openFailed: 'Could not open this volume',
    location: 'Location'
  },

  shortcuts: {
    title: 'Keyboard shortcuts',
    turnPage: 'Turn page',
    switchUnit: 'Switch unit',
    toggleToolbar: 'Toggle toolbar'
  }
}
