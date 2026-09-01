/** Automation: page, toolbar, rows, form dialog, details dialog, and run history. */
export const automation = {
  title: 'Automation',
  addAutomation: 'Add automation',

  display: {
    onStartup: 'On startup',
    manualOnly: 'Manual only',
    triggerSeparator: ', ',
    systemTimezone: 'System time zone',
    noRetry: 'No retry',
    retryTimes: ({ count }: { count: number }) =>
      count === 1 ? 'Retry once' : `Retry ${count} times`,
    pauseAfterFailure: 'Pause after failure',
    pauseAfterFailureWithRetry: ({ count }: { count: number }) =>
      count === 1
        ? 'Pause after failure, retry once first'
        : `Pause after failure, retry ${count} times first`,
    never: 'Never',
    statusCompleted: 'Completed',
    statusFailed: 'Failed',
    triggerManual: 'Manual',
    triggerStartup: 'Startup'
  },

  feedback: {
    notTriggered: 'The automation was not triggered',
    runCompleted: 'Automation run completed',
    runFailed: 'Automation run failed',
    runError: 'Could not run the automation',
    stopRequested: 'Requested to stop the automation retries',
    notRunning: 'The automation is not running',
    stopFailed: 'Could not stop the automation',
    enabled: 'Automation enabled',
    disabled: 'Automation disabled',
    updateFailed: 'Could not update the automation',
    deleted: 'Automation deleted',
    deleteFailed: 'Could not delete the automation',
    updated: 'Automation updated',
    added: 'Automation added',
    saveFailed: 'Could not save the automation',
    selectCommand: 'Select a command'
  },

  page: {
    emptyDescription: 'No automations yet',
    noMatchDescription: 'No matching automations',
    table: {
      name: 'Name',
      command: 'Command',
      trigger: 'Trigger',
      run: 'Runs',
      status: 'Status',
      actions: 'Actions'
    },
    deleteTitle: 'Delete automation?',
    deleteDescription: ({ name }: { name: string }) => `Delete "${name}"? This cannot be undone.`,
    deleting: 'Deleting…'
  },

  row: {
    app: 'App',
    nextRun: ({ label }: { label: string }) => `Next: ${label}`,
    nextNone: 'None',
    disabled: 'Disabled',
    running: 'Running',
    notInvoked: 'Not run yet',
    stopRetry: 'Stop retrying',
    run: 'Run',
    details: 'Details'
  },

  toolbar: {
    filterAll: 'All',
    filterEnabled: 'Enabled',
    filterDisabled: 'Disabled',
    filterRunning: 'Running',
    filterFailed: 'Failed',
    sortCreatedAt: 'Created',
    sortName: 'Name',
    sortLastRunAt: 'Last run',
    sortNextRunAt: 'Next run',
    sourceAll: 'All sources',
    sourceApp: 'App',
    sourceExtension: 'Extension',
    searchPlaceholder: 'Search automations…'
  },

  form: {
    addTitle: 'Add automation',
    editTitle: 'Edit automation',
    commandUnavailable: 'The command is currently unavailable',
    name: 'Name',
    namePlaceholder: 'Automation name',
    command: 'Command',
    trigger: 'Trigger',
    configure: 'Configure',
    failurePolicy: 'Failure policy',
    policyNone: 'No retry',
    policyRetry: 'Retry',
    policyPause: 'Pause after failure',
    retryCount: 'Retry count',
    retryDelay: 'Retry delay',
    seconds: 'seconds',
    params: 'Parameters',
    configureTrigger: 'Configure trigger',
    runOnStartup: 'Run on startup',
    expression: 'Expression',
    cronPlaceholder: 'Cron expression; leave empty to disable',
    timezone: 'Time zone',
    timezonePlaceholder: 'System time zone',
    paramsMustBeObject: 'Parameters must be a JSON object',
    cronRequired: 'The cron expression cannot be empty',
    retryCountLabel: 'Retry count',
    retryDelaySecondsLabel: 'Retry delay seconds',
    mustBePositive: ({ label }: { label: string }) => `${label} must be greater than 0`,
    mustBeNonNegativeInteger: ({ label }: { label: string }) =>
      `${label} must be an integer of 0 or more`,
    invalidTimezone: 'The time zone is invalid'
  },

  details: {
    app: 'App',
    running: 'Running',
    command: 'Command',
    source: 'Source',
    trigger: 'Trigger',
    runTime: 'Run time',
    lastRun: ({ time }: { time: string }) => `Last: ${time}`,
    nextRun: ({ time }: { time: string }) => `Next: ${time}`,
    nextNone: 'None',
    nextDisabled: 'Disabled',
    createdAt: 'Created',
    updatedAt: 'Updated',
    params: 'Parameters',
    history: 'Run history',
    historyCount: ({ count }: { count: number }) => (count === 1 ? '1 record' : `${count} records`),
    noHistory: 'No run history',
    historyRun: 'Run',
    historyTrigger: 'Trigger',
    historyStartedAt: 'Started',
    historyDuration: 'Duration',
    historyResult: 'Result',
    viewFullResult: 'View full result',
    runResult: 'Run result',
    runResultTitle: ({ title }: { title: string }) => `Run result ${title}`,
    attempt: 'Attempt',
    startedAt: 'Started',
    finishedAt: 'Finished',
    duration: 'Duration',
    error: 'Error',
    result: 'Result',
    noError: 'No error'
  },

  combobox: {
    searchPlaceholder: 'Search commands…',
    selectPlaceholder: 'Select a command…',
    unavailable: 'The command is currently unavailable'
  }
}
