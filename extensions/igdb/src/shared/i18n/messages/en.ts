/**
 * English message catalog for the IGDB extension. This file is the schema
 * source: all other locale catalogs must satisfy `IgdbMessages`.
 */

export const en = {
  errors: {
    credentialMissing: 'Add a Twitch client id and secret in the IGDB extension settings first',
    credentialInvalid:
      'Twitch rejected the client credentials. Check them in the IGDB extension settings.',
    credentialRequired: 'Enter both a client id and a client secret',
    notFound: 'The IGDB entry does not exist',
    rateLimited: 'Too many IGDB requests. Try again later.',
    rejected: 'The IGDB API rejected the request',
    unavailable: 'The IGDB API is temporarily unavailable',
    networkFailed: 'The IGDB API network request failed',
    operationCancelled: 'The operation was cancelled',
    baseUrlInvalid: 'Enter an http or https address',
    idInvalid: ({ value }: { value: string }) => `"${value}" is not an IGDB id`
  },

  settings: {
    webviewTitle: 'IGDB',
    commandLabel: 'Settings',
    commandDescription: 'Configure the Twitch client IGDB authenticates with, and its endpoints'
  },

  ui: {
    loading: 'Loading…',
    unavailable: 'The IGDB settings could not be loaded',
    saved: 'Preferences saved',
    savePreferences: 'Save',
    discardChanges: 'Discard',
    unsavedChanges: 'Unsaved changes',
    actionFailed: 'The action failed',
    cancel: 'Cancel',
    confirm: 'Confirm',

    credentials: {
      title: 'Twitch client',
      description:
        'IGDB authenticates through Twitch. Register an application on the Twitch developer console and enter its client id and secret.',
      statusLabel: 'Status',
      clientIdLabel: 'Client id',
      clientIdPlaceholder: 'Your Twitch client id',
      clientSecretLabel: 'Client secret',
      clientSecretPlaceholder: 'Your Twitch client secret',
      configuredLabel: 'Configured',
      missingLabel: 'Not configured',
      save: 'Save client',
      clear: 'Remove client',
      test: 'Test connection',
      saveSucceeded: 'The Twitch client was saved',
      clearSucceeded: 'The Twitch client was removed',
      testSucceeded: 'Twitch accepted the client credentials',
      openConsole: 'Register an application on dev.twitch.tv'
    },

    endpoints: {
      title: 'Endpoints',
      description: 'Point these at a mirror when the official hosts are unreachable',
      apiBaseUrlLabel: 'API base URL',
      apiBaseUrlDescription: 'Root of the IGDB v4 API',
      oauthUrlLabel: 'OAuth token URL',
      oauthUrlDescription: 'Twitch endpoint that issues the client credentials token',
      restoreDefaults: 'Restore official endpoints'
    },

    preferences: {
      title: 'Preferences',
      description: 'Applies to every IGDB search and scrape',
      timeoutLabel: 'Request timeout',
      timeoutDescription: 'Seconds to wait for a single IGDB response',
      seconds: 'seconds',
      retryLabel: 'Retry attempts',
      retryDescription: 'Extra attempts after a rate limit or a server error',
      retryUnit: 'attempts',
      reset: 'Restore default settings',
      resetDescription:
        'Endpoints and preferences return to their defaults. The Twitch client is kept.',
      resetSucceeded: 'Default settings restored'
    }
  }
}
