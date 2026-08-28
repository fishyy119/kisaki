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

    account: {
      title: 'Account',
      description:
        'Sign in through the browser to connect your AniList lists. Tokens stay valid for about a year and cannot be refreshed.',
      statusLabel: 'Status',
      configuredLabel: 'Signed in',
      missingLabel: 'Not signed in',
      pendingLabel: 'Waiting for the browser sign-in…',
      login: 'Sign in with AniList',
      completeLogin: 'I have authorized',
      cancelLogin: 'Cancel sign-in',
      logout: 'Sign out',
      verify: 'Verify account',
      verifiedAs: ({ userName }: { userName: string }) => `Signed in as ${userName}`
    },

    integration: {
      title: 'List integration',
      syncEnabledLabel: 'Push changes automatically',
      syncEnabledDescription:
        'Status and score edits on entries with an AniList id are pushed to your lists',
      pushScoreLabel: 'Include the score',
      pushScoreDescription: 'Writes the local score to AniList; an empty score never clears it',
      pushAll: 'Push all now',
      importTitle: 'Import lists',
      importDescription:
        'Writes list status and scores onto matching entries. Creating missing entries scrapes them through the selected profiles.',
      listAnime: 'Anime list',
      listManga: 'Manga list',
      updateExistingLabel: 'Update existing entries',
      createMissingLabel: 'Create missing entries',
      animeProfileLabel: 'Anime profile',
      comicProfileLabel: 'Comic profile',
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
      description: 'Point these at mirrors when the official hosts are unreachable',
      graphqlUrlLabel: 'GraphQL URL',
      graphqlUrlDescription: 'Root of the AniList GraphQL API',
      relayUrlLabel: 'OAuth relay URL',
      relayUrlDescription: 'Kisaki relay route that completes the AniList sign-in',
      restoreDefaults: 'Restore official endpoints'
    },

    preferences: {
      title: 'Preferences',
      description: 'Applies to every AniList search and scrape',
      preferRomajiLabel: 'Prefer romaji titles',
      preferRomajiDescription:
        'Uses the romaji title as the display name when the content language has no title of its own',
      timeoutLabel: 'Request timeout',
      timeoutDescription: 'Seconds to wait for a single AniList response',
      seconds: 'seconds',
      retryLabel: 'Retry attempts',
      retryDescription: 'Extra attempts after a rate limit or a server error',
      retryUnit: 'attempts',
      reset: 'Restore default settings',
      resetDescription: 'Endpoints and preferences return to their defaults. The sign-in is kept.',
      resetSucceeded: 'Default settings restored'
    }
  }
}
