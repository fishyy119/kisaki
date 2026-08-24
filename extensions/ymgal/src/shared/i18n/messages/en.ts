/**
 * English message catalog for the YMGal extension. This file is the schema
 * source: all other locale catalogs must satisfy `YmgalMessages`.
 */

export const en = {
  errors: {
    authFailed:
      'YMGal rejected the client credentials. Check them in the YMGal extension settings.',
    credentialRequired: 'Enter both a client id and a client secret',
    notFound: 'The YMGal archive does not exist',
    rateLimited: 'Too many YMGal requests. Try again later.',
    rejected: 'The YMGal API rejected the request',
    unavailable: 'The YMGal API is temporarily unavailable',
    networkFailed: 'The YMGal API network request failed',
    operationCancelled: 'The operation was cancelled',
    baseUrlInvalid: 'Enter an http or https address',
    idInvalid: ({ value }: { value: string }) => `"${value}" is not a YMGal archive id`
  },

  settings: {
    webviewTitle: 'YMGal',
    commandLabel: 'Settings',
    commandDescription: 'Configure the YMGal API client, endpoint, and scraping preferences'
  },

  ui: {
    loading: 'Loading…',
    unavailable: 'The YMGal settings could not be loaded',
    saved: 'Preferences saved',
    savePreferences: 'Save',
    discardChanges: 'Discard',
    unsavedChanges: 'Unsaved changes',
    actionFailed: 'The action failed',
    cancel: 'Cancel',
    confirm: 'Confirm',

    credentials: {
      title: 'API client',
      description:
        'YMGal publishes a shared public client, which this extension uses by default. Store your own only if you applied for a dedicated one.',
      statusLabel: 'Active client',
      sharedLabel: 'Shared public client',
      customLabel: 'Your own client',
      clientIdLabel: 'Client id',
      clientIdPlaceholder: 'Your YMGal client id',
      clientSecretLabel: 'Client secret',
      clientSecretPlaceholder: 'Your YMGal client secret',
      save: 'Save client',
      clear: 'Use shared client',
      test: 'Test connection',
      saveSucceeded: 'The API client was saved',
      clearSucceeded: 'Switched back to the shared public client',
      testSucceeded: 'YMGal accepted the API client',
      openDeveloper: 'Request a client on ymgal.games'
    },

    endpoints: {
      title: 'Endpoint',
      description: 'Point this at a mirror when the official host is unreachable',
      apiBaseUrlLabel: 'API base URL',
      apiBaseUrlDescription: 'Root of the YMGal open API',
      restoreDefaults: 'Restore official endpoint'
    },

    preferences: {
      title: 'Preferences',
      description: 'Applies to every YMGal search and scrape',
      preferChineseLabel: 'Prefer Chinese titles',
      preferChineseDescription:
        'Uses the Chinese title as the display name when the content language is Chinese',
      timeoutLabel: 'Request timeout',
      timeoutDescription: 'Seconds to wait for a single YMGal response',
      seconds: 'seconds',
      retryLabel: 'Retry attempts',
      retryDescription: 'Extra attempts after a rate limit or a server error',
      retryUnit: 'attempts',
      reset: 'Restore default settings',
      resetDescription: 'Endpoint and preferences return to their defaults. The client is kept.',
      resetSucceeded: 'Default settings restored'
    }
  }
}
