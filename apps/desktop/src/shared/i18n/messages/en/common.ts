/**
 * Shared vocabulary: generic actions, states, and value placeholders.
 * Domain-specific copy belongs in its own domain module.
 */
export const common = {
  // Actions
  add: 'Add',
  apply: 'Apply',
  back: 'Back',
  browse: 'Browse…',
  cancel: 'Cancel',
  clear: 'Clear',
  close: 'Close',
  confirm: 'Confirm',
  copy: 'Copy',
  create: 'Create',
  delete: 'Delete',
  edit: 'Edit',
  export: 'Export',
  import: 'Import',
  moveDown: 'Move down',
  moveUp: 'Move up',
  next: 'Next',
  open: 'Open',
  preview: 'Preview',
  previous: 'Previous',
  refresh: 'Refresh',
  remove: 'Remove',
  rename: 'Rename',
  reset: 'Reset',
  retry: 'Retry',
  save: 'Save',
  search: 'Search',
  select: 'Select',
  selectAll: 'Select all',
  view: 'View',

  // States
  loading: 'Loading…',
  saving: 'Saving…',
  processing: 'Processing…',
  enabled: 'Enabled',
  disabled: 'Disabled',
  on: 'On',
  off: 'Off',
  yes: 'Yes',
  no: 'No',
  all: 'All',
  none: 'None',
  unknown: 'Unknown',
  never: 'Never',
  notSet: 'Not set',
  notSpecified: 'Not specified',
  optional: 'Optional',
  required: 'Required',

  // Feedback
  saved: 'Saved.',
  deleted: 'Deleted.',
  copied: 'Copied.',
  saveFailed: 'Save failed.',
  deleteFailed: 'Delete failed.',
  copyFailed: 'Copy failed.',
  loadFailed: 'Load failed.',
  operationFailed: 'Operation failed.',

  // Placeholders and empty values
  emptyValue: '—',
  searchPlaceholder: 'Search',
  noResults: 'No results.',
  noData: 'No data.',

  // Counts
  itemCount: ({ count }: { count: number }) => (count === 1 ? '1 item' : `${count} items`),
  selectedCount: ({ count }: { count: number }) =>
    count === 1 ? '1 selected' : `${count} selected`
}
