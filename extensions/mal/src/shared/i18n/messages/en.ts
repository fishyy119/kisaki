export const en = {
  errors: {
    authRequired: 'Sign in to the MyAnimeList account first',
    tokenExpired: 'The MyAnimeList sign-in has expired. Sign in again.',
    notFound: 'That MyAnimeList entry does not exist',
    rateLimited: 'Too many requests to MyAnimeList. Try again in a moment.',
    rejected: 'The MyAnimeList API rejected the request',
    unavailable: 'The MyAnimeList API is temporarily unavailable',
    networkFailed: 'The network request to MyAnimeList failed',
    mirrorUnavailable: 'The metadata mirror is temporarily unavailable',
    operationCancelled: 'The operation was cancelled',
    baseUrlInvalid: 'Enter an http or https address',
    idInvalid: ({ value }: { value: string }) => `"${value}" is not a valid MyAnimeList id`,
    loginStateMismatch: 'The MyAnimeList sign-in callback failed validation. Sign in again.',
    loginDenied: 'The MyAnimeList authorization was declined. Sign in again when ready.',
    loginAuthorizeFailed: 'MyAnimeList reported an authorization error. Sign in again.',
    loginSessionExpired: 'The MyAnimeList sign-in session expired. Sign in again.',
    noPendingLogin: 'No MyAnimeList sign-in is waiting to complete',
    loginNotReady: 'The MyAnimeList sign-in is not ready yet',
    operationRunning: 'A MyAnimeList list operation is already running. Wait for it to finish.'
  },

  oauth: {
    loginSucceededTitle: 'MyAnimeList sign-in completed',
    loginFailedTitle: 'MyAnimeList sign-in failed',
    loginCompleted: ({ userName }: { userName: string }) => `Signed in as ${userName}`,
    callbackFailed: 'Could not complete the MyAnimeList sign-in'
  },

  sync: {
    autoSyncFailedTitle: 'MyAnimeList sync failed',
    autoSyncFailedFallback: 'Could not push the change to MyAnimeList',
    pushTaskTitle: 'Push library to MyAnimeList lists',
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
    taskTitle: 'Import MyAnimeList lists',
    phaseRead: 'Reading MyAnimeList lists',
    phaseApply: 'Applying list entries',
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
      title: 'Verify the MyAnimeList account',
      description: 'Checks the stored sign-in against the MyAnimeList API'
    },
    pushAll: {
      title: 'Push the library to MyAnimeList',
      description: 'Pushes every entry with a MyAnimeList id to the lists'
    },
    importLists: {
      title: 'Import the MyAnimeList lists',
      description: 'Writes list status and scores onto matching local entries'
    }
  },

  automations: {
    names: {
      'auth-check': 'MyAnimeList: verify the account at startup',
      'push-full-daily': 'MyAnimeList: daily full push',
      'import-refresh-weekly': 'MyAnimeList: weekly list refresh'
    },
    labels: {
      'auth-check': 'Verify the account at startup',
      'push-full-daily': 'Daily full push',
      'import-refresh-weekly': 'Weekly list refresh'
    },
    descriptions: {
      'auth-check':
        'Verifies the MyAnimeList sign-in when the app starts and keeps the token refresh warm',
      'push-full-daily':
        'Pushes every linked entry to the MyAnimeList lists once a day in the early morning',
      'import-refresh-weekly': 'Re-imports list status and scores onto existing entries once a week'
    },
    status: {
      missing: 'Not created',
      enabled: 'Enabled',
      disabled: 'Disabled'
    }
  },

  settings: {
    webviewTitle: 'MyAnimeList',
    commandLabel: 'Settings',
    commandDescription: 'Sign in to MyAnimeList, import lists, and configure scraping'
  },

  ui: {
    loading: 'Loading…',
    unavailable: 'MyAnimeList settings could not be loaded',
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
      withScore: 'Status and score',
      withoutScore: 'Status only',
      recommendedAutomations: 'Recommended automations',
      automationsComplete: 'All created',
      automationsMissing: ({ count }: { count: number }) => `${count} not created`,
      templatesCount: ({ count }: { count: number }) =>
        `${count} ${count === 1 ? 'template' : 'templates'}`,
      runtimeTitle: 'Runtime status',
      runningJobs: 'Running MyAnimeList jobs',
      running: 'Running',
      idle: 'Idle',
      quickActionsTitle: 'Shortcuts',
      importAction: 'Import the MyAnimeList lists',
      maintenanceAction: 'Adjust endpoint and client options',
      automationsTitle: 'Automation templates'
    },

    account: {
      title: 'Account',
      description:
        'Sign in with the browser to connect the MyAnimeList lists. The sign-in happens directly against MyAnimeList; tokens refresh automatically.',
      statusLabel: 'Status',
      configuredLabel: 'Signed in',
      missingLabel: 'Not signed in',
      pendingLabel: 'Waiting for the browser sign-in…',
      expiresAtLabel: 'Token valid until',
      expiredLabel: 'Expired',
      login: 'Sign in with MyAnimeList',
      cancelLogin: 'Cancel sign-in',
      logout: 'Sign out',
      verify: 'Verify account',
      verifiedAs: ({ userName }: { userName: string }) => `Signed in as ${userName}`
    },

    sync: {
      preferencesTitle: 'Auto push preferences',
      syncEnabledLabel: 'Push changes automatically',
      syncEnabledDescription:
        'Send status and score changes of entries carrying a MyAnimeList id to the lists',
      pushScoreLabel: 'Include score',
      pushScoreDescription:
        'Write the local score to MyAnimeList. An empty score never clears the remote one.',
      manualTitle: 'Manual push',
      manualDescription:
        'Pushes every entry with a MyAnimeList id to the lists. Progress and cancellation are handled by the task center.',
      pushAll: 'Push everything now'
    },

    import: {
      title: 'Import lists',
      description:
        'Writes list status and score onto matching entries. Creating missing entries scrapes them through the selected profile.',
      optionsLabel: 'Options',
      listAnime: 'Anime list',
      listManga: 'Manga list',
      updateExistingLabel: 'Update existing entries',
      createMissingLabel: 'Create missing entries',
      animeProfileLabel: 'Anime profile',
      comicProfileLabel: 'Manga profile',
      novelProfileLabel: 'Novel profile',
      profilePlaceholder: 'Select a profile',
      runLabel: 'Run import',
      runDescription: 'Runs as an app task; the options above apply to this run only',
      startImport: 'Import'
    },

    automation: {
      title: 'Recommended automations',
      description:
        'Only recommended MyAnimeList templates are created here; enabling, triggers, and history are managed on the main app automation page',
      create: 'Create'
    },

    maintenance: {
      endpointTitle: 'Endpoints',
      endpointDescription: 'The official API root and the Jikan-compatible metadata mirror',
      apiUrlLabel: 'API URL',
      apiUrlDescription: 'Root of the official MyAnimeList API v2',
      mirrorEnabledLabel: 'Use metadata mirror',
      mirrorEnabledDescription:
        'Characters, staff, and episodes come from the mirror; with it off those slots stay absent',
      mirrorUrlLabel: 'Mirror URL',
      mirrorUrlDescription:
        'Root of a Jikan v4-compatible API, such as Tenrai or a self-hosted Jikan',
      restoreDefaults: 'Restore official endpoints',
      clientTitle: 'Scraping and client',
      clientDescription: 'Applies to every MyAnimeList search and scrape',
      preferRomajiLabel: 'Prefer romaji titles',
      preferRomajiDescription:
        'Use the romaji title as the display name when no title matches the content locale',
      timeoutLabel: 'Request timeout',
      timeoutDescription: 'Seconds to wait for a single response',
      seconds: 'seconds',
      retryLabel: 'Retry count',
      retryDescription: 'Extra attempts after rate limits or server errors',
      retryUnit: 'retries',
      actionsTitle: 'Maintenance actions',
      actionsDescription: 'These actions take effect immediately and cannot be undone',
      reset: 'Restore default settings',
      resetDescription: 'Endpoints and preferences return to their defaults. The sign-in is kept.'
    }
  }
}
