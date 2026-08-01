/** Scanner: page, items, issues, fix dialog, settings, form, test, and extraction rules. */
export const scanner = {
  title: 'Scanners',
  addScanner: 'Add scanner',
  scanAll: 'Scan all',
  cancelAll: 'Cancel all',
  settingsTooltip: 'Scanner settings',
  emptyTitle: 'No scanners yet',
  emptyDescription: 'Add a scanner to automatically discover and import your media files.',

  table: {
    name: 'Name',
    type: 'Type',
    scraperProfile: 'Scraper profile',
    targetCollection: 'Target collection',
    newExisting: 'New / Existing',
    status: 'Status',
    actions: 'Actions'
  },

  item: {
    statusIdle: 'Idle',
    statusQueued: 'Queued',
    statusScanning: 'Scanning',
    statusPausing: 'Pausing',
    statusPaused: 'Paused',
    statusCancelling: 'Cancelling',
    statusCompleted: 'Completed',
    statusCancelled: 'Cancelled',
    statusFailed: 'Failed',
    pause: 'Pause',
    resume: 'Resume',
    scan: 'Scan',
    cancel: 'Cancel',
    cancelling: 'Cancelling',
    newCount: ({ count }: { count: number }) => `${count} new`,
    existingCount: ({ count }: { count: number }) => `${count} existing`,
    newCountTooltip: 'Games added to the database',
    existingCountTooltip: 'Games whose paths already exist',
    issuesTooltip: ({ count }: { count: number }) => `Issues: ${count}`,
    deleteTitle: 'Delete scanner?',
    deleteDescription: ({ name }: { name: string }) =>
      `Delete the scanner "${name}"? This cannot be undone.`
  },

  issueTypes: {
    assetPersistFailed: 'Asset save failed',
    duplicateExternalId: 'Duplicate external ID',
    metadataMissing: 'Missing metadata',
    pathUnavailable: 'Path unavailable',
    scraperUnavailable: 'Scraper unavailable',
    unexpectedError: 'Unexpected error',
    unsupportedEntry: 'Unsupported entry'
  },

  issues: {
    title: 'Scan issues',
    totalCount: ({ count }: { count: number }) =>
      count === 1 ? '1 issue in total' : `${count} issues in total`,
    searchPlaceholder: 'Search names, paths, reasons…',
    allTypes: 'All types',
    noMatch: 'No matching issues.',
    table: {
      name: 'Name',
      type: 'Type',
      path: 'Path',
      reason: 'Reason',
      relatedGame: 'Related game',
      actions: 'Actions'
    },
    openPath: 'Open path',
    addToExclusion: 'Add to scan exclusion list',
    fixAndRescrape: 'Fix and rescrape',
    alreadyExcluded: 'Already in the exclusion list.',
    addedToExclusion: 'Added to the scan exclusion list.',
    excludeFailed: 'Could not add to the exclusion list'
  },

  fix: {
    title: 'Fix scan result',
    updateExisting: 'Update the existing game',
    readdGame: 'Re-add the game',
    started: 'Rescraping started.',
    startFailed: 'Could not start the fix',
    unknownError: 'Unknown error',
    rescrape: 'Rescrape'
  },

  settings: {
    title: 'Scanner settings',
    saved: 'Settings saved.',
    saveFailed: 'Save failed',
    startAtOpen: 'Scan automatically at startup',
    startAtOpenDescription: 'Run all scanners automatically when the app opens.',
    ingestMode: 'Import mode',
    ingestModeDescription: 'Controls how the scanner imports newly identified games.',
    ingestPreferScraper: 'Prefer scraper',
    ingestPreferScraperDescription:
      'Import via the scraper first; fall back to direct import on failure.',
    ingestRequireScraper: 'Require scraper',
    ingestRequireScraperDescription:
      'Import only via the scraper; record a failure when scraping fails.',
    ingestDirectOnly: 'Direct import only',
    ingestDirectOnlyDescription: 'Skip the scraper and create games from the identified results.',
    parallelCount: 'Parallel processing',
    parallelCountDescription:
      'Number of entries one scanner processes at a time; 1 means serial processing.',
    ignoredNames: 'Ignored names',
    ignoredNamesDescription: 'The scanner skips these extracted entity names.',
    ignoredNamePlaceholder: 'Enter a name to ignore…',
    noIgnoredNames: 'No ignored names yet.'
  },

  form: {
    createTitle: 'Create scanner',
    editTitle: 'Edit scanner',
    requiredFields: 'Fill in the required fields.',
    updated: 'Scanner updated.',
    created: 'Scanner created.',
    updateFailed: 'Update failed. Try again.',
    createFailed: 'Create failed. Try again.',
    openLinkFailed: 'Could not open the link',
    name: 'Name',
    namePlaceholder: 'e.g. My game library',
    type: 'Type',
    scanPath: 'Scan path',
    scanPathPlaceholder: 'Select a folder to scan',
    entityDepth: 'Entity depth',
    entityDepthHelp:
      'The depth of media entities within the directory structure. 0 means direct children of the scan path are entities, 1 means items inside subdirectories are entities, and so on.',
    scraperProfile: 'Scraper profile',
    scraperProfileHelp:
      'The scraper profile used to fetch metadata. The profile decides which fields come from which data sources.',
    targetCollection: 'Target collection',
    scanInterval: 'Auto-scan interval',
    scanIntervalDescription: 'Set 0 to disable automatic scans.',
    minutes: 'minutes',
    nameExtractionRules: 'Name extraction rules',
    nameExtractionRulesHelp:
      'Regular expression rules applied in order to extract game names from folder names. Rules use the named capturing group (?<name>...) to extract the name.',
    nameExtractionRulesLink: 'View named capturing group docs',
    editRules: 'Edit rules',
    notConfigured: 'Not configured',
    ruleCount: ({ count }: { count: number }) => (count === 1 ? '1 rule' : `${count} rules`),
    testConfig: 'Test configuration'
  },

  test: {
    title: 'Scanner configuration test',
    depth: 'Depth',
    rules: 'Rules',
    entities: 'Entities',
    matched: 'Matched',
    noEntitiesFound: 'No entities found at the specified depth.',
    allExcluded: 'All entities are excluded.',
    entityName: 'Entity name',
    extractedName: 'Extracted name',
    rule: 'Rule',
    addToExclusion: 'Add to exclusion list'
  },

  rules: {
    title: 'Name extraction rules',
    empty: 'No rules yet. Use the buttons below to add one.',
    unnamedRule: '(Unnamed rule)',
    addRule: 'Add rule',
    selectPresets: 'Choose presets',
    itemAddTitle: 'Add rule',
    itemEditTitle: 'Edit rule',
    description: 'Description',
    descriptionPlaceholder: 'e.g. Remove bracket prefixes',
    pattern: 'Regular expression',
    patternHintBefore: 'Use the named capturing group',
    patternHintAfter: 'to specify the name to extract.',
    presetsTitle: 'Choose preset rules',
    presetsAllAdded: 'All preset rules have been added.',
    addWithCount: ({ count }: { count: number }) => `Add (${count})`,
    presets: {
      bracketPrefix: { name: 'Bracket prefix [xxx]', description: 'Remove a leading [xxx]' },
      parenPrefix: { name: 'Parenthesis prefix (xxx)', description: 'Remove a leading (xxx)' },
      multiBracketPrefix: {
        name: 'Multiple bracket prefixes',
        description: 'Remove consecutive leading [xxx]'
      },
      bracketSuffix: { name: 'Bracket suffix [xxx]', description: 'Remove a trailing [xxx]' },
      parenSuffix: { name: 'Parenthesis suffix (xxx)', description: 'Remove a trailing (xxx)' },
      versionSuffix: { name: 'Version suffix _vX.X', description: 'Remove _v1.2.3' },
      yearSuffix: { name: 'Year suffix (YYYY)', description: 'Remove (2024)' },
      langSuffix: { name: 'Language suffix', description: 'Remove CHS/CHT/JP/EN and similar' },
      bracketBoth: {
        name: 'Brackets on both sides',
        description: 'Remove a [prefix] and a [suffix]'
      }
    }
  },

  run: {
    title: ({ name }: { name: string }) => `Scan ${name}`,
    preparing: 'Preparing to scan',
    discovering: 'Scanning directories',
    processing: 'Processing scan results',
    finished: 'Scan finished',
    resultCompleted: 'Scan completed',
    resultCancelled: 'Scan cancelled',
    resultFailed: 'Scan failed',
    resultSummary: ({
      status,
      processed,
      total,
      added,
      existing,
      failed,
      issues
    }: {
      status: string
      processed: number
      total: number
      added: number
      existing: number
      failed: number
      issues: number
    }) =>
      `${status}: processed ${processed}/${total}, added ${added}, existing ${existing}, failed ${failed}, issues ${issues}`,
    reasons: {
      scrapeUnavailableRequired:
        'The scrape configuration is unavailable and this mode requires scraping. Not added.',
      noMetadataRequired:
        'No usable metadata was found and this mode requires scraping. Not added.',
      scrapeFailedRequired: 'Scraping failed and this mode requires scraping. Not added.',
      scrapeUnavailableFallback:
        'The scrape configuration is unavailable. Added directly using the folder name.',
      noMetadataFallback: 'No usable metadata was found. Added directly using the folder name.',
      scrapeFailedFallback: 'Scraping failed. Added directly using the folder name.',
      pathInaccessible: ({ message }: { message: string }) =>
        `The path is inaccessible. Not added: ${message}`,
      notScannableDirectory: 'The path is not a scannable directory. Not added.',
      externalIdLinked:
        'The external ID is already linked to an existing game. This path was not added.'
    }
  }
}
