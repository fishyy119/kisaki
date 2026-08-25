/**
 * English message catalog for the Bangumi extension. This file is the schema
 * source: all other locale catalogs must satisfy `BangumiMessages`.
 */

import type { BangumiMediaScope } from '../../scopes'

type Scope = BangumiMediaScope
type CollectionType = 1 | 2 | 3 | 4 | 5

const NOUNS: Record<Scope, string> = {
  book: 'book',
  game: 'game',
  anime: 'anime entry',
  music: 'music entry'
}

const PLURALS: Record<Scope, string> = {
  book: 'books',
  game: 'games',
  anime: 'anime entries',
  music: 'music entries'
}

function countOf(scope: Scope, count: number): string {
  return `${count} ${count === 1 ? NOUNS[scope] : PLURALS[scope]}`
}

export const en = {
  common: {
    cancel: 'Cancel',
    close: 'Close',
    confirm: 'Confirm',
    create: 'Create',
    preview: 'Preview',
    none: 'None',
    listSeparator: ', '
  },

  media: {
    scopes: {
      book: 'Books',
      game: 'Games',
      anime: 'Anime',
      music: 'Music'
    } satisfies Record<Scope, string>,
    collections: {
      book: { 1: 'Wish to read', 2: 'Read', 3: 'Reading', 4: 'On hold', 5: 'Dropped' },
      game: { 1: 'Wish to play', 2: 'Played', 3: 'Playing', 4: 'On hold', 5: 'Dropped' },
      anime: { 1: 'Wish to watch', 2: 'Watched', 3: 'Watching', 4: 'On hold', 5: 'Dropped' },
      music: { 1: 'Wish to listen', 2: 'Listened', 3: 'Listening', 4: 'On hold', 5: 'Dropped' }
    } satisfies Record<Scope, Record<CollectionType, string>>
  },

  errors: {
    authRequired: 'Sign in to your Bangumi account first',
    authSessionInvalid: 'The Bangumi session is no longer valid. Sign in again.',
    tokenRefreshFailed: 'The Bangumi credentials could not be refreshed. Sign in again.',
    refreshTokenMissing: 'No Bangumi refresh token exists. Sign in again.',
    tokenSaveFailed: 'The Bangumi credentials could not be saved',

    loginNotReady: 'Bangumi sign-in is not ready yet',
    loginCallbackMissingParams: 'The Bangumi sign-in callback is missing required parameters',
    loginSessionExpired: 'The Bangumi sign-in session has expired. Sign in again.',
    loginCallbackInvalid: 'The Bangumi sign-in callback failed validation. Sign in again.',
    noPendingLogin: 'No Bangumi sign-in is waiting to be completed',

    relayUnreachable: 'Could not reach the Kisaki OAuth relay',
    relayUnavailable: 'The Kisaki OAuth relay is temporarily unavailable. Try again later.',
    relayAvailable: 'The OAuth relay is available',
    relayInvalidSession: 'The OAuth relay returned an unrecognized sign-in session',
    relayNoToken: 'The OAuth relay did not return access credentials',

    apiNotFound: 'The Bangumi entry does not exist',
    apiRateLimited: 'Too many Bangumi API requests. Try again later.',
    apiRejected: 'The Bangumi API rejected the request',
    apiUnavailable: 'The Bangumi API is temporarily unavailable',
    networkFailed: 'The Bangumi API network request failed',
    accountResponseInvalid: 'The Bangumi account response could not be recognized',
    idInvalid: ({ value }: { value: string }) => `"${value}" is not a Bangumi id`,

    operationCancelled: 'The operation was cancelled',
    jobCancelled: 'The Bangumi job was cancelled',
    jobFailed: 'The Bangumi job failed',
    jobAlreadyRunning: 'This Bangumi job is already running. Wait for it to finish or cancel it.',

    invalidMediaScope: 'Select a valid Bangumi media type',
    mediaScopeNotRegistered: 'The Bangumi media type is not registered',
    localWriteUnsupported: ({ scope }: { scope: Scope }) =>
      `${en.media.scopes[scope]} do not support writing to the local library yet`,
    localWriteUnsupportedGeneric:
      'This media type does not support writing to the local library yet',

    localMediaStatusUnknown: 'Could not recognize the local entry status',
    localMediaMissing: 'The local entry does not exist',
    localItemMissing: 'The local entry does not exist',
    importedItemMissing: 'The imported local entry does not exist',
    targetCollectionMissing: 'The selected target collection does not exist',
    selectTargetCollection: 'Select a target collection',
    indexTitleEmpty: 'The Bangumi index title is empty; a collection cannot be created',
    indexInputRequired: 'Enter a Bangumi index ID or link',
    indexInputInvalid:
      'The Bangumi index must be a numeric ID, or a link like https://bgm.tv/index/<id> or https://bangumi.tv/index/<id>',
    indexSubjectMissingId: 'The Bangumi index entry is missing a valid subject ID',
    collectionMissingSubjectId: 'The Bangumi collection is missing a valid subject ID',
    profileRequired: 'Select the scraper profile used to create local entries',
    profileNotFound: 'The selected scraper profile does not exist'
  },

  oauth: {
    loginSucceededTitle: 'Bangumi signed in',
    loginFailedTitle: 'Bangumi sign-in failed',
    loginCompleted: ({ nickname }: { nickname: string }) => `Bangumi signed in: ${nickname}`,
    callbackFailed:
      'The Bangumi sign-in callback failed. Return to the settings page and try again.'
  },

  notifications: {
    autoSyncFailedTitle: 'Bangumi auto sync failed',
    autoSyncFailedFallback: 'Bangumi auto sync failed'
  },

  commands: {
    authRefresh: {
      title: 'Refresh Bangumi credentials',
      description: 'Refresh the Bangumi token and verify the current account'
    },
    syncChanged: {
      title: 'Sync changed Bangumi entries',
      description: 'Sync local entry changes queued during this session'
    },
    syncFull: {
      title: 'Bangumi full sync',
      description: 'Scan local entries and sync Bangumi collection status and ratings'
    },
    importCollections: {
      title: 'Import my Bangumi collections',
      description: 'Import the current Bangumi user collections by media type'
    },
    importIndex: {
      title: 'Import a Bangumi index',
      description: 'Import entries from a Bangumi index by media type'
    }
  },

  jobs: {
    completed: 'The Bangumi job completed',
    cancelled: 'The Bangumi job was cancelled',

    auth: {
      refreshingToken: 'Refreshing Bangumi credentials..',
      verifyingAccount: 'Verifying the Bangumi account..',
      accountValid: ({ nickname }: { nickname: string }) => `Bangumi account is valid: ${nickname}`,
      accountRefreshed: ({ nickname }: { nickname: string }) =>
        `Bangumi account summary updated: ${nickname}`
    },

    sync: {
      loadingQueue: 'Reading the Bangumi change queue..',
      syncingQueue: 'Syncing the Bangumi change queue..',
      queueUnsupported: ({ scope }: { scope: Scope }) =>
        `${en.media.scopes[scope]} do not support local change sync yet`,
      queueCompleted: ({ count }: { count: number }) =>
        `Change queue sync completed: ${count} ${count === 1 ? 'entry' : 'entries'} synced`,
      fullUnsupported: ({ scope }: { scope: Scope }) =>
        `${en.media.scopes[scope]} do not support local full sync yet`,
      fullCompleted: ({ count, scope }: { count: number; scope: Scope }) =>
        `Full sync completed: ${countOf(scope, count)} synced`,
      previewCompleted: ({ count, scope }: { count: number; scope: Scope }) =>
        `Full sync preview completed: ${countOf(scope, count)} can be synced`,
      scanningItems: ({ scope }: { scope: Scope }) => `Scanning ${PLURALS[scope]}..`,
      collectingItems: ({ scope }: { scope: Scope }) => `Calculating ${PLURALS[scope]} to sync..`,
      previewingItems: 'Previewing the Bangumi full sync..',
      applyingItems: 'Syncing Bangumi full sync entries..'
    },

    import: {
      validating: 'Checking Bangumi import parameters..',
      validatingIndex: 'Checking Bangumi index import parameters..',
      readingCollections: ({ scope, type }: { scope: Scope; type: CollectionType }) =>
        `Reading Bangumi "${en.media.collections[scope][type]}" collections..`,
      readingIndex: 'Reading Bangumi index entries..',
      matchingLocal: ({ scope }: { scope: Scope }) => `Matching ${PLURALS[scope]}..`,
      collectingPlan: ({ scope }: { scope: Scope }) => `Calculating ${PLURALS[scope]} to import..`,
      preparing: ({ scope }: { scope: Scope }) => `Preparing to import ${PLURALS[scope]}..`,
      creatingLocal: ({ scope }: { scope: Scope }) => `Adding ${PLURALS[scope]}..`,
      patchingLocal: ({ scope }: { scope: Scope }) => `Updating ${PLURALS[scope]}..`,
      writeUnsupported: ({ scope }: { scope: Scope }) =>
        `${en.media.scopes[scope]} do not support writing to the local library yet`,
      collectionsCompleted: ({
        added,
        updated,
        scope
      }: {
        added: number
        updated: number
        scope: Scope
      }) =>
        `Collection import completed: ${countOf(scope, added)} added, ${updated} existing updated`,
      collectionsPreviewCompleted: ({
        toImport,
        toPatch,
        scope
      }: {
        toImport: number
        toPatch: number
        scope: Scope
      }) =>
        `Collection import preview completed: ${countOf(scope, toImport)} will be imported, ${toPatch} existing will be updated`,
      indexCompleted: ({
        added,
        updated,
        scope
      }: {
        added: number
        updated: number
        scope: Scope
      }) => `Index import completed: ${countOf(scope, added)} added, ${updated} existing updated`,
      indexPreviewCompleted: ({
        toImport,
        toPatch,
        scope
      }: {
        toImport: number
        toPatch: number
        scope: Scope
      }) =>
        `Index import preview completed: ${countOf(scope, toImport)} will be imported, ${toPatch} existing will be updated`,
      buildingCollectionsPreview: 'Generating the collection import preview..',
      buildingIndexPreview: 'Generating the index import preview..',
      buildingRemoteCollectionsPreview: 'Generating the remote collection preview..',
      buildingRemoteIndexPreview: 'Generating the remote index preview..',
      remoteCollectionsPreviewCompleted: ({ scope }: { scope: Scope }) =>
        `${en.media.scopes[scope]} remote collection preview completed`,
      remoteIndexPreviewCompleted: ({ scope }: { scope: Scope }) =>
        `${en.media.scopes[scope]} index remote preview completed`
    },

    preview: {
      remoteBadge: ({ scope }: { scope: Scope }) => `${en.media.scopes[scope]} remote preview`,
      createLocalBadge: ({ scope }: { scope: Scope }) => `Create local ${NOUNS[scope]}`,
      updateLocalBadge: ({ scope }: { scope: Scope }) => `Update local ${NOUNS[scope]}`,
      createRemoteCollectionBadge: 'Create Bangumi collection',
      updateRemoteCollectionBadge: 'Update Bangumi collection',
      collectionStatus: 'Collection status',
      status: 'Status',
      score: 'Score',
      tags: 'Tags',
      collection: 'Collection',
      unitProgress: 'Reading progress',
      unitProgressValue: ({ volumes, chapters }: { volumes: number; chapters: number }) =>
        `${volumes} vol. / ${chapters} ch.`,
      notCollected: 'Not collected',
      notRated: 'Not rated',
      notInCollection: 'Not in collection',
      notSet: 'Not set',
      missing: 'Missing',
      create: 'Create',
      remote: 'Remote',
      indexEntry: 'Index entry',
      remotePreview: 'Remote preview'
    },

    gameStatus: {
      notStarted: 'Wish to play',
      inProgress: 'Playing',
      partial: 'Partially completed',
      completed: 'Played',
      multiple: 'Multiple playthroughs',
      shelved: 'On hold',
      unset: 'Not set'
    },

    animeStatus: {
      planned: 'Plan to watch',
      watching: 'Watching',
      completed: 'Watched',
      onHold: 'On hold',
      dropped: 'Dropped',
      unset: 'Not set'
    },

    bookStatus: {
      planned: 'Plan to read',
      reading: 'Reading',
      completed: 'Read',
      onHold: 'On hold',
      dropped: 'Dropped',
      unset: 'Not set'
    }
  },

  automations: {
    names: {
      'auth-refresh': 'Bangumi: refresh credentials at startup',
      'sync-changed': 'Bangumi: sync the change queue after startup',
      'sync-full-daily': 'Bangumi: daily full sync'
    },
    labels: {
      'auth-refresh': 'Refresh credentials at startup',
      'sync-changed': 'Sync the change queue after startup',
      'sync-full-daily': 'Daily full sync'
    },
    descriptions: {
      'auth-refresh': 'Refreshes and verifies the Bangumi credentials when the app starts',
      'sync-changed': 'Syncs local changes accumulated during the previous session after startup',
      'sync-full-daily': 'Runs a full library sync once a day in the early morning'
    },
    status: {
      missing: 'Not created',
      enabled: 'Enabled',
      disabled: 'Disabled'
    }
  },

  settings: {
    commandLabel: 'Settings',
    commandDescription: 'Open the Bangumi integration settings',
    webviewTitle: 'Bangumi'
  },

  ui: {
    loading: 'Loading Bangumi settings..',
    unavailable: 'Bangumi settings are unavailable',
    saved: 'Preferences saved',
    unsavedChanges: 'Unsaved changes',
    discardChanges: 'Discard changes',
    savePreferences: 'Save preferences',
    actionFailed: 'The operation failed. Try again.',
    mediaScope: 'Media type',
    mediaScopePlaceholder: 'Select a media type',

    tabs: {
      overview: 'Overview',
      account: 'Account',
      sync: 'Sync',
      import: 'Import',
      automation: 'Automation',
      maintenance: 'Maintenance'
    },

    overview: {
      statusTitle: 'Status overview',
      accountLabel: 'Account',
      notLoggedIn: 'Not signed in',
      loggedIn: 'Signed in',
      notAuthorized: 'Not authorized',
      credentialsExpired: 'Credentials expired',
      available: 'Available',
      autoSyncLabel: 'Auto sync',
      enabled: 'Enabled',
      disabled: 'Disabled',
      syncItemCreate: 'Create collections',
      syncItemStatus: 'Play status',
      syncItemScore: 'Rating',
      noSyncItems: 'No sync items selected',
      recommendedAutomations: 'Recommended automations',
      automationsComplete: 'All created',
      automationsMissing: ({ count }: { count: number }) => `${count} not created`,
      templatesCount: ({ count }: { count: number }) =>
        `${count} ${count === 1 ? 'template' : 'templates'}`,
      runtimeTitle: 'Runtime status',
      runningJobs: 'Running Bangumi jobs',
      running: 'Running',
      idle: 'Idle',
      localResources: 'Available local resources',
      localResourcesSummary: ({
        profiles,
        collections
      }: {
        profiles: number
        collections: number
      }) =>
        `${profiles} scraper ${profiles === 1 ? 'profile' : 'profiles'} / ${collections} ${collections === 1 ? 'collection' : 'collections'}`,
      quickActionsTitle: 'Shortcuts',
      importAction: 'Import Bangumi collections or an index',
      maintenanceAction: 'Adjust network and maintenance options',
      automationsTitle: 'Automation templates'
    },

    account: {
      sectionTitle: 'Bangumi account',
      loginStatus: 'Sign-in status',
      verifiedDescription: ({ nickname }: { nickname: string }) => `Account verified: ${nickname}`,
      notLoggedIn: 'Not signed in',
      accessToken: 'Access token',
      tokenSaved: 'Saved',
      tokenMissing: 'Not saved',
      refreshable: 'Refreshable',
      expired: 'Expired',
      expiresAt: 'Credentials valid until',
      actionsTitle: 'Account actions',
      login: 'Sign in to Bangumi',
      verify: 'Verify account',
      refreshCredentials: 'Refresh credentials',
      logout: 'Sign out'
    },

    sync: {
      preferencesTitle: 'Auto sync preferences',
      autoSync: 'Auto sync',
      autoSyncDescription: 'Watches local entry creation and user-state field changes',
      syncItems: 'Sync items',
      itemCreate: 'Create collections',
      itemStatus: 'Entry status',
      itemScore: 'Rating',
      itemEpisodes: 'Episode watch state',
      clearRemoteScore: 'Allow clearing remote ratings',
      clearRemoteScoreDescription:
        'Also clears the Bangumi rating when the local rating is cleared',
      manualTitle: 'Manual sync',
      manualDescription:
        'Sync the change queue now, or configure a one-off full sync. Progress and cancellation are handled by the task center.',
      syncChangedNow: 'Sync changes now',
      fullSync: 'Full sync'
    },

    import: {
      noProfilesWarning:
        'No scraper profile is configured for this media type. Imports can still be previewed, but a usable profile is required before writing locally.',
      sourceTitle: 'Import sources',
      sourceDescription:
        'Imports are one-off tasks; options apply to this run only and are not saved to Bangumi preferences',
      myCollections: 'My collections',
      myCollectionsDescription:
        'Import the current Bangumi user collections of the selected media type by collection type',
      bangumiIndex: 'Bangumi index',
      bangumiIndexDescription: 'Enter an index ID or link, then configure the import',
      indexPlaceholder: 'Index ID or https://bgm.tv/index/..',
      configureImport: 'Configure import'
    },

    automation: {
      title: 'Recommended automations',
      description:
        'Only recommended Bangumi templates are created here; enabling, triggers, and history are managed on the main app automation page',
      create: 'Create'
    },

    maintenance: {
      networkTitle: 'Network and client',
      networkDescription: 'These preferences affect subsequent Bangumi API requests once saved',
      loginTimeout: 'Sign-in timeout',
      minutes: 'minutes',
      rateLimit: 'API rate limit',
      rateLimitDescription: 'Requests / time window',
      seconds: 'seconds',
      apiTimeout: 'API timeout',
      retryCount: 'Retry count',
      retryUnit: 'retries',
      debounce: 'Auto sync debounce',
      notifyErrors: 'Sync error notifications',
      notifyErrorsDescription: 'Sends a main app notification when a sync job fails',
      actionsTitle: 'Maintenance actions',
      actionsDescription: 'These actions take effect immediately and cannot be undone',
      clearSyncState: 'Clear sync state',
      clearSyncStateDescription:
        'Clears sync fingerprints and the change queue; the next sync re-compares all entries',
      resetSettings: 'Restore default settings',
      resetSettingsDescription:
        'Resets Bangumi preferences to their defaults without signing out or deleting automations',
      confirmAction: 'Confirm'
    },

    fullSync: {
      title: 'Full sync',
      syncData: 'Sync data',
      itemStatus: 'Entry status',
      itemScore: 'Rating',
      itemEpisodes: 'Episode watch state',
      updateExisting: 'Update existing collections',
      updateExistingDescription:
        'When off, Bangumi collections are only created for entries missing remotely',
      clearRemoteScore: 'Allow clearing remote ratings',
      batchSize: 'Batch size',
      run: 'Run sync',
      previewTitle: 'Full sync preview',
      previewDescription: 'Confirm the changes about to be synced to Bangumi'
    },

    importCollections: {
      title: 'Import my collections',
      profile: 'Scraper profile',
      profilePlaceholder: 'Select a scraper profile',
      collectionTypes: 'Collection types',
      dataItems: 'Imported user-state fields',
      itemStatus: 'Entry status',
      itemScore: 'Rating',
      itemTags: 'Tags',
      itemUnitProgress: 'Reading progress',
      patchExisting: 'Update existing entries',
      targetCollection: 'Add to collection',
      collectionPlaceholder: 'Select a collection',
      start: 'Start import',
      previewTitle: 'My collections import preview',
      previewDescription: 'Confirm the entries that will be created, updated, or skipped'
    },

    importIndex: {
      title: 'Import index',
      index: 'Index',
      profile: 'Scraper profile',
      profilePlaceholder: 'Select a scraper profile',
      targetCollection: 'Target collection',
      targetNone: 'Do not add to a collection',
      targetExisting: 'Existing collection',
      targetByIndexTitle: 'Create from the index title',
      selectCollection: 'Select collection',
      collectionPlaceholder: 'Select a collection',
      patchExisting: 'Update existing entries',
      start: 'Start import',
      previewTitle: 'Index import preview',
      previewDescription: 'Confirm the entries that will be created, updated, or skipped'
    },

    previewDialog: {
      empty: 'No entries will change'
    }
  }
}
