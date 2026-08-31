/**
 * English message catalog for the AniList extension. This file is the schema
 * source: all other locale catalogs must satisfy `AnilistMessages`.
 */

export const en = {
  errors: {
    authRequired: 'Sign in to your AniList account first',
    tokenExpired: 'The AniList sign-in has expired. Sign in again.',
    notFound: 'The AniList entry does not exist',
    rateLimited: 'Too many AniList requests. Try again later.',
    rejected: 'The AniList API rejected the request',
    unavailable: 'The AniList API is temporarily unavailable',
    networkFailed: 'The AniList API network request failed',
    operationCancelled: 'The operation was cancelled',
    baseUrlInvalid: 'Enter an http or https address',
    idInvalid: ({ value }: { value: string }) => `"${value}" is not an AniList id`,
    relayUnavailable: 'The Kisaki OAuth relay is temporarily unavailable. Try again later.',
    loginSessionExpired: 'The AniList sign-in session has expired. Sign in again.',
    loginCallbackInvalid: 'The AniList sign-in callback failed validation. Sign in again.',
    loginDenied: 'The AniList authorization was declined. Sign in again when ready.',
    loginAuthorizeFailed: 'AniList reported an authorization error. Sign in again.',
    noPendingLogin: 'No AniList sign-in is waiting to be completed',
    loginNotReady: 'AniList sign-in is not ready yet',
    operationRunning: 'An AniList list operation is already running. Wait for it to finish.'
  },

  oauth: {
    loginSucceededTitle: 'AniList sign-in completed',
    loginFailedTitle: 'AniList sign-in failed',
    loginCompleted: ({ userName }: { userName: string }) => `Signed in as ${userName}`,
    callbackFailed: 'The AniList sign-in could not be completed'
  },

  auth: {
    expiresSoonTitle: 'AniList sign-in expires soon',
    expiresSoon: ({ days }: { days: number }) =>
      days > 0
        ? `The AniList token expires in ${days} days. Sign in again to renew it.`
        : 'The AniList token has expired. Sign in again.'
  },

  sync: {
    autoSyncFailedTitle: 'AniList sync failed',
    autoSyncFailedFallback: 'The change could not be pushed to AniList',
    pushTaskTitle: 'Push library to AniList lists',
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
    taskTitle: 'Import AniList lists',
    phaseRead: 'Reading the AniList lists',
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
      title: 'Verify the AniList account',
      description: 'Checks the stored sign-in against the AniList API and warns before it expires'
    },
    pushAll: {
      title: 'Push the library to AniList',
      description: 'Pushes every entry with an AniList id to the lists'
    },
    importLists: {
      title: 'Import the AniList lists',
      description: 'Writes list status and scores onto matching local entries'
    }
  },

  automations: {
    names: {
      'auth-check': 'AniList: verify the account at startup',
      'push-full-daily': 'AniList: daily full push',
      'import-refresh-weekly': 'AniList: weekly list refresh'
    },
    labels: {
      'auth-check': 'Verify the account at startup',
      'push-full-daily': 'Daily full push',
      'import-refresh-weekly': 'Weekly list refresh'
    },
    descriptions: {
      'auth-check':
        'Verifies the AniList sign-in when the app starts and warns before the token expires',
      'push-full-daily':
        'Pushes every linked entry to the AniList lists once a day in the early morning',
      'import-refresh-weekly': 'Re-imports list status and scores onto existing entries once a week'
    },
    status: {
      missing: 'Not created',
      enabled: 'Enabled',
      disabled: 'Disabled'
    }
  },

  settings: {
    webviewTitle: 'AniList',
    commandLabel: 'Settings',
    commandDescription: 'Sign in to AniList, import your lists, and configure scraping preferences'
  },

  ui: {
    loading: 'Loading…',
    unavailable: 'The AniList settings could not be loaded',
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
      expiresSoon: 'Expires soon',
      expired: 'Expired',
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
      runningJobs: 'Running AniList jobs',
      running: 'Running',
      idle: 'Idle',
      quickActionsTitle: 'Shortcuts',
      importAction: 'Import the AniList lists',
      maintenanceAction: 'Adjust endpoint and client options',
      automationsTitle: 'Automation templates'
    },

    account: {
      title: 'Account',
      description:
        'Sign in through the browser to connect your AniList lists. Tokens stay valid for about a year and cannot be refreshed.',
      statusLabel: 'Status',
      configuredLabel: 'Signed in',
      missingLabel: 'Not signed in',
      pendingLabel: 'Waiting for the browser sign-in…',
      expiresAtLabel: 'Token valid until',
      expiredLabel: 'Expired',
      login: 'Sign in with AniList',
      completeLogin: 'I have authorized',
      reopenAuthorize: 'Reopen authorize page',
      pendingHint:
        'If the browser showed an error page, sign in at anilist.co first, then reopen the authorize page.',
      cancelLogin: 'Cancel sign-in',
      logout: 'Sign out',
      verify: 'Verify account',
      verifiedAs: ({ userName }: { userName: string }) => `Signed in as ${userName}`
    },

    sync: {
      preferencesTitle: 'Auto push preferences',
      syncEnabledLabel: 'Push changes automatically',
      syncEnabledDescription:
        'Status and score edits on entries with an AniList id are pushed to your lists',
      pushScoreLabel: 'Include the score',
      pushScoreDescription: 'Writes the local score to AniList; an empty score never clears it',
      manualTitle: 'Manual push',
      manualDescription:
        'Pushes every entry with an AniList id to the lists. Progress and cancellation are handled by the task center.',
      pushAll: 'Push all now'
    },

    import: {
      title: 'Import lists',
      description:
        'Writes list status and scores onto matching entries. Creating missing entries scrapes them through the selected profiles.',
      optionsLabel: 'Options',
      listAnime: 'Anime list',
      listManga: 'Manga list',
      updateExistingLabel: 'Update existing entries',
      createMissingLabel: 'Create missing entries',
      animeProfileLabel: 'Anime profile',
      comicProfileLabel: 'Comic profile',
      novelProfileLabel: 'Novel profile',
      profilePlaceholder: 'Select a profile',
      runLabel: 'Run import',
      runDescription: 'Runs as an app task; the options above apply to this run only',
      startImport: 'Import'
    },

    automation: {
      title: 'Recommended automations',
      description:
        'Only recommended AniList templates are created here; enabling, triggers, and history are managed on the main app automation page',
      create: 'Create'
    },

    maintenance: {
      endpointTitle: 'Endpoint',
      endpointDescription: 'Point it at a mirror when the official host is unreachable',
      graphqlUrlLabel: 'GraphQL URL',
      graphqlUrlDescription: 'Root of the AniList GraphQL API',
      restoreDefaults: 'Restore official endpoint',
      clientTitle: 'Scraping and client',
      clientDescription: 'Applies to every AniList search and scrape',
      preferRomajiLabel: 'Prefer romaji titles',
      preferRomajiDescription:
        'Uses the romaji title as the display name when the content language has no title of its own',
      timeoutLabel: 'Request timeout',
      timeoutDescription: 'Seconds to wait for a single AniList response',
      seconds: 'seconds',
      retryLabel: 'Retry attempts',
      retryDescription: 'Extra attempts after a rate limit or a server error',
      retryUnit: 'attempts',
      actionsTitle: 'Maintenance actions',
      actionsDescription: 'These actions take effect immediately and cannot be undone',
      reset: 'Restore default settings',
      resetDescription: 'Endpoint and preferences return to their defaults. The sign-in is kept.'
    }
  }
}
