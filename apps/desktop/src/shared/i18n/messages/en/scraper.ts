/** Shared scraper widgets: provider select, profile select, and preset picker. */
export const scraper = {
  providerSelect: {
    placeholder: 'Select a provider…',
    empty: 'No providers available',
    unavailable: 'Unavailable',
    unsupported: 'Not supported'
  },
  profileSelect: {
    placeholder: 'Select a scraper profile',
    empty: 'No profiles'
  },
  presetDialog: {
    title: 'Choose preset profiles',
    empty: 'No presets available',
    searchProvider: ({ id }: { id: string }) => `Search: ${id}`,
    addWithCount: ({ count }: { count: number }) => `Add (${count})`
  },
  presets: {
    visualNovel: {
      name: 'Visual novels',
      description: 'Best for Chinese metadata of visual novels'
    },
    videoGame: {
      name: 'Video games',
      description: 'A general-purpose preset for video games'
    },
    anime: {
      name: 'Anime',
      description: 'Bangumi metadata, with TMDB artwork filling the gaps (TMDB needs an API key)'
    }
  },

  profiles: {
    manageTitle: 'Manage scraper profiles',
    emptyProfiles: 'No profiles yet. Use the button below to add one.',
    unnamed: '(Unnamed)',
    addProfile: 'Add profile',
    choosePreset: 'Choose preset',
    profileEntityLabel: 'Profile',
    newTitleMediaType: 'Choose a media type',
    newTitleProvider: 'Choose the primary provider',
    newMediaTypeHint: 'Choose the media type for the new profile',
    newProviderHint: 'Choose a primary data provider as the base of the default profile',
    noProvidersAvailable: 'No providers available',
    itemTitleAdd: 'Add profile',
    itemTitleEdit: 'Edit profile',
    nameLabel: 'Profile name',
    namePlaceholder: 'For example: Visual novels',
    idLabel: 'Profile ID',
    copyIdTooltip: 'Copy profile ID',
    idCopied: 'Profile ID copied',
    mediaTypeLabel: 'Media type',
    selectMediaType: 'Select a media type',
    searchProviderLabel: 'Search provider',
    defaultLanguageLabel: 'Default language',
    defaultLanguageHint:
      'Used for entity resolution and any fetch without its own language. Slot providers can override the fetch language but not entity resolution. When unset, the system language is used.',
    slotsLabel: 'Slot configuration',
    slotsHint: 'Click a slot to configure its data sources and result strategy',
    providerCount: ({ count }: { count: number }) =>
      count === 1 ? '1 provider' : `${count} providers`,
    slots: {
      info: 'Basic info',
      tags: 'Tags',
      seasons: 'Seasons',
      episodes: 'Episodes',
      chapters: 'Units',
      volumes: 'Volumes',
      characters: 'Characters',
      persons: 'People',
      companies: 'Companies',
      relatedEntries: 'Related entries',
      covers: 'Covers',
      backdrops: 'Backdrops',
      logos: 'Logos',
      icons: 'Icons',
      photos: 'Photos'
    },
    slotDialogTitle: ({ name }: { name: string }) => `Configure: ${name}`,
    strategyLabel: 'Strategy',
    strategyHint: 'How results are combined when multiple providers return data',
    selectStrategy: 'Select a strategy',
    strategyFirst: 'First',
    strategyEnrich: 'Enrich',
    strategyFirstHint: 'Uses the first valid result and ignores later sources',
    strategyEnrichHint: 'Uses the first result as the base and fills in missing fields',
    unmatchedLabel: 'Unmatched entities',
    unmatchedHint: 'Whether unmatched entities from later sources are appended',
    selectUnmatched: 'Select an unmatched-entity strategy',
    unmatchedIgnore: 'Ignore unmatched',
    unmatchedAppend: 'Append unmatched',
    unmatchedIgnoreHint: 'Only enriches matched entities; new unmatched entities are dropped',
    unmatchedAppendHint: 'Appends unmatched entities so later sources can enrich them',
    providersLabel: 'Data providers',
    providersHint: 'Choose the sources for this slot and adjust their priority',
    noProviders: 'No providers',
    languageLabel: 'Language:',
    languageDefaultPlaceholder: 'Default',
    addProviderPlaceholder: 'Add provider…'
  }
}
