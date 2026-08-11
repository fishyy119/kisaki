/** Task center: run list, controls, details, and task-run display vocabulary. */
export const task = {
  center: 'Task center',
  tabActive: 'Active',
  tabCompleted: 'Completed',
  noActiveTasks: 'No active tasks.',
  noCompletedRecords: 'No completed records.',

  table: {
    task: 'Task',
    progress: 'Progress',
    result: 'Result',
    status: 'Status',
    actions: 'Actions'
  },

  toolbar: {
    searchActivePlaceholder: 'Search active tasks…',
    searchCompletedPlaceholder: 'Search completed records…',
    refreshing: 'Refreshing…',
    allCategories: 'All categories',
    allStatuses: 'All statuses',
    refresh: 'Refresh',
    refreshList: 'Refresh task list',
    clearCompleted: 'Clear completed records'
  },

  feedback: {
    refreshFailed: 'Could not refresh the task center',
    clearFailed: 'Could not clear the task records',
    deleteFailed: 'Could not delete the task record',
    pauseFailed: 'Could not pause the task',
    resumeFailed: 'Could not resume the task',
    cancelFailed: 'Could not cancel the task',
    cannotPauseNow: 'The task cannot be paused right now.',
    cannotResumeNow: 'The task cannot be resumed right now.',
    cannotCancel: 'The task has finished or cannot be cancelled.'
  },

  row: {
    pause: 'Pause',
    pauseTask: 'Pause task',
    resume: 'Resume',
    resumeTask: 'Resume task',
    cancel: 'Cancel',
    cancelTask: 'Cancel task',
    details: 'Details',
    viewDetails: 'View details',
    deleteRecord: 'Delete record',
    duration: 'Duration',
    counters: 'Counters',
    warningCount: ({ count }: { count: number }) =>
      count === 1 ? '1 warning' : `${count} warnings`,
    moreWarnings: ({ count }: { count: number }) =>
      count === 1 ? '1 more warning' : `${count} more warnings`
  },

  progress: {
    progress: 'Progress',
    rate: 'Rate',
    eta: 'Remaining',
    inProgress: 'In progress',
    etaAbout: ({ duration }: { duration: string }) => `about ${duration}`
  },

  details: {
    runId: 'Task ID',
    category: 'Category',
    operation: 'Operation',
    operationId: 'Operation ID',
    owner: 'Source',
    initiator: 'Initiated by',
    subject: 'Subject',
    createdAt: 'Created',
    startedAt: 'Started',
    finishedAt: 'Finished',
    duration: 'Duration',
    warnings: 'Warnings',
    info: 'Info',
    description: 'Description',
    result: 'Result',
    output: 'Output',
    noResultSummary: 'No result summary.'
  },

  categories: {
    scanner: 'Scan',
    ingest: 'Import',
    extension: 'Extension',
    updater: 'Update',
    system: 'System'
  },

  statuses: {
    queued: 'Queued',
    running: 'Running',
    pausing: 'Pausing',
    paused: 'Paused',
    cancelling: 'Cancelling',
    completed: 'Completed',
    failed: 'Failed',
    cancelled: 'Cancelled'
  },

  counters: {
    total: 'Total',
    processed: 'Processed',
    succeeded: 'Succeeded',
    failed: 'Failed',
    skipped: 'Skipped',
    warnings: 'Warnings',
    added: 'Added',
    existing: 'Existing',
    updated: 'Updated',
    deleted: 'Deleted',
    changed: 'Changed',
    notModified: 'Unchanged'
  },

  subjects: {
    command: 'Command',
    automation: 'Automation',
    scanner: 'Scanner',
    game: 'Game',
    anime: 'Anime',
    person: 'Person',
    company: 'Company',
    character: 'Character',
    extension: 'Extension',
    repository: 'Repository',
    app: 'App'
  },
  subjectValue: ({ label, value }: { label: string; value: string }) => `${label}: ${value}`,

  operations: {
    scan: 'Scan media',
    installExtension: 'Install extension',
    updateExtension: 'Update extension',
    importExtensionPackage: 'Import extension package',
    uninstallExtension: 'Uninstall extension',
    refreshRepository: 'Refresh extension repository',
    refreshAllRepositories: 'Refresh all extension repositories',
    checkUpdates: 'Check for app updates',
    downloadUpdate: 'Download app update',
    systemMaintenance: 'System maintenance',
    extensionTask: 'Extension task',
    ingestAdd: ({ label }: { label: string }) => `Add ${label.toLowerCase()}`,
    ingestUpdate: ({ label }: { label: string }) => `Update ${label.toLowerCase()}`,
    ingestBatchAdd: ({ label }: { label: string }) => `Batch add ${label.toLowerCase()}s`,
    ingestBatchUpdate: ({ label }: { label: string }) => `Batch update ${label.toLowerCase()}s`,
    ingestBatchDelete: ({ label }: { label: string }) => `Batch delete ${label.toLowerCase()}s`,
    ingestFallbackEntity: 'Item'
  },

  owner: {
    app: 'App',
    extension: ({ name }: { name: string }) => `Extension: ${name}`
  },

  initiator: {
    user: 'User',
    automation: ({ name }: { name: string }) => `Automation: ${name}`,
    extension: ({ name }: { name: string }) => `Extension: ${name}`,
    system: 'System',
    systemWithReason: ({ reason }: { reason: string }) => `System: ${reason}`
  },

  systemReasons: {
    startup: 'Startup',
    maintenance: 'Maintenance',
    update: 'Update',
    shutdown: 'Shutdown'
  },

  progressUnits: {
    item: 'items',
    file: 'files',
    byte: 'bytes',
    entity: 'items',
    step: 'steps',
    package: 'packages',
    request: 'requests'
  },

  ratePeriods: {
    second: 's',
    minute: 'min',
    hour: 'hr'
  },

  notifications: {
    cancelling: 'Cancelling…',
    pausing: 'Pausing…',
    paused: 'Paused',
    cancelUnavailable: 'The task has finished or cannot be cancelled.',
    finalCompleted: ({ title }: { title: string }) => `${title} completed`,
    finalCancelled: ({ title }: { title: string }) => `${title} cancelled`,
    finalFailed: ({ title }: { title: string }) => `${title} failed`
  }
}
