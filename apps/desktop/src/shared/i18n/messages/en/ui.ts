/** Generic UI component copy: state views, pickers, dialogs, and charts. */
export const ui = {
  stateView: {
    errorTitle: 'Load failed'
  },
  combobox: {
    noMatches: 'No matches',
    create: ({ name }: { name: string }) => `Create "${name}"`
  },
  imagePicker: {
    picked: 'Selected:',
    pick: 'Select image',
    clear: 'Clear'
  },
  imageCropper: {
    title: 'Crop image',
    recommendedRatio: ({ ratio }: { ratio: string }) => `Recommended ratio: ${ratio}`,
    fixedRatio: ({ ratio }: { ratio: string }) => `Fixed ratio: ${ratio}`,
    lockRatio: 'Lock ratio',
    freeCrop: 'Free crop',
    cropArea: ({ width, height }: { width: number; height: number }) =>
      `Crop area: ${width} × ${height} px`,
    confirm: 'Crop'
  },
  markdown: {
    editorTitle: 'Edit Markdown',
    previewTitle: 'Preview',
    toolbar: {
      bold: 'Bold',
      italic: 'Italic',
      strikethrough: 'Strikethrough',
      inlineCode: 'Inline code',
      codeBlock: 'Code block',
      link: 'Link',
      imageSyntax: 'Image syntax',
      heading1: 'Heading 1',
      heading2: 'Heading 2',
      quote: 'Quote',
      bulletedList: 'Bulleted list',
      numberedList: 'Numbered list',
      taskList: 'Task list',
      table: 'Table',
      footnote: 'Footnote',
      attachImage: 'Attach image',
      preview: 'Preview',
      fullscreen: 'Fullscreen',
      exitFullscreen: 'Exit fullscreen'
    }
  },
  partialDate: {
    yearPlaceholder: 'YYYY',
    monthPlaceholder: 'MM',
    dayPlaceholder: 'DD',
    invalidInteger: 'Date fields accept whole numbers only',
    yearDayWithoutMonth: 'Month is required when both year and day are set'
  },
  rankingList: {
    expandTitle: 'Ranking',
    viewAll: ({ count }: { count: number }) => `View all ${count} items`
  },
  charts: {
    day: 'Day',
    week: 'Week',
    month: 'Month',
    hourly: 'Hour',
    weekday: 'Weekday',
    dayOfMonth: 'Day of month',
    duration: 'Play time',
    noActivity: 'No activity',
    legendLess: 'Less',
    legendMore: 'More',
    peak: ({ label, value }: { label: string; value: string }) => `Peak: ${label}, ${value}`,
    peakNone: 'Peak: no activity',
    mostActive: ({ label, value }: { label: string; value: string }) =>
      `Most active: ${label}, ${value}`,
    mostActiveNone: 'Most active: no activity'
  },
  deleteConfirm: {
    deleteTitle: ({ label }: { label: string }) => `Delete ${label}?`,
    removeTitle: ({ label }: { label: string }) => `Remove ${label}?`,
    removeNamedDescription: ({ name }: { name: string }) => `Remove "${name}"?`,
    removeDescription: ({ label }: { label: string }) => `Remove this ${label}?`,
    deleteNamedDescription: ({ name, label }: { name: string; label: string }) =>
      `Delete "${name}"? This cannot be undone; the ${label} data will be permanently deleted.`,
    deleteDescription: ({ label }: { label: string }) =>
      `This cannot be undone; the ${label} data will be permanently deleted`,
    removing: 'Removing…',
    deleting: 'Deleting…'
  },
  spoiler: {
    title: 'Show spoilers?',
    description: 'Content marked as spoilers will be shown immediately'
  }
}
