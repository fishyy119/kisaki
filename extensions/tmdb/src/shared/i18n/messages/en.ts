/**
 * English message catalog for the TMDB extension. This file is the schema
 * source: all other locale catalogs must satisfy `TmdbMessages`.
 */

export const en = {
  errors: {
    apiKeyMissing: 'Add a TMDB API key in the TMDB extension settings first',
    apiKeyInvalid: 'TMDB rejected the API key. Check it in the TMDB extension settings.',
    apiKeyRequired: 'Enter a TMDB API key',
    notFound: 'The TMDB entry does not exist',
    rateLimited: 'Too many TMDB requests. Try again later.',
    rejected: 'The TMDB API rejected the request',
    unavailable: 'The TMDB API is temporarily unavailable',
    networkFailed: 'The TMDB API network request failed',
    operationCancelled: 'The operation was cancelled',
    baseUrlInvalid: 'Enter an http or https address',
    idInvalid: ({ value }: { value: string }) => `"${value}" is not a TMDB id`,
    referenceInvalid: ({ value }: { value: string }) =>
      `"${value}" is not a TMDB reference. Use movie:<id>, tv:<id>, tv:<id>:s<season>, tv:<id>:eg:<episodeGroupId>:<groupId>, or a themoviedb.org link.`,
    episodeGroupEmpty: ({ setId }: { setId: string }) =>
      `TMDB episode group ${setId} contains no groups`,
    episodeGroupMissing: ({ setId, groupId }: { setId: string; groupId: string }) =>
      `TMDB episode group ${setId} has no group ${groupId}`
  },

  settings: {
    webviewTitle: 'TMDB',
    commandLabel: 'Settings',
    commandDescription: 'Configure the TMDB API key, endpoints, and scraping preferences'
  },

  ui: {
    loading: 'Loading…',
    unavailable: 'The TMDB settings could not be loaded',
    saved: 'Preferences saved',
    savePreferences: 'Save',
    discardChanges: 'Discard',
    unsavedChanges: 'Unsaved changes',
    actionFailed: 'The action failed',
    cancel: 'Cancel',
    confirm: 'Confirm',

    credentials: {
      title: 'API key',
      description:
        'TMDB requires a personal key. Both a v3 API key and a v4 read access token are accepted.',
      statusLabel: 'Status',
      inputLabel: 'Key or token',
      inputPlaceholder: 'Paste your TMDB key',
      configuredLabel: 'Configured',
      missingLabel: 'Not configured',
      modeApiKey: 'v3 API key',
      modeBearer: 'v4 access token',
      save: 'Save key',
      clear: 'Remove key',
      test: 'Test connection',
      saveSucceeded: 'The API key was saved',
      clearSucceeded: 'The API key was removed',
      testSucceeded: 'TMDB accepted the API key',
      openSettings: 'Get a key on themoviedb.org'
    },

    endpoints: {
      title: 'Endpoints',
      description: 'Point these at a mirror when the official hosts are unreachable',
      apiBaseUrlLabel: 'API base URL',
      apiBaseUrlDescription: 'Root of the TMDB v3 REST API',
      imageBaseUrlLabel: 'Image base URL',
      imageBaseUrlDescription: 'Root of the TMDB image CDN, without the size segment',
      restoreDefaults: 'Restore official endpoints'
    },

    episodeGroups: {
      title: 'Episode groups',
      description:
        'An episode group is an alternate episode ordering the TMDB community maintains for a show, such as one absolute run for a long-running series. Aired seasons stay the default; a group is chosen per entry.',
      stepPaste:
        'Paste a show id, an episode group id, or any themoviedb.org link into the anime search box, then search',
      stepPick:
        'The results then list every season and every part of every episode group of that show. Pick the part the entry should follow.',
      stepSwitch:
        'Moving an entry to another part is just another scrape: episodes realign by their TMDB episode id, so only the numbering changes and watch state survives',
      inputsLabel: 'Accepted in the search box',
      idsLabel: 'Accepted in the id field, when the group is already known'
    },

    preferences: {
      title: 'Preferences',
      description: 'Applies to every TMDB search and scrape',
      includeAdultLabel: 'Include adult results',
      includeAdultDescription: 'Lets TMDB search return entries flagged as adult',
      timeoutLabel: 'Request timeout',
      timeoutDescription: 'Seconds to wait for a single TMDB response',
      seconds: 'seconds',
      retryLabel: 'Retry attempts',
      retryDescription: 'Extra attempts after a rate limit or a server error',
      retryUnit: 'attempts',
      reset: 'Restore default settings',
      resetDescription: 'Endpoints and preferences return to their defaults. The API key is kept.',
      resetSucceeded: 'Default settings restored'
    }
  }
}
