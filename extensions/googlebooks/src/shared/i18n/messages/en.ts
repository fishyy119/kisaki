export const en = {
  errors: {
    authRequired: 'Sign in to the Google account first',
    tokenExpired: 'The Google sign-in has expired. Sign in again.',
    notFound: 'That Google Books volume does not exist',
    rateLimited:
      'The Google Books search quota is used up. Add a personal API key or try again later.',
    rejected: 'The Google Books API rejected the request',
    unavailable: 'The Google Books API is temporarily unavailable',
    networkFailed: 'The network request to Google Books failed',
    relayUnavailable: 'The Kisaki OAuth relay is temporarily unavailable. Try again later.',
    loginSessionExpired: 'The Google sign-in session expired. Sign in again.',
    loginCallbackInvalid: 'The Google sign-in callback failed validation. Sign in again.',
    noPendingLogin: 'No Google sign-in is waiting to complete',
    loginNotReady: 'The Google sign-in is not ready yet',
    operationCancelled: 'The operation was cancelled',
    baseUrlInvalid: 'Enter an http or https address',
    idInvalid: ({ value }: { value: string }) => `"${value}" is not a valid Google Books volume id`,
    keyEmpty: 'Enter the API key',
    operationRunning: 'A Google Books import is already running. Wait for it to finish.'
  },

  oauth: {
    loginSucceededTitle: 'Google sign-in completed',
    loginFailedTitle: 'Google sign-in failed',
    loginCompleted: 'The Google Books library is connected',
    callbackFailed: 'Could not complete the Google sign-in'
  },

  import: {
    taskTitle: 'Import Google Books library',
    phaseRead: 'Reading the Google Books shelves',
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
    importLibrary: {
      title: 'Import the Google Books library',
      description: 'Writes library and shelf statuses onto matching local entries'
    }
  },

  automations: {
    names: {
      'import-refresh-weekly': 'Google Books: weekly library refresh'
    },
    labels: {
      'import-refresh-weekly': 'Weekly library refresh'
    },
    descriptions: {
      'import-refresh-weekly':
        'Re-imports library and shelf statuses onto existing entries once a week'
    },
    status: {
      missing: 'Not created',
      enabled: 'Enabled',
      disabled: 'Disabled'
    }
  },

  settings: {
    webviewTitle: 'Google Books',
    commandLabel: 'Settings',
    commandDescription: 'Sign in to Google Books, import the library, and configure scraping'
  },

  ui: {
    loading: 'Loading…',
    unavailable: 'Google Books settings could not be loaded',
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
      signedIn: 'Signed in',
      notSignedIn: 'Not signed in',
      available: 'Available',
      recommendedAutomations: 'Recommended automations',
      automationsComplete: 'All created',
      automationsMissing: ({ count }: { count: number }) => `${count} not created`,
      templatesCount: ({ count }: { count: number }) =>
        `${count} ${count === 1 ? 'template' : 'templates'}`,
      runtimeTitle: 'Runtime status',
      runningJobs: 'Running Google Books jobs',
      running: 'Running',
      idle: 'Idle',
      quickActionsTitle: 'Shortcuts',
      importAction: 'Import the Google Books library',
      maintenanceAction: 'Adjust client options',
      automationsTitle: 'Automation templates'
    },

    account: {
      title: 'Account',
      description:
        'Sign in with the browser to connect the Google Books library. Search works without signing in; a personal API key optionally raises the search quota.',
      statusLabel: 'Status',
      configuredLabel: 'Signed in',
      missingLabel: 'Not signed in',
      pendingLabel: 'Waiting for the browser sign-in…',
      login: 'Sign in with Google',
      completeLogin: 'I completed the authorization',
      cancelLogin: 'Cancel sign-in',
      logout: 'Sign out',
      apiKeyLabel: 'API key (optional)',
      apiKeyDescription: 'Raises the search quota; create one in the Google Cloud console',
      apiKeyPlaceholder: 'Paste the API key',
      apiKeyConfigured: 'API key stored',
      saveKey: 'Save key',
      clearKey: 'Remove key'
    },

    import: {
      title: 'Library import',
      description:
        'Reads the purchased library and the reading shelves, writes statuses onto matching entries, and creates missing ones through the selected profiles. Google Books carries purchases, not tracking, so nothing is pushed back.',
      includeEbooksLabel: 'My Google eBooks',
      includeEbooksDescription: 'The purchased and uploaded library; imported without a status',
      includeShelvesLabel: 'Reading shelves',
      includeShelvesDescription: 'To read, reading now, and have read become entry statuses',
      mergeSeriesLabel: 'Merge series volumes',
      mergeSeriesDescription:
        'When several volumes belong to one series, only the first volume creates an entry',
      optionsLabel: 'Options',
      updateExistingLabel: 'Update existing entries',
      createMissingLabel: 'Create missing entries',
      novelProfileLabel: 'Novel profile',
      comicProfileLabel: 'Comic profile',
      profilePlaceholder: 'Select a profile',
      runLabel: 'Run import',
      runDescription: 'Runs as an app task; the options above apply to this run only',
      startImport: 'Import'
    },

    automation: {
      title: 'Recommended automations',
      description:
        'Only recommended Google Books templates are created here; enabling, triggers, and history are managed on the main app automation page',
      create: 'Create'
    },

    maintenance: {
      clientTitle: 'Client',
      clientDescription: 'Applies to every Google Books request',
      timeoutLabel: 'Request timeout',
      timeoutDescription: 'Seconds to wait for a single response',
      seconds: 'seconds',
      retryLabel: 'Retry count',
      retryDescription: 'Extra attempts after rate limits or server errors',
      retryUnit: 'retries',
      actionsTitle: 'Maintenance actions',
      actionsDescription: 'These actions take effect immediately and cannot be undone',
      reset: 'Restore default settings',
      resetDescription: 'Preferences return to their defaults. The sign-in is kept.'
    }
  }
}
