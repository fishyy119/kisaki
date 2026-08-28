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

    integration: {
      title: 'Reading integration',
      syncEnabledLabel: 'Push changes automatically',
      syncEnabledDescription:
        'Send status and score changes of entries carrying a MangaDex id to the account',
      pushScoreLabel: 'Include score',
      pushScoreDescription:
        'Write the local score as a MangaDex rating. An empty score never clears the remote rating.',
      pushAll: 'Push everything now',
      importTitle: 'Import reading statuses',
      importDescription:
        'Writes reading status onto matching entries. Creating missing entries scrapes them through the selected profile.',
      importScoresLabel: 'Also import ratings',
      updateExistingLabel: 'Update existing entries',
      createMissingLabel: 'Create missing entries',
      profilePlaceholder: 'Select a profile',
      startImport: 'Import',
      taskProgress: ({ current, total }: { current: number; total: number }) =>
        `${current} / ${total}`,
      taskRunning: 'Running',
      taskCompleted: 'Completed',
      taskFailed: 'Failed',
      taskCancelled: 'Cancelled',
      cancelTask: 'Cancel'
    },

    preferences: {
      title: 'Preferences',
      description: 'Applies to every MangaDex search and scrape',
      preferRomanizedLabel: 'Prefer romanized titles',
      preferRomanizedDescription:
        'Use the romanized title as the display name when no title matches the content locale',
      timeoutLabel: 'Request timeout',
      timeoutDescription: 'Seconds to wait for a single response',
      seconds: 'seconds',
      retryLabel: 'Retry count',
      retryDescription: 'Extra attempts after rate limits or server errors',
      retryUnit: 'retries',
      reset: 'Restore default settings',
      resetDescription: 'Preferences return to their defaults. The stored credentials are kept.',
      resetSucceeded: 'Settings were restored to defaults'
    }
  }
}
