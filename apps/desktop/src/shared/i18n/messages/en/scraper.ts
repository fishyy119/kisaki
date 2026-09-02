/** Shared scraper widgets: provider select, profile select, and recipe creation. */
export const scraper = {
  providerSelect: {
    placeholder: 'Select a provider…',
    empty: 'No providers available',
    unavailable: 'Unavailable',
    unsupported: 'Not supported'
  },
  profileSelect: {
    placeholder: 'Select a scraper profile',
    empty: 'No profiles',
    none: 'No scraper profile'
  },
  recipes: {
    gameVisualNovel: {
      name: 'Visual novels',
      description: 'VNDB leads the catalogue; localized facts and artwork fill in around it'
    },
    gameVideoGame: {
      name: 'Video games',
      description: 'Broad game metadata with SteamGridDB leading every artwork slot'
    },
    anime: {
      name: 'Anime',
      description: 'Season-shaped anime entries with episodes, cast, and full artwork'
    },
    comic: {
      name: 'Comics',
      description: 'Manga metadata with per-volume covers from MangaDex'
    },
    novelLightNovel: {
      name: 'Light novels',
      description: 'Light-novel metadata with volumes, cast, and covers'
    },
    novelFiction: {
      name: 'Fiction & books',
      description: 'General bibliography with cross-source identifiers and ISBN alignment'
    },
    person: {
      name: 'People',
      description: 'Staff, authors, and voice actors with portraits'
    },
    company: {
      name: 'Companies',
      description: 'Studios, publishers, and brands with logos'
    },
    character: {
      name: 'Characters',
      description: 'Character profiles with portraits and cast credits'
    }
  },
  newProfile: {
    pathTitle: 'Create a profile',
    confirmTitle: 'Confirm the new profile',
    paths: {
      recipes: 'Recommended',
      provider: 'Single provider',
      blank: 'Blank'
    },
    recipesHint: 'Curated scenes; providers and ordering follow the chosen content language',
    blankHint: 'Choose the search provider; every slot starts empty',
    providerMissing: 'not installed',
    recipeUnavailable: 'No search source of this scene is currently available',
    noRecipes: 'No recommended scenes for this media type',
    previewTitle: 'Generated slots',
    previewEmpty: 'No slots can be filled with the current providers'
  },
  recipeUpdate: {
    badge: 'Update suggested',
    title: 'Recommended configuration changed',
    hint: 'The current recommendation for this scene differs from the profile configuration. Applying overwrites the search source and slots.',
    beforeLabel: 'Current',
    afterLabel: 'Suggested',
    apply: 'Apply suggestion',
    dismiss: 'Ignore this suggestion',
    emptySlot: '(empty)'
  },

  profiles: {
    manageTitle: 'Manage scraper profiles',
    emptyProfiles: 'No profiles yet. Use the button below to add one.',
    unnamed: '(Unnamed)',
    addProfile: 'Add profile',
    profileEntityLabel: 'Profile',
    deleteUsedByScanners: ({ count }: { count: number }) =>
      count === 1
        ? '1 scanner uses this profile; after deletion it will import directly without scraping.'
        : `${count} scanners use this profile; after deletion they will import directly without scraping.`,
    newTitleEntityType: 'Choose an entity type',
    newTitleProvider: 'Choose the primary provider',
    newEntityTypeHint: 'Choose the entity type for the new profile',
    newProviderHint: 'Choose a primary data provider as the base of the default profile',
    noProvidersAvailable: 'No providers available',
    itemTitleAdd: 'Add profile',
    itemTitleEdit: 'Edit profile',
    nameLabel: 'Profile name',
    namePlaceholder: 'For example: Visual novels',
    copyId: 'Copy profile ID',
    entityTypeLabel: 'Entity type',
    selectEntityType: 'Select an entity type',
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
