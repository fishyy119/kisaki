/** Adder: quick-add trigger menu and entity adder dialogs. */
export const adder = {
  trigger: 'Add',
  addScanner: 'Add scanner',

  addFailed: ({ label }: { label: string }) => `Could not add the ${label.toLowerCase()}`,
  addCancelled: ({ label }: { label: string }) => `Adding the ${label.toLowerCase()} was cancelled`,
  missingEntityId: ({ label }: { label: string }) =>
    `The task result is missing the ${label.toLowerCase()} ID`,

  autofillHint: 'Click a search result to fill in the ID',
  adding: 'Adding…',
  submit: 'Identify and add',

  existingReasonExternalId: 'External ID',
  existingReasonPath: 'Path',
  existingReasonUnknown: 'Unknown reason',
  postProcessWarnings: ({ count }: { count: number }) =>
    `${count} asset post-processing steps failed. Check the logs.`
}
