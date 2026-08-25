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
    progress: ({ percent }: { percent: number }) => `${percent}%`,
    toc: 'Table of contents',
    emptyToc: 'No table of contents',
    fontSizeDecrease: 'Smaller text',
    fontSizeIncrease: 'Larger text',
    openFailed: 'Could not open this volume'
  },

  shortcuts: {
    open: 'Keyboard shortcuts',
    title: 'Keyboard shortcuts',
    turnPage: 'Turn page',
    switchUnit: 'Previous or next unit',
    jumpEdges: 'First or last page',
    zoom: 'Zoom in, out, or reset',
    closeReader: 'Close the reader'
  }
}
