/**
 * English message catalog for the VNDB extension. This file is the schema
 * source: all other locale catalogs must satisfy `VndbMessages`.
 */

export const en = {
  errors: {
    tokenInvalid: 'VNDB rejected the API token. Check it in the VNDB extension settings.',
    tokenRequired: 'Enter a VNDB API token',
    notFound: 'The VNDB entry does not exist',
    rateLimited: 'Too many VNDB requests. Try again later.',
    rejected: 'The VNDB API rejected the request',
    unavailable: 'The VNDB API is temporarily unavailable',
    networkFailed: 'The VNDB API network request failed',
    operationCancelled: 'The operation was cancelled',
    baseUrlInvalid: 'Enter an http or https address',
    idInvalid: ({ value }: { value: string }) => `"${value}" is not a VNDB id`,
    listPermissionMissing:
      'The VNDB token cannot read your list. Create one with the listread and listwrite permissions.',
    operationRunning: 'A VNDB list operation is already running. Wait for it to finish.'
  },

  sync: {
    autoSyncFailedTitle: 'VNDB sync failed',
    autoSyncFailedFallback: 'The change could not be pushed to VNDB',
    pushTaskTitle: 'Push library to VNDB list',
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
    taskTitle: 'Import VNDB list',
    phaseRead: 'Reading the VNDB list',
    phaseApply: 'Applying list entries',
    itemFailed: ({ id }: { id: string }) => `Importing ${id} failed`,
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
      title: 'Verify the VNDB account',
      description: 'Checks the stored token and its list permissions against the VNDB API'
    },
    pushAll: {
      title: 'Push the library to VNDB',
      description: 'Pushes every entry with a VNDB id to the list'
    },
    importList: {
      title: 'Import the VNDB list',
      description: 'Writes list status and votes onto matching local entries'
    }
  },

  automations: {
    names: {
      'auth-check': 'VNDB: verify the account at startup',
      'push-full-daily': 'VNDB: daily full push',
      'import-refresh-weekly': 'VNDB: weekly list refresh'
    },
    labels: {
      'auth-check': 'Verify the account at startup',
      'push-full-daily': 'Daily full push',
      'import-refresh-weekly': 'Weekly list refresh'
    },
    descriptions: {
      'auth-check': 'Verifies the VNDB token and its list permissions when the app starts',
      'push-full-daily':
        'Pushes every linked entry to the VNDB list once a day in the early morning',
      'import-refresh-weekly': 'Re-imports list status and votes onto existing entries once a week'
    },
    status: {
      missing: 'Not created',
      enabled: 'Enabled',
      disabled: 'Disabled'
    }
  },

  settings: {
    webviewTitle: 'VNDB',
    commandLabel: 'Settings',
    commandDescription: 'Configure the optional VNDB API token, endpoint, and scraping preferences'
  },

  ui: {
    loading: 'Loading…',
    unavailable: 'The VNDB settings could not be loaded',
    saved: 'Preferences saved',
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
      tokenConfigured: 'Token configured',
      anonymous: 'Anonymous access',
      available: 'Available',
      autoSyncLabel: 'Auto push',
      enabled: 'Enabled',
      disabled: 'Disabled',
      withScore: 'Status and vote',
      withoutScore: 'Status only',
      recommendedAutomations: 'Recommended automations',
      automationsComplete: 'All created',
      automationsMissing: ({ count }: { count: number }) => `${count} not created`,
      templatesCount: ({ count }: { count: number }) =>
        `${count} ${count === 1 ? 'template' : 'templates'}`,
      runtimeTitle: 'Runtime status',
      runningJobs: 'Running VNDB jobs',
      running: 'Running',
      idle: 'Idle',
      quickActionsTitle: 'Shortcuts',
      importAction: 'Import the VNDB list',
      maintenanceAction: 'Adjust endpoint and client options',
      automationsTitle: 'Automation templates'
    },

    account: {
      title: 'API token',
      description:
        'The Kana API is open, so scraping works without a token. Add a personal token to raise your rate limit; the list integration requires listread and listwrite.',
      statusLabel: 'Status',
      inputLabel: 'Token',
      inputPlaceholder: 'Paste your VNDB token',
      configuredLabel: 'Configured',
      missingLabel: 'Anonymous access',
      save: 'Save token',
      clear: 'Remove token',
      test: 'Test connection',
      saveSucceeded: 'The API token was saved',
      clearSucceeded: 'The API token was removed',
      testSucceeded: 'VNDB accepted the request',
      openSettings: 'Create a token on vndb.org',
      verify: 'Verify account',
      verifiedAs: ({ username }: { username: string }) => `Signed in as ${username}`,
      permissionsLabel: 'List permissions',
      listRead: 'Read',
      listWrite: 'Write',
      permissionGranted: 'Granted',
      permissionMissing: 'Missing'
    },

    sync: {
      preferencesTitle: 'Auto push preferences',
      preferencesDescription:
        'Pushing to the list requires a token with the listread and listwrite permissions',
      syncEnabledLabel: 'Push changes automatically',
      syncEnabledDescription:
        'Status and score edits on entries with a VNDB id are pushed to your list',
      pushScoreLabel: 'Include the score',
      pushScoreDescription: 'Writes the local score as a VNDB vote; an empty score never clears it',
      manualTitle: 'Manual push',
      manualDescription:
        'Pushes every entry with a VNDB id to the list. Progress and cancellation are handled by the task center.',
      pushAll: 'Push all now'
    },

    import: {
      title: 'Import list',
      description:
        'Writes list status and votes onto matching entries. Creating missing entries scrapes them through the selected profile.',
      optionsLabel: 'Options',
      updateExistingLabel: 'Update existing entries',
      createMissingLabel: 'Create missing entries',
      profileLabel: 'Game profile',
      profilePlaceholder: 'Select a profile',
      runLabel: 'Run import',
      runDescription: 'Runs as an app task; the options above apply to this run only',
      startImport: 'Import'
    },

    automation: {
      title: 'Recommended automations',
      description:
        'Only recommended VNDB templates are created here; enabling, triggers, and history are managed on the main app automation page',
      create: 'Create'
    },

    maintenance: {
      endpointTitle: 'Endpoint',
      endpointDescription: 'Point it at a mirror when the official host is unreachable',
      apiBaseUrlLabel: 'API base URL',
      apiBaseUrlDescription: 'Root of the VNDB Kana API',
      restoreDefaults: 'Restore official endpoint',
      clientTitle: 'Scraping and client',
      clientDescription: 'Applies to every VNDB search and scrape',
      preferRomanizedLabel: 'Prefer romanized titles',
      preferRomanizedDescription:
        'Uses the romanized title as the display name when the content language has no title of its own',
      timeoutLabel: 'Request timeout',
      timeoutDescription: 'Seconds to wait for a single VNDB response',
      seconds: 'seconds',
      retryLabel: 'Retry attempts',
      retryDescription: 'Extra attempts after a rate limit or a server error',
      retryUnit: 'attempts',
      actionsTitle: 'Maintenance actions',
      actionsDescription: 'These actions take effect immediately and cannot be undone',
      reset: 'Restore default settings',
      resetDescription: 'Endpoint and preferences return to their defaults. The token is kept.',
      resetSucceeded: 'Default settings restored'
    }
  }
}
