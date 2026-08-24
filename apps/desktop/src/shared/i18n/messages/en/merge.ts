/** Entity merge dialog: source/target pickers and the confirmation summary. */
export const merge = {
  title: 'Merge duplicates',
  keep: 'Keep',
  selectDuplicate: ({ label }: { label: string }) => `Select the duplicate ${label.toLowerCase()}…`,
  confirmTitle: ({ source, target }: { source: string; target: string }) =>
    `Merge "${source}" into "${target}"`,
  confirmDescription: ({ source }: { source: string }) =>
    `"${source}" will be deleted. External IDs, relations, tags, collections, activity records, and attachments move to the kept entity; existing data on the target stays unchanged.`,
  action: 'Merge',
  merged: ({ name }: { name: string }) => `Merged into "${name}"`,
  fallbackTargetName: 'the target entity',
  failed: 'Merge failed',
  staticCollection: 'Static collection',
  dynamicCollection: 'Dynamic collection'
}
