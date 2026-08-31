export const en = {
  errors: {
    authRequired: 'Sign in to the NeoDB account first',
    tokenRejected: 'The NeoDB sign-in is no longer valid. Sign in again.',
    notFound: 'That NeoDB entry does not exist',
    rateLimited: 'Too many requests to NeoDB. Try again in a moment.',
    rejected: 'The NeoDB API rejected the request',
    unavailable: 'The NeoDB instance is temporarily unavailable',
    networkFailed: 'The network request to NeoDB failed',
    operationCancelled: 'The operation was cancelled',
    instanceUrlInvalid: 'Enter an http or https address',
    idInvalid: ({ value }: { value: string }) => `"${value}" is not a valid NeoDB id`,
    registrationFailed: 'The app could not register itself on the instance',
    instanceUnreachable: 'Could not reach the NeoDB instance. Try again later.',
    instanceUnavailable: ({ status }: { status: number }) =>
      `The NeoDB instance is temporarily unavailable (HTTP ${status}). Try again later.`,
    loginStateMismatch: 'The NeoDB sign-in callback failed validation. Sign in again.',
    loginDenied: 'The NeoDB authorization was declined. Sign in again when ready.',
    loginAuthorizeFailed: 'The NeoDB instance reported an authorization error. Sign in again.',
    loginSessionExpired: 'The NeoDB sign-in session expired. Sign in again.',
    noPendingLogin: 'No NeoDB sign-in is waiting to complete',
    loginNotReady: 'The NeoDB sign-in is not ready yet',
    codeEmpty: 'Enter the authorization code',
    operationRunning: 'A NeoDB shelf operation is already running. Wait for it to finish.'
  },

  oauth: {
    loginSucceededTitle: 'NeoDB sign-in completed',
    loginFailedTitle: 'NeoDB sign-in failed',
    loginCompleted: ({ userName }: { userName: string }) => `Signed in as ${userName}`,
    callbackFailed: 'Could not complete the NeoDB sign-in'
  },

  sync: {
    autoSyncFailedTitle: 'NeoDB sync failed',
    autoSyncFailedFallback: 'Could not push the change to NeoDB',
    pushTaskTitle: 'Push library to the NeoDB shelf',
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
    taskTitle: 'Import NeoDB shelf',
    phaseRead: 'Reading the NeoDB shelf',
    phaseApply: 'Applying shelf entries',
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
      title: 'Verify the NeoDB account',
      description: 'Checks the stored sign-in against the NeoDB instance'
    },
    pushAll: {
      title: 'Push the library to NeoDB',
      description: 'Pushes every entry with a NeoDB id to the shelf'
    },
    importShelf: {
      title: 'Import the NeoDB shelf',
      description: 'Writes shelf status and ratings onto matching local entries'
    }
  },

  automations: {
    names: {
      'auth-check': 'NeoDB: verify the account at startup',
      'push-full-daily': 'NeoDB: daily full push',
      'import-refresh-weekly': 'NeoDB: weekly shelf refresh'
    },
    labels: {
      'auth-check': 'Verify the account at startup',
      'push-full-daily': 'Daily full push',
      'import-refresh-weekly': 'Weekly shelf refresh'
    },
    descriptions: {
      'auth-check': 'Verifies the NeoDB sign-in when the app starts',
      'push-full-daily':
        'Pushes every linked entry to the NeoDB shelf once a day in the early morning',
      'import-refresh-weekly':
        'Re-imports shelf status and ratings onto existing entries once a week'
    },
    status: {
      missing: 'Not created',
      enabled: 'Enabled',
      disabled: 'Disabled'
    }
  },

  settings: {
    webviewTitle: 'NeoDB',
    commandLabel: 'Settings',
    commandDescription: 'Sign in to a NeoDB instance, import the shelf, and configure scraping'
  },

  ui: {
    loading: 'Loading…',
    unavailable: 'NeoDB settings could not be loaded',
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
      progress: ({ current, total }: { current: number; total: number }) => `${current} / ${total}`,
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
      runningJobs: 'Running NeoDB jobs',
      running: 'Running',
      idle: 'Idle',
      quickActionsTitle: 'Shortcuts',
      importAction: 'Import the NeoDB shelf',
      maintenanceAction: 'Adjust instance and client options',
      automationsTitle: 'Automation templates'
    },

    account: {
      title: 'Account',
      description:
        'The app registers itself on the chosen instance and signs in through the browser; the sign-in never expires. Use the manual-code path when the browser cannot bounce back to the app.',
      statusLabel: 'Status',
      configuredLabel: 'Signed in',
      missingLabel: 'Not signed in',
      pendingLabel: 'Waiting for the browser sign-in…',
      manualPendingLabel: 'Waiting for the authorization code…',
      instanceLabel: ({ instanceUrl }: { instanceUrl: string }) => `Instance: ${instanceUrl}`,
      login: 'Sign in with the browser',
      manualLogin: 'Sign in with a code',
      codePlaceholder: 'Paste the authorization code',
      completeManual: 'Complete sign-in',
      cancelLogin: 'Cancel sign-in',
      logout: 'Sign out',
      verify: 'Verify account',
      verifiedAs: ({ userName }: { userName: string }) => `Signed in as ${userName}`
    },

    sync: {
      preferencesTitle: 'Auto push preferences',
      syncEnabledLabel: 'Push changes automatically',
      syncEnabledDescription:
        'Send status and score changes of entries carrying a NeoDB id to the shelf',
      pushScoreLabel: 'Include score',
      pushScoreDescription:
        'Write the local score as the shelf rating. An empty score never clears the remote rating.',
      visibilityLabel: 'Mark visibility',
      visibilityDescription: 'Fediverse visibility of marks this app writes',
      visibilityPublic: 'Public',
      visibilityFollowers: 'Followers only',
      visibilitySelf: 'Only me',
      manualTitle: 'Manual push',
      manualDescription:
        'Pushes every entry with a NeoDB id to the shelf. Progress and cancellation are handled by the task center.',
      pushAll: 'Push everything now'
    },

    import: {
      title: 'Import shelf',
      description:
        'Writes shelf status and rating onto matching entries. Creating missing entries scrapes them through the selected profile.',
      optionsLabel: 'Options',
      updateExistingLabel: 'Update existing entries',
      createMissingLabel: 'Create missing entries',
      profileLabel: 'Novel profile',
      profilePlaceholder: 'Select a profile',
      runLabel: 'Run import',
      runDescription: 'Runs as an app task; the options above apply to this run only',
      startImport: 'Import'
    },

    automation: {
      title: 'Recommended automations',
      description:
        'Only recommended NeoDB templates are created here; enabling, triggers, and history are managed on the main app automation page',
      create: 'Create'
    },

    maintenance: {
      instanceTitle: 'Instance',
      instanceDescription: 'Any NeoDB deployment works; the sign-in is bound to its instance',
      instanceUrlLabel: 'Instance URL',
      instanceUrlDescription: 'Root of the NeoDB instance',
      restoreDefaults: 'Restore the flagship instance',
      clientTitle: 'Client',
      clientDescription: 'Applies to every NeoDB request',
      timeoutLabel: 'Request timeout',
      timeoutDescription: 'Seconds to wait for a single response',
      seconds: 'seconds',
      retryLabel: 'Retry count',
      retryDescription: 'Extra attempts after rate limits or server errors',
      retryUnit: 'retries',
      actionsTitle: 'Maintenance actions',
      actionsDescription: 'These actions take effect immediately and cannot be undone',
      reset: 'Restore default settings',
      resetDescription: 'Instance and preferences return to their defaults. The sign-in is kept.'
    }
  }
}
