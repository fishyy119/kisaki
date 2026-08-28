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
    pushSummary: ({ pushed, skipped, failed }: { pushed: number; skipped: number; failed: number }) =>
      `Pushed ${pushed}, skipped ${skipped}, failed ${failed}`
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

    credentials: {
      title: 'API token',
      description:
        'The Kana API is open, so scraping works without a token. Add a personal token to raise your rate limit.',
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
      openSettings: 'Create a token on vndb.org'
    },

    endpoints: {
      title: 'Endpoint',
      description: 'Point this at a mirror when the official host is unreachable',
      apiBaseUrlLabel: 'API base URL',
      apiBaseUrlDescription: 'Root of the VNDB Kana API',
      restoreDefaults: 'Restore official endpoint'
    },

    preferences: {
      title: 'Preferences',
      description: 'Applies to every VNDB search and scrape',
      preferRomanizedLabel: 'Prefer romanized titles',
      preferRomanizedDescription:
        'Uses the romanized title as the display name when the content language has no title of its own',
      timeoutLabel: 'Request timeout',
      timeoutDescription: 'Seconds to wait for a single VNDB response',
      seconds: 'seconds',
      retryLabel: 'Retry attempts',
      retryDescription: 'Extra attempts after a rate limit or a server error',
      retryUnit: 'attempts',
      reset: 'Restore default settings',
      resetDescription: 'Endpoint and preferences return to their defaults. The token is kept.',
      resetSucceeded: 'Default settings restored'
    },

    integration: {
      title: 'List integration',
      description:
        'Connects your VNDB list: import it into the library and push local status and score changes back. Requires a token with listread and listwrite.',
      verify: 'Verify account',
      verifiedAs: ({ username }: { username: string }) => `Signed in as ${username}`,
      permissionsLabel: 'List permissions',
      listRead: 'Read',
      listWrite: 'Write',
      permissionGranted: 'Granted',
      permissionMissing: 'Missing',
      syncEnabledLabel: 'Push changes automatically',
      syncEnabledDescription:
        'Status and score edits on entries with a VNDB id are pushed to your list',
      pushScoreLabel: 'Include the score',
      pushScoreDescription: 'Writes the local score as a VNDB vote; an empty score never clears it',
      pushAll: 'Push all now',
      importTitle: 'Import list',
      importDescription:
        'Writes list status and votes onto matching entries. Creating missing entries scrapes them through the selected profile.',
      profileLabel: 'Scraper profile',
      profilePlaceholder: 'Select a profile',
      updateExistingLabel: 'Update existing entries',
      createMissingLabel: 'Create missing entries',
      startImport: 'Import',
      taskProgress: ({ current, total }: { current: number; total: number }) =>
        `${current} / ${total}`,
      taskRunning: 'Running',
      taskCompleted: 'Completed',
      taskFailed: 'Failed',
      taskCancelled: 'Cancelled',
      cancelTask: 'Cancel'
    }
  }
}
