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

    account: {
      title: 'Account',
      description:
        'Sign in with the browser to connect the MyAnimeList lists. The sign-in happens directly against MyAnimeList; tokens refresh automatically.',
      statusLabel: 'Status',
      configuredLabel: 'Signed in',
      missingLabel: 'Not signed in',
      pendingLabel: 'Waiting for the browser sign-in…',
      login: 'Sign in with MyAnimeList',
      cancelLogin: 'Cancel sign-in',
      logout: 'Sign out',
      verify: 'Verify account',
      verifiedAs: ({ userName }: { userName: string }) => `Signed in as ${userName}`
    },

    integration: {
      title: 'List integration',
      syncEnabledLabel: 'Push changes automatically',
      syncEnabledDescription:
        'Send status and score changes of entries carrying a MyAnimeList id to the lists',
      pushScoreLabel: 'Include score',
      pushScoreDescription:
        'Write the local score to MyAnimeList. An empty score never clears the remote one.',
      pushAll: 'Push everything now',
      importTitle: 'Import lists',
      importDescription:
        'Writes list status and score onto matching entries. Creating missing entries scrapes them through the selected profile.',
      listAnime: 'Anime list',
      listManga: 'Manga list',
      updateExistingLabel: 'Update existing entries',
      createMissingLabel: 'Create missing entries',
      animeProfileLabel: 'Anime profile',
      comicProfileLabel: 'Manga profile',
      novelProfileLabel: 'Novel profile',
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

    endpoints: {
      title: 'Endpoints',
      description: 'The official API root and the Jikan-compatible metadata mirror',
      apiUrlLabel: 'API URL',
      apiUrlDescription: 'Root of the official MyAnimeList API v2',
      mirrorEnabledLabel: 'Use metadata mirror',
      mirrorEnabledDescription:
        'Characters, staff, and episodes come from the mirror; with it off those slots stay absent',
      mirrorUrlLabel: 'Mirror URL',
      mirrorUrlDescription:
        'Root of a Jikan v4-compatible API, such as Tenrai or a self-hosted Jikan',
      restoreDefaults: 'Restore official endpoints'
    },

    preferences: {
      title: 'Preferences',
      description: 'Applies to every MyAnimeList search and scrape',
      preferRomajiLabel: 'Prefer romaji titles',
      preferRomajiDescription:
        'Use the romaji title as the display name when no title matches the content locale',
      timeoutLabel: 'Request timeout',
      timeoutDescription: 'Seconds to wait for a single response',
      seconds: 'seconds',
      retryLabel: 'Retry count',
      retryDescription: 'Extra attempts after rate limits or server errors',
      retryUnit: 'retries',
      reset: 'Restore default settings',
      resetDescription: 'Endpoints and preferences return to their defaults. The sign-in is kept.',
      resetSucceeded: 'Settings were restored to defaults'
    }
  }
}
