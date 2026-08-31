export const en = {
  errors: {
    authRequired: 'Save the MangaDex personal-client credentials first',
    authFailed: 'MangaDex rejected the credentials. Check all four values.',
    notFound: 'That MangaDex entry does not exist',
    rateLimited: 'Too many requests to MangaDex. Try again in a moment.',
    rejected: 'The MangaDex API rejected the request',
    unavailable: 'The MangaDex API is temporarily unavailable',
    networkFailed: 'The network request to MangaDex failed',
    operationCancelled: 'The operation was cancelled',
    idInvalid: ({ value }: { value: string }) => `"${value}" is not a valid MangaDex id`,
    credentialsIncomplete: 'Fill in all four credential fields',
    operationRunning: 'A MangaDex list operation is already running. Wait for it to finish.'
  },

  sync: {
    autoSyncFailedTitle: 'MangaDex sync failed',
    autoSyncFailedFallback: 'Could not push the change to MangaDex',
    pushTaskTitle: 'Push library to MangaDex',
    pushSummary: ({
      pushed,
      skipped,
      failed
    }: {
      pushed: number
      skipped: number
      failed: number
    }) => `Pushed ${pushed}, skipped ${skipped}, failed ${failed}`
  },

  import: {
    taskTitle: 'Import MangaDex reading statuses',
    phaseRead: 'Reading MangaDex statuses',
    phaseApply: 'Applying entries',
    itemFailed: ({ id }: { id: string }) => `Import failed for ${id}`,
    summary: ({
      created,
      updated,
      unchanged,
      skipped,
      failed
    }: {
      created: number
      updated: number
      unchanged: number
      skipped: number
      failed: number
    }) =>
      `Created ${created}, updated ${updated}, unchanged ${unchanged}, skipped ${skipped}, failed ${failed}`
  },

  commands: {
    verifyAccount: {
      title: 'Verify the MangaDex account',
      description: 'Checks the stored credentials against the MangaDex API'
    },
    pushAll: {
      title: 'Push the library to MangaDex',
      description: 'Pushes every entry with a MangaDex id to the account'
    },
    importStatuses: {
      title: 'Import the MangaDex reading statuses',
      description: 'Writes reading statuses and ratings onto matching local entries'
    }
  },

  automations: {
    names: {
      'auth-check': 'MangaDex: verify the account at startup',
      'push-full-daily': 'MangaDex: daily full push',
      'import-refresh-weekly': 'MangaDex: weekly status refresh'
    },
    labels: {
      'auth-check': 'Verify the account at startup',
      'push-full-daily': 'Daily full push',
      'import-refresh-weekly': 'Weekly status refresh'
    },
    descriptions: {
      'auth-check': 'Verifies the MangaDex credentials when the app starts',
      'push-full-daily':
        'Pushes every linked entry to the MangaDex account once a day in the early morning',
      'import-refresh-weekly':
        'Re-imports reading statuses and ratings onto existing entries once a week'
    },
    status: {
      missing: 'Not created',
      enabled: 'Enabled',
      disabled: 'Disabled'
    }
  },

  settings: {
    webviewTitle: 'MangaDex',
    commandLabel: 'Settings',
    commandDescription:
      'Connect a MangaDex account, import reading statuses, and configure scraping'
  },

  ui: {
    loading: 'Loading…',
    unavailable: 'MangaDex settings could not be loaded',
    saved: 'Settings saved',
    savePreferences: 'Save',
    discardChanges: 'Discard',
    unsavedChanges: 'Unsaved changes',
    actionFailed: 'The action failed',
    cancel: 'Cancel',
    confirm: 'Confirm',

    tabs: {
      overview: 'Overview',
      account: 'Account',
      sync: 'Sync',
      import: 'Import',
      automation: 'Automation',
      maintenance: 'Maintenance'
    },

    task: {
      progress: ({ current, total }: { current: number; total: number }) =>
        `${current} / ${total}`,
      running: 'Running',
      completed: 'Completed',
      failed: 'Failed',
      cancelled: 'Cancelled',
      cancel: 'Cancel'
    },

    overview: {
      statusTitle: 'Status overview',
      accountLabel: 'Account',
      connected: 'Connected',
      notConnected: 'Not connected',
      available: 'Available',
      autoSyncLabel: 'Auto push',
      enabled: 'Enabled',
      disabled: 'Disabled',
      withScore: 'Status and rating',
      withoutScore: 'Status only',
      recommendedAutomations: 'Recommended automations',
      automationsComplete: 'All created',
      automationsMissing: ({ count }: { count: number }) => `${count} not created`,
      templatesCount: ({ count }: { count: number }) =>
        `${count} ${count === 1 ? 'template' : 'templates'}`,
      runtimeTitle: 'Runtime status',
      runningJobs: 'Running MangaDex jobs',
      running: 'Running',
      idle: 'Idle',
      quickActionsTitle: 'Shortcuts',
      importAction: 'Import the MangaDex reading statuses',
      maintenanceAction: 'Adjust endpoint and client options',
      automationsTitle: 'Automation templates'
    },

    account: {
      title: 'Account',
      description:
        'MangaDex personal tools sign in with a personal API client. Create one under MangaDex settings, then enter its id and secret together with the account name and password; everything stays in the local secret store.',
      statusLabel: 'Status',
      configuredLabel: 'Connected',
      missingLabel: 'Not connected',
      clientIdLabel: 'Client id',
      clientSecretLabel: 'Client secret',
      usernameLabel: 'Username',
      passwordLabel: 'Password',
      save: 'Connect account',
      clear: 'Disconnect',
      verify: 'Verify account',
      verifiedAs: ({ userName }: { userName: string }) => `Connected as ${userName}`,
      openClientSettings: 'Open MangaDex API clients'
    },

    sync: {
      preferencesTitle: 'Auto push preferences',
      syncEnabledLabel: 'Push changes automatically',
      syncEnabledDescription:
        'Send status and score changes of entries carrying a MangaDex id to the account',
      pushScoreLabel: 'Include score',
      pushScoreDescription:
        'Write the local score as a MangaDex rating. An empty score never clears the remote rating.',
      manualTitle: 'Manual push',
      manualDescription:
        'Pushes every entry with a MangaDex id to the account. Progress and cancellation are handled by the task center.',
      pushAll: 'Push everything now'
    },

    import: {
      title: 'Import reading statuses',
      description:
        'Writes reading status onto matching entries. Creating missing entries scrapes them through the selected profile.',
      optionsLabel: 'Options',
      importScoresLabel: 'Also import ratings',
      updateExistingLabel: 'Update existing entries',
      createMissingLabel: 'Create missing entries',
      profileLabel: 'Comic profile',
      profilePlaceholder: 'Select a profile',
      runLabel: 'Run import',
      runDescription: 'Runs as an app task; the options above apply to this run only',
      startImport: 'Import'
    },

    automation: {
      title: 'Recommended automations',
      description:
        'Only recommended MangaDex templates are created here; enabling, triggers, and history are managed on the main app automation page',
      create: 'Create'
    },

    maintenance: {
      endpointTitle: 'Endpoint',
      endpointDescription: 'Point it at a mirror when the official host is unreachable',
      apiUrlLabel: 'API URL',
      apiUrlDescription: 'Root of the MangaDex REST API; sign-in traffic keeps the official host',
      restoreDefaults: 'Restore official endpoint',
      clientTitle: 'Scraping and client',
      clientDescription: 'Applies to every MangaDex search and scrape',
      preferRomanizedLabel: 'Prefer romanized titles',
      preferRomanizedDescription:
        'Use the romanized title as the display name when no title matches the content locale',
      timeoutLabel: 'Request timeout',
      timeoutDescription: 'Seconds to wait for a single response',
      seconds: 'seconds',
      retryLabel: 'Retry count',
      retryDescription: 'Extra attempts after rate limits or server errors',
      retryUnit: 'retries',
      actionsTitle: 'Maintenance actions',
      actionsDescription: 'These actions take effect immediately and cannot be undone',
      reset: 'Restore default settings',
      resetDescription: 'Preferences return to their defaults. The stored credentials are kept.'
    }
  }
}
