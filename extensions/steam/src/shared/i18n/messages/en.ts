export const en = {
  errors: {
    keyRequired: 'Save the Steam Web API key first',
    steamIdInvalid: 'Enter a valid SteamID64 (seventeen digits starting with 7656)',
    keyRejected: 'Steam rejected the Web API key',
    profileRequired: 'Create a game scraper profile first',
    profileNotVisible:
      'Steam returned no games. Check the SteamID and that the profile game details are public.',
    notFound: 'That Steam app does not exist or is not visible on the store',
    rateLimited: 'Too many requests to Steam. Try again in a moment.',
    rejected: 'The Steam API rejected the request',
    unavailable: 'The Steam API is temporarily unavailable',
    networkFailed: 'The network request to Steam failed',
    operationCancelled: 'The operation was cancelled',
    idInvalid: ({ value }: { value: string }) => `"${value}" is not a valid Steam app id`,
    keyEmpty: 'Enter the Web API key',
    operationRunning: 'A Steam import is already running. Wait for it to finish.'
  },

  import: {
    taskTitle: 'Import owned Steam games',
    phaseRead: 'Reading the owned games',
    phaseApply: 'Creating entries',
    itemFailed: ({ id }: { id: string }) => `Import failed for ${id}`,
    summary: ({
      created,
      existing,
      failed
    }: {
      created: number
      existing: number
      failed: number
    }) => `Created ${created}, already present ${existing}, failed ${failed}`
  },

  commands: {
    verifyAccount: {
      title: 'Verify the Steam account',
      description: 'Checks the stored Web API key and SteamID by counting the owned games'
    },
    importOwned: {
      title: 'Import the owned Steam games',
      description: 'Creates entries for owned games the library does not know yet'
    }
  },

  automations: {
    names: {
      'auth-check': 'Steam: verify the account at startup',
      'import-refresh-weekly': 'Steam: weekly owned-games import'
    },
    labels: {
      'auth-check': 'Verify the account at startup',
      'import-refresh-weekly': 'Weekly owned-games import'
    },
    descriptions: {
      'auth-check': 'Verifies the Steam Web API key and SteamID when the app starts',
      'import-refresh-weekly':
        'Imports newly owned games once a week through the profile baked into the template'
    },
    status: {
      missing: 'Not created',
      enabled: 'Enabled',
      disabled: 'Disabled'
    }
  },

  settings: {
    webviewTitle: 'Steam',
    commandLabel: 'Settings',
    commandDescription: 'Connect a Steam account, import owned games, and configure scraping'
  },

  ui: {
    loading: 'Loading…',
    unavailable: 'Steam settings could not be loaded',
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
      import: 'Import',
      automation: 'Automation',
      maintenance: 'Maintenance'
    },

    task: {
      progress: ({ current, total }: { current: number; total: number }) =>
        `${current} / ${total}`,
      running: 'Running',
      completed: 'Completed',
      failed: 'Failed',
      cancelled: 'Cancelled',
      cancel: 'Cancel'
    },

    overview: {
      statusTitle: 'Status overview',
      accountLabel: 'Account',
      keyConfigured: 'Key stored',
      noKey: 'No key',
      available: 'Available',
      recommendedAutomations: 'Recommended automations',
      automationsComplete: 'All created',
      automationsMissing: ({ count }: { count: number }) => `${count} not created`,
      templatesCount: ({ count }: { count: number }) =>
        `${count} ${count === 1 ? 'template' : 'templates'}`,
      runtimeTitle: 'Runtime status',
      runningJobs: 'Running Steam jobs',
      running: 'Running',
      idle: 'Idle',
      quickActionsTitle: 'Shortcuts',
      importAction: 'Import the owned Steam games',
      maintenanceAction: 'Adjust client options',
      automationsTitle: 'Automation templates'
    },

    account: {
      title: 'Account',
      description:
        'The owned-games import needs a personal Web API key and the SteamID64 of the account. Game details on the profile must be public.',
      statusLabel: 'Status',
      configuredLabel: 'Key stored',
      missingLabel: 'No key',
      keyLabel: 'Web API key',
      keyPlaceholder: 'Paste the Web API key',
      steamIdLabel: 'SteamID64',
      steamIdDescription: 'Seventeen digits; shown in the profile URL or third-party tools',
      saveKey: 'Save key',
      clearKey: 'Remove key',
      verify: 'Verify',
      verifiedGames: ({ count }: { count: number }) => `${count} games visible`,
      openKeyPage: 'Get a Web API key'
    },

    import: {
      title: 'Owned-games import',
      description:
        'Reads the owned library and creates missing entries through the selected profile. Entries already carrying the Steam id are left untouched.',
      profileLabel: 'Game profile',
      profilePlaceholder: 'Select a profile',
      runLabel: 'Run import',
      runDescription: 'Runs as an app task; the options above apply to this run only',
      startImport: 'Import owned games'
    },

    automation: {
      title: 'Recommended automations',
      description:
        'Only recommended Steam templates are created here; enabling, triggers, and history are managed on the main app automation page',
      create: 'Create'
    },

    maintenance: {
      clientTitle: 'Client',
      clientDescription: 'Applies to every Steam request',
      timeoutLabel: 'Request timeout',
      timeoutDescription: 'Seconds to wait for a single response',
      seconds: 'seconds',
      retryLabel: 'Retry count',
      retryDescription: 'Extra attempts after rate limits or server errors',
      retryUnit: 'retries',
      actionsTitle: 'Maintenance actions',
      actionsDescription: 'These actions take effect immediately and cannot be undone',
      reset: 'Restore default settings',
      resetDescription: 'Preferences return to their defaults. The stored key is kept.'
    }
  }
}
