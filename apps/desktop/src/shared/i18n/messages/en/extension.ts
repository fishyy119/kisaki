type ReleaseActionKind = 'install' | 'update' | 'reinstall' | 'downgrade'

const RELEASE_ACTIONS: Record<ReleaseActionKind, string> = {
  install: 'Install',
  update: 'Update',
  reinstall: 'Reinstall',
  downgrade: 'Downgrade'
}

const RELEASE_ACTION_NOUNS: Record<ReleaseActionKind, string> = {
  install: 'installation',
  update: 'update',
  reinstall: 'reinstallation',
  downgrade: 'downgrade'
}

const RELEASE_ACTION_PAST: Record<ReleaseActionKind, string> = {
  install: 'Installed',
  update: 'Updated',
  reinstall: 'Reinstalled',
  downgrade: 'Downgraded'
}

/** Extension platform surfaces: manager pages, panels, dialogs, and webviews. */
export const extension = {
  title: 'Extensions',
  webviewPageClosed: 'This extension page has been closed.',

  categories: {
    scraper: 'Metadata',
    tool: 'Tools',
    theme: 'Themes',
    integration: 'Integrations',
    uncategorized: 'Uncategorized',
    joinSeparator: ', '
  },

  nav: {
    discover: 'Discover',
    installed: 'Installed',
    repositories: 'Repositories',
    signers: 'Signers'
  },

  header: {
    reloadPending: ({ count }: { count: number }) =>
      `Extension code updated (${count}); reload the host process to apply.`,
    reloadHost: 'Reload the extension host process',
    reloadProcess: 'Reload process',
    install: 'Install extension'
  },

  host: {
    reloading: 'Reloading the extension host…',
    reloaded: 'Extension host reloaded.',
    reloadFailed: 'Could not reload the extension host',
    codeUpdatedTitle: 'Extension code updated',
    pendingChanges: ({ subject }: { subject: string }) => `${subject} has unapplied changes`,
    subjectSingle: ({ id }: { id: string }) => `Extension ${id}`,
    subjectMultiple: ({ count }: { count: number }) => `${count} extensions`
  },

  entityMenu: {
    loading: 'Loading extension menus…',
    loadFailed: 'Could not load extension menus',
    partiallyUnavailable: 'Some extension menus are unavailable',
    actionFailed: 'Extension menu action failed'
  },

  actions: {
    install: 'Install',
    update: 'Update',
    reinstall: 'Reinstall',
    downgrade: 'Downgrade',
    apply: 'Apply'
  },

  release: {
    actionTitle: ({ action }: { action: string }) => `${action} extension`,
    prepareTitle: 'Prepare extension release',
    importLocalTitle: 'Import local extension',
    repositoryDescription: 'Review the version, repository source, and signature to continue.',
    localDescription: 'Pick a local .kisx file and confirm.',
    confirmAction: ({ action }: { action: string }) => `Confirm ${action.toLowerCase()}`,
    selectFile: 'Select file',
    planFailed: 'Could not create the release plan',
    filePickerTitle: 'Select extension file',
    filePickerFilterName: 'Extension package',
    cancelled: 'The operation was cancelled.',
    applied: ({ action }: { action: string }) => `Extension ${action.toLowerCase()} succeeded.`,
    applyFailed: 'Operation failed',
    signerTrusted: 'Signature trusted',
    signerUntrusted: 'Signature not trusted',
    signerChanged: 'Signature changed',
    signerUnsigned: 'Unsigned',
    kindStable: 'Stable',
    kindPreview: 'Preview',
    unknownSize: 'Unknown size',
    repositoryLine: ({ name }: { name: string }) => `Repository: ${name}`,
    localFileLine: ({ size }: { size: string }) => `Local file · ${size}`,
    currentVersion: 'Current version',
    notInstalled: 'Not installed',
    releaseKind: 'Release kind',
    signerFingerprint: 'Signature fingerprint',
    artifactSize: 'Package size',
    changelog: 'Changelog',
    viewChangelog: 'View',
    needsConfirmation: 'Needs confirmation',
    enableAfterApply: 'Enable after applying',
    updatePolicy: 'Update policy',
    trustSigner: 'Trust this extension signature fingerprint',
    pickLocalHint: 'Pick a local extension package (.kisx).'
  },

  policy: {
    manual: 'Manual',
    auto: 'Automatic',
    pinned: 'Pinned'
  },

  installer: {
    releaseTitle: ({ action, name }: { action: ReleaseActionKind; name: string }) =>
      `${RELEASE_ACTIONS[action]} extension ${name}`,
    localTitle: 'Apply local extension package',
    completedTitle: ({ action }: { action: ReleaseActionKind }) =>
      `Extension ${RELEASE_ACTION_NOUNS[action]} completed`,
    completedSummary: ({
      action,
      name,
      version
    }: {
      action: ReleaseActionKind
      name: string
      version: string
    }) => `${RELEASE_ACTION_PAST[action]} ${name} v${version}.`,
    cancelledSummary: ({ action }: { action: ReleaseActionKind }) =>
      `The extension ${RELEASE_ACTION_NOUNS[action]} was cancelled.`,
    localCancelledSummary: 'Applying the extension package was cancelled.',
    phases: {
      waitLock: 'Waiting for the extension package write lock',
      prepare: 'Preparing the extension package',
      verify: 'Verifying the extension package',
      extract: 'Extracting the extension package',
      commit: 'Committing the extension installation state'
    }
  },

  repositoryRefresh: {
    refreshOneTitle: ({ name }: { name: string }) => `Refresh repository ${name}`,
    refreshAllTitle: 'Refresh all extension repositories',
    allSubjectLabel: 'All extension repositories',
    cancelledSummary: 'The extension repository refresh was cancelled.',
    preparing: 'Preparing to refresh extension repositories',
    noneEnabled: 'No enabled extension repositories',
    refreshingOne: ({ name }: { name: string }) => `Refreshing ${name}`,
    refreshedOne: ({ name }: { name: string }) => `Refreshed ${name}`,
    oneFailedTitle: 'Repository refresh failed',
    oneFailedSummary: ({ name }: { name: string }) => `${name} could not be refreshed.`,
    oneNotModifiedTitle: 'Repository unchanged',
    oneCompletedTitle: 'Repository refresh completed',
    oneNotModifiedSummary: ({ name }: { name: string }) => `${name} is already up to date.`,
    oneRefreshedSummary: ({ name }: { name: string }) => `${name} has been refreshed.`,
    allFailedTitle: 'Extension repository refresh failed',
    allPartialTitle: 'Some extension repositories failed to refresh',
    allCompletedTitle: 'Extension repository refresh completed',
    noneEnabledSummary: 'There are no enabled extension repositories.',
    allSummary: ({
      processed,
      total,
      succeeded,
      notModified,
      failed
    }: {
      processed: number
      total: number
      succeeded: number
      notModified: number
      failed: number
    }) =>
      `Processed ${processed}/${total} repositories: succeeded ${succeeded}, unchanged ${notModified}, failed ${failed}.`
  },

  updatePolicyDialog: {
    title: 'Update settings',
    policyLabel: 'Update policy',
    receivePrerelease: 'Receive preview updates',
    saved: 'Update settings saved.',
    saveFailed: 'Could not save the update settings'
  },

  uninstall: {
    title: ({ name }: { name: string }) => `Uninstall ${name}?`,
    purgeData: 'Also delete extension data',
    confirmPurge: 'Uninstall and delete',
    confirm: 'Uninstall',
    uninstalledPurged: 'Extension uninstalled and its data deleted.',
    uninstalled: 'Extension uninstalled.',
    purgeFailed: 'Extension uninstalled, but deleting its data failed',
    failed: 'Uninstall failed'
  },

  discover: {
    emptyTitle: 'No extensions found',
    emptyCategoryDescription: 'No extensions available in this category.',
    emptyDescription: 'No extensions available.',
    loadMore: 'Load more',
    sortRelevance: 'Relevance',
    sortName: 'Name',
    sortPublishedAt: 'Published',
    sortUpdatedAt: 'Updated',
    sortRepositoryPriority: 'Repository',
    searchPlaceholder: 'Search extension names or descriptions…',
    allRepositories: 'All repositories',
    compatibleOnly: 'Show compatible versions only',
    allCompatibility: 'Show all compatibility states',
    ascending: 'Ascending',
    descending: 'Descending',
    allCategories: 'All',
    unknownAuthor: 'Unknown author',
    sourceCount: ({ count }: { count: number }) => (count === 1 ? '1 source' : `${count} sources`),
    noVersion: 'No versions',
    noDescription: 'No description.',
    homepage: 'Homepage',
    details: 'Details',
    installed: 'Installed',
    install: 'Install',
    unknownTime: 'Unknown time',
    unknownSize: 'Unknown size',
    extensionId: 'Extension ID',
    author: 'Author',
    latestPublish: 'Latest release',
    codeRepository: 'Code repository',
    versions: 'Versions',
    latestBadge: 'Latest',
    previewBadge: 'Preview',
    yankedBadge: 'Yanked',
    apiIncompatibleBadge: 'API incompatible',
    noArtifactBadge: 'No package available',
    unsignedBadge: 'Unsigned',
    sourcesLine: ({ value }: { value: string }) => `Sources: ${value}`,
    publishedLine: ({ value }: { value: string }) => `Published: ${value}`,
    apiLine: ({ value }: { value: string }) => `Extension API: ${value}`,
    sizeLine: ({ value }: { value: string }) => `Package size: ${value}`
  },

  installed: {
    filterAll: 'All',
    filterEnabled: 'Enabled',
    filterDisabled: 'Disabled',
    sortName: 'Name',
    sortStatus: 'Status',
    sortHasUpdate: 'Updates',
    startupUpdating: 'Updating at startup',
    repositoryRefreshFailed: 'Repository refresh failed',
    autoUpdateFailedCount: ({ count }: { count: number }) =>
      count === 1 ? '1 automatic update failed' : `${count} automatic updates failed`,
    searchPlaceholder: 'Search installed extensions…',
    checkUpdates: 'Check for updates',
    showAll: 'Show all',
    showUpdatesOnly: 'Show updates only',
    ascending: 'Ascending',
    descending: 'Descending',
    updatesAvailable: 'Updates available',
    updatesAvailableCount: ({ count }: { count: number }) =>
      count === 1 ? '1 extension can be updated' : `${count} extensions can be updated`,
    noUpdates: 'No updates available.',
    checkUpdatesFailed: 'Could not check for updates',
    emptyTitle: 'No installed extensions',
    emptyDescription: 'Install extensions from the Discover page.',
    noMatchTitle: 'No matching extensions',
    noMatchDescription: 'Try adjusting the filters.',

    unknownVersion: 'Unknown version',
    statusReady: 'Healthy',
    statusInvalid: 'Invalid package',
    statusMissingPackage: 'Missing package',
    runtimeLoading: 'Loading',
    runtimeRunning: 'Running',
    runtimeFailed: 'Load failed',
    runtimeStopped: 'Not running',
    builtinManaged: 'Built-in extensions are managed by Kisaki.',
    enableFailed: 'Could not enable the extension',
    packageNotRunnable: 'The extension package cannot run right now.',
    enabledFeedback: 'Extension enabled.',
    disabledFeedback: 'Extension disabled.',
    operationFailed: 'Operation failed',
    extensionOperationFailed: 'Extension operation failed',
    builtinBadge: 'Built-in',
    updateBadge: 'Update',
    unknownAuthor: 'Unknown',
    noDescription: 'No description.',
    enableWithApp: 'Enable with the app',
    enabledState: 'Enabled',
    disabledState: 'Disabled',
    update: 'Update',
    detailsTooltip: 'Details',
    updatePolicyTooltip: 'Update settings',
    uninstallTooltip: 'Uninstall',

    details: {
      basicInfo: 'Basic info',
      extensionId: 'Extension ID',
      version: 'Version',
      author: 'Author',
      unknownAuthor: 'Unknown author',
      category: 'Categories',
      installedAt: 'Installed',
      homepage: 'Homepage',
      status: 'Status',
      enabledStatus: 'Enabled state',
      enabled: 'Enabled',
      disabled: 'Disabled',
      packageStatus: 'Package status',
      runtimeStatus: 'Runtime status',
      runtimeError: 'Runtime error',
      installationSource: 'Installation source',
      sourceType: 'Type',
      sourceBuiltin: 'Built-in extension',
      sourceRepository: 'Repository install',
      sourceLocalFile: 'Local file',
      sourceUnknown: 'Unknown source',
      repository: 'Repository',
      repositoryUrl: 'Repository URL',
      releaseDigest: 'Release digest',
      manifestDigest: 'Manifest digest',
      artifactSha256: 'Package SHA256',
      signerFingerprint: 'Signature fingerprint',
      releaseVersion: 'Release version',
      publishedAt: 'Published',
      extensionApi: 'Extension API',
      file: 'File',
      installDir: 'Install folder',
      updateConfig: 'Update settings',
      updatePolicy: 'Update policy',
      pinnedVersion: 'Pinned version',
      receivePrerelease: 'Receive preview updates',
      packageIssues: 'Package issues',
      runtimeDiagnostics: 'Runtime diagnostics',
      unknownTime: 'Unknown time',
      severityInfo: 'Info',
      severityWarning: 'Warning',
      severityError: 'Error'
    }
  },

  repository: {
    none: 'None',
    stateEnabled: 'Enabled',
    stateDisabled: 'Disabled',
    healthDisabled: 'Disabled',
    healthError: 'Error',
    healthNeverRefreshed: 'Never refreshed',
    healthOk: 'Healthy',
    added: 'Repository added.',
    addFailed: 'Could not add the repository',
    officialAdded: 'Official repository added.',
    officialAddFailed: 'Could not add the official repository',
    refreshAllStarted: 'Started refreshing extension repositories.',
    refreshFailed: 'Could not refresh the repository',
    refreshStarted: 'Started refreshing the repository.',
    enabledFeedback: 'Repository enabled.',
    disabledFeedback: 'Repository disabled.',
    deleted: 'Repository deleted.',
    operationFailed: 'Repository operation failed',
    panelTitle: 'Extension repositories',
    panelSummary: ({ count }: { count: number }) =>
      count === 1
        ? '1 repository; discovery catalogs merge by priority'
        : `${count} repositories; discovery catalogs merge by priority`,
    refreshAll: 'Refresh all',
    addOfficial: 'Add official repository',
    add: 'Add repository',
    emptyTitle: 'No extension repositories',
    priorityLine: ({ value }: { value: string }) => `Priority: ${value}`,
    packageCountLine: ({ count }: { count: number }) => `Packages: ${count}`,
    manifestUpdatedLine: ({ value }: { value: string }) => `Manifest updated: ${value}`,
    lastCheckedLine: ({ value }: { value: string }) => `Last checked: ${value}`,
    detailsTooltip: 'Details',

    addDialog: {
      title: 'Add extension repository',
      manifestUrl: 'Repository manifest URL',
      displayName: 'Display name',
      displayNamePlaceholder: 'Leave empty to use the manifest name'
    },

    removeDialog: {
      title: ({ name }: { name: string }) => `Delete ${name}?`,
      description:
        'Delete this repository? Kisaki will stop fetching its extension catalog; installed extensions stay installed.',
      deleting: 'Deleting…'
    },

    details: {
      basicInfo: 'Basic info',
      repositoryId: 'Repository ID',
      priority: 'Priority',
      packages: 'Packages',
      localState: 'Local state',
      manifestUrl: 'Repository manifest URL',
      manifestMetadata: 'Manifest metadata',
      manifestDigest: 'Manifest digest',
      manifestUpdatedAt: 'Manifest updated',
      refreshState: 'Refresh state',
      lastChecked: 'Last checked',
      lastSuccess: 'Last success',
      lastError: 'Last error',
      localRecord: 'Local record',
      createdAt: 'Created',
      updatedAt: 'Updated'
    }
  },

  signer: {
    none: 'None',
    localConfirmation: 'Local confirmation',
    revoked: 'Signature trust revoked.',
    revokeFailed: 'Could not revoke the signature trust',
    panelTitle: 'Signature trust',
    panelSummary: ({ count }: { count: number }) =>
      count === 1
        ? '1 extension-level signature fingerprint'
        : `${count} extension-level signature fingerprints`,
    emptyTitle: 'No trusted signature fingerprints',
    sourceLine: ({ value }: { value: string }) => `Source: ${value}`,
    trustedAtLine: ({ value }: { value: string }) => `Trusted: ${value}`,
    viewDetails: 'View details',
    revokeTrust: 'Revoke trust',

    removeDialog: {
      title: 'Revoke signature trust?',
      description: ({ id }: { id: string }) =>
        `Revoke the signature trust for "${id}"? New releases using this fingerprint will require confirmation again.`,
      revoking: 'Revoking…',
      revoke: 'Revoke'
    },

    details: {
      title: 'Signature details',
      extensionId: 'Extension ID',
      algorithm: 'Algorithm',
      keyId: 'Key ID',
      fingerprint: 'Signature fingerprint',
      publicKey: 'Public key',
      trustRecordId: 'Trust record ID',
      sourceRepositoryId: 'Source repository ID',
      sourceRepositoryUrl: 'Source repository URL',
      trustedAt: 'Trusted',
      createdAt: 'Created'
    }
  }
}
