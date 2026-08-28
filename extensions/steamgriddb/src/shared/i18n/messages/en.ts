export const en = {
  errors: {
    keyRequired: 'Save the SteamGridDB API key first',
    keyRejected: 'SteamGridDB rejected the API key',
    notFound: 'That SteamGridDB entry does not exist',
    rateLimited: 'Too many requests to SteamGridDB. Try again in a moment.',
    rejected: 'The SteamGridDB API rejected the request',
    unavailable: 'The SteamGridDB API is temporarily unavailable',
    networkFailed: 'The network request to SteamGridDB failed',
    operationCancelled: 'The operation was cancelled',
    idInvalid: ({ value }: { value: string }) => `"${value}" is not a valid SteamGridDB id`,
    keyEmpty: 'Enter the API key'
  },

  settings: {
    webviewTitle: 'SteamGridDB',
    commandLabel: 'Settings',
    commandDescription: 'Configure the SteamGridDB API key and artwork preferences'
  },

  ui: {
    loading: 'Loading…',
    unavailable: 'SteamGridDB settings could not be loaded',
    saved: 'Settings saved',
    savePreferences: 'Save',
    discardChanges: 'Discard',
    unsavedChanges: 'Unsaved changes',
    actionFailed: 'The action failed',
    cancel: 'Cancel',
    confirm: 'Confirm',

    account: {
      title: 'API key',
      description:
        'SteamGridDB requires a free personal API key. Saving validates it with a probe request.',
      statusLabel: 'Status',
      configuredLabel: 'Key stored',
      missingLabel: 'No key',
      keyLabel: 'API key',
      keyPlaceholder: 'Paste the API key',
      saveKey: 'Save key',
      clearKey: 'Remove key',
      openKeyPage: 'Get an API key'
    },

    preferences: {
      title: 'Preferences',
      description: 'Applies to every artwork request',
      includeNsfwLabel: 'Include NSFW artwork',
      includeNsfwDescription: 'Also return artwork the community marked as not safe for work',
      timeoutLabel: 'Request timeout',
      timeoutDescription: 'Seconds to wait for a single response',
      seconds: 'seconds',
      retryLabel: 'Retry count',
      retryDescription: 'Extra attempts after rate limits or server errors',
      retryUnit: 'retries',
      reset: 'Restore default settings',
      resetDescription: 'Preferences return to their defaults. The stored key is kept.',
      resetSucceeded: 'Settings were restored to defaults'
    }
  }
}
