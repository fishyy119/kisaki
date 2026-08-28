export const en = {
  errors: {
    authRequired: 'Sign in to the NeoDB account first',
    tokenRejected: 'The NeoDB sign-in is no longer valid. Sign in again.',
    notFound: 'That NeoDB entry does not exist',
    rateLimited: 'Too many requests to NeoDB. Try again in a moment.',
    rejected: 'The NeoDB API rejected the request',
    unavailable: 'The NeoDB instance is temporarily unavailable',
    networkFailed: 'The network request to NeoDB failed',
    operationCancelled: 'The operation was cancelled',
    instanceUrlInvalid: 'Enter an http or https address',
    idInvalid: ({ value }: { value: string }) => `"${value}" is not a valid NeoDB id`,
    registrationFailed: 'The app could not register itself on the instance',
    loginStateMismatch: 'The NeoDB sign-in callback failed validation. Sign in again.',
    loginSessionExpired: 'The NeoDB sign-in session expired. Sign in again.',
    noPendingLogin: 'No NeoDB sign-in is waiting to complete',
    loginNotReady: 'The NeoDB sign-in is not ready yet',
    codeEmpty: 'Enter the authorization code',
    operationRunning: 'A NeoDB shelf operation is already running. Wait for it to finish.'
  },

  oauth: {
    loginSucceededTitle: 'NeoDB sign-in completed',
    loginFailedTitle: 'NeoDB sign-in failed',
    loginCompleted: ({ userName }: { userName: string }) => `Signed in as ${userName}`,
    callbackFailed: 'Could not complete the NeoDB sign-in'
  },

  sync: {
    autoSyncFailedTitle: 'NeoDB sync failed',
    autoSyncFailedFallback: 'Could not push the change to NeoDB',
    pushTaskTitle: 'Push library to the NeoDB shelf',
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
    taskTitle: 'Import NeoDB shelf',
    phaseRead: 'Reading the NeoDB shelf',
    phaseApply: 'Applying shelf entries',
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
    webviewTitle: 'NeoDB',
    commandLabel: 'Settings',
    commandDescription: 'Sign in to a NeoDB instance, import the shelf, and configure scraping'
  },

  ui: {
    loading: 'Loading…',
    unavailable: 'NeoDB settings could not be loaded',
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
        'The app registers itself on the chosen instance and signs in through the browser; the sign-in never expires. Use the manual-code path when the browser cannot bounce back to the app.',
      statusLabel: 'Status',
      configuredLabel: 'Signed in',
      missingLabel: 'Not signed in',
      pendingLabel: 'Waiting for the browser sign-in…',
      manualPendingLabel: 'Waiting for the authorization code…',
      instanceLabel: ({ instanceUrl }: { instanceUrl: string }) => `Instance: ${instanceUrl}`,
      login: 'Sign in with the browser',
      manualLogin: 'Sign in with a code',
      codePlaceholder: 'Paste the authorization code',
      completeManual: 'Complete sign-in',
      cancelLogin: 'Cancel sign-in',
      logout: 'Sign out',
      verify: 'Verify account',
      verifiedAs: ({ userName }: { userName: string }) => `Signed in as ${userName}`
    },

    integration: {
      title: 'Shelf integration',
      syncEnabledLabel: 'Push changes automatically',
      syncEnabledDescription:
        'Send status and score changes of entries carrying a NeoDB id to the shelf',
      pushScoreLabel: 'Include score',
      pushScoreDescription:
        'Write the local score as the shelf rating. An empty score never clears the remote rating.',
      visibilityLabel: 'Mark visibility',
      visibilityDescription: 'Fediverse visibility of marks this app writes',
      visibilityPublic: 'Public',
      visibilityFollowers: 'Followers only',
      visibilitySelf: 'Only me',
      pushAll: 'Push everything now',
      importTitle: 'Import shelf',
      importDescription:
        'Writes shelf status and rating onto matching entries. Creating missing entries scrapes them through the selected profile.',
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

    endpoints: {
      title: 'Instance',
      description: 'Any NeoDB deployment works; the sign-in is bound to its instance',
      instanceUrlLabel: 'Instance URL',
      instanceUrlDescription: 'Root of the NeoDB instance',
      restoreDefaults: 'Restore the flagship instance'
    },

    preferences: {
      title: 'Preferences',
      description: 'Applies to every NeoDB request',
      timeoutLabel: 'Request timeout',
      timeoutDescription: 'Seconds to wait for a single response',
      seconds: 'seconds',
      retryLabel: 'Retry count',
      retryDescription: 'Extra attempts after rate limits or server errors',
      retryUnit: 'retries',
      reset: 'Restore default settings',
      resetDescription: 'Instance and preferences return to their defaults. The sign-in is kept.',
      resetSucceeded: 'Settings were restored to defaults'
    }
  }
}
