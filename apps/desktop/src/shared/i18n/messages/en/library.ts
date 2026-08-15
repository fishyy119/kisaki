/**
 * Library entity domain: shared copy for the seven entity types
 * (game/anime/character/person/company/collection/tag) across menus, searchers,
 * selects, detail views, and form dialogs.
 */
export const library = {
  entities: {
    game: 'Game',
    anime: 'Anime',
    character: 'Character',
    person: 'Person',
    company: 'Company',
    collection: 'Collection',
    tag: 'Tag'
  },

  fields: {
    name: 'Name',
    sortName: 'Sort name',
    originalName: 'Original name',
    description: 'Description',
    score: 'Score',
    myScore: 'My score',
    gender: 'Gender',
    age: 'Age',
    birthDate: 'Birth date',
    deathDate: 'Death date',
    foundedDate: 'Founded',
    releaseDate: 'Release date',
    addedDate: 'Date added',
    bloodType: 'Blood type',
    height: 'Height',
    weight: 'Weight',
    bust: 'Bust',
    waist: 'Waist',
    hips: 'Hips',
    cup: 'Cup size',
    measurements: 'Measurements',
    tags: 'Tags',
    collections: 'Collections',
    relatedGames: 'Related games',
    relatedPersons: 'Related people',
    relatedCharacters: 'Related characters',
    relatedCompanies: 'Related companies',
    characterPersons: 'People per character',
    externalSites: 'External links',
    externalIds: 'External IDs',
    photos: 'Photos',
    covers: 'Covers',
    backdrops: 'Backdrops',
    logos: 'Logos',
    icons: 'Icons',
    note: 'Note',
    role: 'Role',
    type: 'Type',
    status: 'Status',
    playDuration: 'Play time',
    lastActiveAt: 'Last played',
    order: 'Order',
    format: 'Format',
    totalEpisodes: 'Episode count',
    episodes: 'Episodes',
    extras: 'Extras',
    watchDuration: 'Watch time',
    lastWatchedAt: 'Last watched',
    relatedAnimes: 'Related anime',
    relatedEntries: 'Related entries'
  },

  gameStatus: {
    notStarted: 'Not started',
    inProgress: 'In progress',
    partial: 'Partially completed',
    completed: 'Completed',
    multiple: 'Multiple playthroughs',
    shelved: 'Shelved'
  },

  animeStatus: {
    planned: 'Plan to watch',
    watching: 'Watching',
    completed: 'Completed',
    onHold: 'On hold',
    dropped: 'Dropped'
  },

  gender: {
    male: 'Male',
    female: 'Female',
    other: 'Other'
  },

  bloodType: {
    a: 'A',
    b: 'B',
    o: 'O',
    ab: 'AB'
  },

  roles: {
    gamePerson: {
      director: 'Director',
      scenario: 'Scenario',
      illustration: 'Illustration',
      music: 'Music',
      programmer: 'Programming',
      actor: 'Voice actor',
      other: 'Other'
    },
    characterPerson: {
      actor: 'Voice actor',
      illustration: 'Illustration',
      designer: 'Design',
      other: 'Other'
    },
    gameCharacter: {
      main: 'Main',
      supporting: 'Supporting',
      cameo: 'Cameo',
      other: 'Other'
    },
    gameCompany: {
      developer: 'Developer',
      publisher: 'Publisher',
      distributor: 'Distributor',
      other: 'Other'
    },
    animePerson: {
      originalCreator: 'Original creator',
      director: 'Director',
      seriesComposition: 'Series composition',
      scenario: 'Scenario',
      episodeDirector: 'Episode director',
      characterDesign: 'Character design',
      animationDirector: 'Animation director',
      animation: 'Key animation',
      art: 'Art',
      photography: 'Photography',
      sound: 'Sound',
      music: 'Music',
      producer: 'Producer',
      actor: 'Voice actor',
      other: 'Other'
    },
    animeCharacter: {
      main: 'Main',
      supporting: 'Supporting',
      cameo: 'Cameo',
      other: 'Other'
    },
    animeCompany: {
      studio: 'Studio',
      producer: 'Producer',
      distributor: 'Distributor',
      other: 'Other'
    }
  },

  animeFormat: {
    tv: 'TV',
    movie: 'Movie',
    ova: 'OVA',
    ona: 'ONA',
    special: 'Special',
    other: 'Other'
  },

  animeEpisodeType: {
    regular: 'Episode',
    special: 'Special'
  },

  mediaRelation: {
    sequel: 'Sequel',
    prequel: 'Prequel',
    sideStory: 'Side story',
    parentStory: 'Parent story',
    summary: 'Summary',
    fullStory: 'Full story',
    adaptation: 'Adaptation',
    sourceMaterial: 'Source material',
    alternative: 'Alternative version',
    other: 'Other'
  },

  animeExtraType: {
    trailer: 'Trailer',
    pv: 'PV',
    ncop: 'Creditless opening',
    nced: 'Creditless ending',
    interview: 'Interview',
    other: 'Other'
  },

  counts: {
    game: ({ count }: { count: number }) => (count === 1 ? '1 game' : `${count} games`),
    anime: ({ count }: { count: number }) => (count === 1 ? '1 anime' : `${count} anime`),
    character: ({ count }: { count: number }) =>
      count === 1 ? '1 character' : `${count} characters`,
    person: ({ count }: { count: number }) => (count === 1 ? '1 person' : `${count} people`),
    company: ({ count }: { count: number }) => (count === 1 ? '1 company' : `${count} companies`),
    collection: ({ count }: { count: number }) =>
      count === 1 ? '1 collection' : `${count} collections`,
    tag: ({ count }: { count: number }) => (count === 1 ? '1 tag' : `${count} tags`)
  },

  spoiler: {
    maskedName: 'Spoiler content',
    maskedNote: 'Hidden. Turn on "Show spoilers" to view.'
  },

  menu: {
    addToCollection: 'Add to collection',
    removeFromCollection: 'Remove from collection',
    noCollections: 'No collections available',
    newCollection: 'New collection…',
    playStatus: 'Play status',
    editScore: 'Edit score',
    favorite: 'Favorite',
    setFavorite: 'Set favorite',
    unsetFavorite: 'Remove favorite',
    openGameDir: 'Open game folder',
    launchConfig: 'Launch settings',
    media: 'Manage media',
    updateMetadata: 'Update metadata',
    manageExternalIds: 'Manage external IDs',
    mergeDuplicates: 'Merge duplicates',
    editInfo: 'Edit info',
    editContent: 'Edit contents',
    editFilter: 'Edit filters',
    convertToStatic: 'Convert to static',
    batchUpdateMetadata: 'Update metadata in bulk',
    batchDelete: 'Delete selected'
  },

  feedback: {
    addedToCollection: 'Added to collection.',
    addFailed: 'Add failed.',
    removedFromCollection: 'Removed from collection.',
    removeFailed: 'Remove failed.',
    statusUpdated: 'Status updated.',
    updateFailed: 'Update failed.',
    createFailed: 'Create failed.',
    favoriteAdded: 'Added to favorites.',
    favoriteRemoved: 'Removed from favorites.',
    nsfwMarked: 'Marked as NSFW.',
    nsfwCleared: 'NSFW mark removed.',
    saveFailedRetry: 'Save failed. Try again.',
    deleteFailedWithReason: ({ message }: { message: string }) => `Delete failed: ${message}`,
    searchFailed: 'Search failed',
    unknownError: 'Unknown error',
    gameDirNotSet: 'Game folder is not set.',
    openGameDirFailed: 'Could not open the game folder.',
    pickFileFailed: 'Could not pick a file.',
    deletedSummary: ({ items }: { items: string[] }) =>
      items.length > 0 ? `Deleted ${items.join(', ')}.` : 'Deleted.',
    nameAndMore: ({ name, count }: { name: string; count: number }) =>
      `${name} and ${count - 1} more`
  },

  select: {
    searchPlaceholder: ({ label }: { label: string }) => `Search ${label.toLowerCase()}…`,
    selectPlaceholder: ({ label }: { label: string }) => `Select ${label.toLowerCase()}…`
  },

  searcher: {
    scraperProfile: 'Scraper profile',
    searchLabel: ({ label }: { label: string }) => `Search ${label.toLowerCase()}`,
    namePlaceholder: ({ label }: { label: string }) => `Enter ${label.toLowerCase()} name…`,
    columnName: 'Name',
    columnOriginalName: 'Original name',
    columnBirth: 'Born',
    columnDeath: 'Died',
    columnFounded: 'Founded',
    columnReleaseDate: 'Release date',
    startHint: ({ label }: { label: string }) =>
      `Enter a ${label.toLowerCase()} name to start searching`,
    noMatchTitle: 'No matches',
    noMatchDescription: 'Try different keywords.',
    resultCount: ({ count }: { count: number }) => (count === 1 ? '1 result' : `${count} results`),
    selectedOne: '1 selected',
    idLabel: ({ label }: { label: string }) => `${label} ID`,
    idDescription: 'Pick from the results or enter an ID directly.',
    idPlaceholder: 'Pick above or enter directly…'
  },

  detail: {
    notFoundTitle: ({ label }: { label: string }) => `${label} not found`,
    notFoundDescription: ({ label }: { label: string }) =>
      `This ${label.toLowerCase()} may have been deleted.`,
    tabs: {
      overview: 'Overview',
      characters: 'Characters',
      persons: 'People',
      companies: 'Companies',
      relatedGames: 'Related games',
      relatedAnimes: 'Related anime',
      relatedPersons: 'Related people',
      relatedCharacters: 'Related characters',
      activity: 'Activity',
      saves: 'Saves',
      notes: 'Notes'
    },
    tooltips: {
      score: 'Score',
      favoriteAdd: 'Add to favorites',
      favoriteRemove: 'Remove from favorites',
      spoilerShow: 'Show spoilers',
      spoilerHide: 'Hide spoilers',
      openDir: 'Open folder'
    },
    sections: {
      description: 'Description',
      tags: 'Tags',
      externalSites: 'External links',
      details: 'Details'
    },
    empty: {
      description: 'No description yet.',
      tags: 'No tags yet.',
      externalSites: 'No external links yet.',
      relatedGames: 'No related games yet.',
      relatedAnimes: 'No related anime yet.',
      relatedPersons: 'No related people yet.',
      relatedCharacters: 'No related characters yet.',
      relatedEntries: 'No related entries yet.',
      characters: 'No characters yet.',
      persons: 'No people yet.',
      companies: 'No companies yet.'
    },
    manage: 'Manage',
    viewAll: ({ count }: { count: number }) => `View all (${count})`,
    ageValue: ({ age }: { age: number }) => `${age} years`,
    addEntity: ({ label }: { label: string }) => `Add ${label.toLowerCase()}`,
    collectionEmptyTitle: ({ label }: { label: string }) =>
      `No ${label.toLowerCase()}s in this collection`,
    collectionEmptyDescription: ({ label }: { label: string }) =>
      `Add ${label.toLowerCase()}s to this collection with the scanner.`,
    tagEmptyTitle: ({ label }: { label: string }) => `No ${label.toLowerCase()}s with this tag`,
    tagEmptyDescription: ({ label }: { label: string }) =>
      `No ${label.toLowerCase()} uses this tag yet.`
  },

  notes: {
    title: 'Notes',
    newNote: 'New note',
    editNote: 'Edit note',
    noteDeleted: 'Note deleted.',
    reorderFailed: 'Reorder failed.',
    emptyTitle: 'No notes yet',
    emptyHint: 'Capture thoughts and screenshots.',
    notFound: 'Note not found.',
    titleLabel: 'Title',
    titlePlaceholder: 'Enter a title',
    contentLabel: 'Content',
    contentPlaceholder: 'Supports Markdown…',
    entityLabel: 'Note'
  },

  forms: {
    // Dialog titles
    editBasicInfo: 'Edit basic info',
    editDetails: 'Edit details',
    editDescription: 'Edit description',
    editScore: 'Edit score',
    editName: 'Edit name',
    editOriginalName: 'Edit original name',
    editTags: 'Edit tags',
    editExternalSites: 'Edit related links',
    editTag: 'Edit tag',
    manageMedia: 'Manage media',
    manageExternalIds: 'Manage external IDs',
    addEntityTitle: ({ label }: { label: string }) => `Add ${label.toLowerCase()}`,
    editEntityTitle: ({ label }: { label: string }) => `Edit ${label.toLowerCase()}`,

    // Entity link dialogs (per owner)
    editGameCharacters: 'Edit characters',
    editGamePersons: 'Edit people',
    editGameCompanies: 'Edit companies',
    editAnimeCharacters: 'Edit characters',
    editAnimePersons: 'Edit staff',
    editAnimeCompanies: 'Edit companies',
    editCharacterGames: 'Edit game appearances',
    editCharacterAnimes: 'Edit anime appearances',
    editCharacterPersons: 'Edit related people',
    editPersonGames: 'Edit game credits',
    editPersonAnimes: 'Edit anime credits',
    editPersonCharacters: 'Edit voiced characters',
    editCompanyGames: 'Edit related games',
    editCompanyAnimes: 'Edit related anime',
    editCollectionEntities: 'Edit collection contents',

    // Shared field bits
    notePlaceholder: 'Optional note…',
    noteInfoPlaceholder: 'Note…',
    includesSpoiler: 'Contains spoilers',
    showSpoilers: 'Show spoilers',
    hideSpoilers: 'Hide spoilers',
    emptyListHint: ({ label }: { label: string }) =>
      `No ${label.toLowerCase()}s yet. Use the button below to add one.`,
    selectEntityRequired: ({ label }: { label: string }) => `Select a ${label.toLowerCase()}.`,

    // Basic info form
    namePlaceholder: ({ label }: { label: string }) => `${label} name`,
    originalNamePlaceholder: 'Name in the original language',
    sortNamePlaceholder: 'Name used for sorting',
    selectGender: 'Select gender',
    selectBloodType: 'Select blood type',
    agePlaceholder: 'Years',
    birthDateInvalidInteger: 'Birth date accepts numbers only.',
    deathDateInvalidInteger: 'Death date accepts numbers only.',
    birthDateInvalidFormat: 'Birth date format is invalid.',
    deathDateInvalidFormat: 'Death date format is invalid.',
    foundedDateInvalidFormat: 'Founded date format is invalid.',
    releaseDateInvalidFormat: 'Release date format is invalid.',
    foundedDateYearDayWithoutMonth: 'Founded date needs a month when both year and day are set.',
    releaseDateYearDayWithoutMonth: 'Release date needs a month when both year and day are set.',
    totalEpisodesPlaceholder: 'Optional',
    totalEpisodesInvalid: 'Total episodes must be a non-negative integer.',

    // Score form
    scoreRangeHint: 'Score is 0–10 with one decimal place (for example 8.5).',
    scoreOutOfRange: 'Score must be between 0 and 10.',

    // Description form
    markdownSupported: 'Supports Markdown',
    descriptionPlaceholder: ({ label }: { label: string }) =>
      `Enter the ${label.toLowerCase()} description (supports Markdown)…`,

    // Related sites
    addLink: 'Add link',
    editLink: 'Edit link',
    siteNameLabel: 'Name',
    siteNamePlaceholder: 'For example: Official site, VNDB…',
    siteUrlLabel: 'URL',
    requiredFieldsMissing: 'Fill in the required fields.',
    deleteLinkConfirmTitle: 'Delete link?',
    deleteLinkConfirmDescription:
      'This removes the link permanently. This action cannot be undone.',

    // External IDs
    addExternalId: 'Add external ID',
    editExternalId: 'Edit external ID',
    externalIdSourceLabel: 'Source',
    externalIdSourcePlaceholder: 'For example: vndb, steam, bangumi',
    externalIdValueLabel: 'External ID',
    externalIdValuePlaceholder: 'For example: v12345',
    externalIdSourceAndIdRequired: 'Fill in both the source and the ID.',
    externalIdEmptyValues: 'Some external IDs are empty. Check the entries and retry.',
    externalIdDuplicates: 'Duplicate external IDs found. Check the entries and retry.',
    externalIdSaveFailed:
      'Save failed. Check whether another entity already uses the same external ID.',
    emptyExternalIdsHint: 'No external IDs yet. Use the button below to add one.',

    // Tags form
    addTag: 'Add tag',
    editTagLink: 'Edit tag',
    selectTagRequired: 'Select a tag.',
    emptyTagsHint: 'No tags yet. Use the button below to add one.',
    tagNamePlaceholder: 'Tag name',
    tagDescriptionPlaceholder: 'Tag description (optional, supports Markdown)',
    tagNsfwHint: 'Mark this tag as adult content.',

    // Media dialog
    mediaUpdated: 'Media updated.',
    mediaDeleted: 'Media deleted.',
    importFromFile: 'Import from file',
    importFromUrl: 'Import from URL',
    searchImages: 'Search images',
    crop: 'Crop',
    emptyMedia: ({ label }: { label: string }) => `No ${label.toLowerCase()} yet`,
    imageEntityLabel: 'Image',
    mediaTypes: {
      cover: 'Cover',
      backdrop: 'Backdrop',
      logo: 'Logo',
      icon: 'Icon',
      photo: 'Photo'
    },
    mediaDescriptions: {
      gameCover: 'Game cover art shown on cards and lists.',
      gameBackdrop: 'Backdrop image for the detail page.',
      gameLogo: 'Game title logo.',
      gameIcon: 'Small icon.',
      animeCover: 'Anime cover art shown on cards and lists.',
      animeBackdrop: 'Backdrop image for the detail page.',
      animeLogo: 'Anime title logo.',
      characterPhoto: 'Character photo shown on cards and detail pages.',
      personPhoto: 'Person photo shown on cards and detail pages.',
      companyLogo: 'Company logo shown on cards and detail pages.'
    },
    importMediaFromUrlTitle: ({ label }: { label: string }) =>
      `Import ${label.toLowerCase()} from URL`,
    importMediaFromUrlDescription: ({ label }: { label: string }) =>
      `Enter an image URL to import the ${label.toLowerCase()}.`,
    imageUrlLabel: 'Image URL',
    imageUrlInvalid: 'Enter a valid URL.',
    imageFormatsHint: 'Supports common image formats such as JPG, PNG, and WebP.',
    previewLabel: 'Preview:',
    previewLoadFailed: 'Could not load the preview',
    importing: 'Importing…',
    searchMediaTitle: ({ label }: { label: string }) => `Search ${label.toLowerCase()}`,
    searchKeywordPlaceholder: 'Enter search keywords…',
    searchStartHint: 'Press Search to start.',
    searchFailedHint: 'Search failed',
    searchNoImages: 'No matching images found',
    confirmSelection: 'Use selection',
    cropMediaTitle: ({ label }: { label: string }) => `Crop ${label.toLowerCase()}`,
    cropFailed: 'Crop failed',

    // Metadata update dialog
    updateMetadataTitle: 'Update metadata',
    batchUpdateMetadataTitle: 'Update metadata in bulk',
    batchSelectedCount: ({ count, label }: { count: number; label: string }) =>
      `${count} ${label.toLowerCase()}${count === 1 ? '' : 's'}`,
    scraperConfigLabel: 'Scraper profile',
    updateFieldsLabel: 'Fields to update',
    selectAll: 'Select all',
    selectNone: 'Select none',
    scalarStrategyLabel: 'Single-value strategy',
    scalarStrategyPlaceholder: 'Select single-value strategy…',
    scalarStrategyIfMissing: 'Write only when missing',
    scalarStrategyOverwrite: 'Overwrite existing values',
    scalarStrategyIfMissingHint: 'Writes the new value only when the current value is missing.',
    scalarStrategyOverwriteHint: 'Overwrites the current value when a new value is available.',
    collectionStrategyLabel: 'Collection strategy',
    collectionStrategyPlaceholder: 'Select collection strategy…',
    collectionStrategyMerge: 'Merge and append',
    collectionStrategyReplace: 'Replace entirely',
    collectionStrategyMergeHint: 'Keeps existing content and appends new items.',
    collectionStrategyReplaceHint:
      'Replaces the current content with the new content. Collections the source reports as empty are cleared.',
    useExternalIdsLabel: 'Use current external IDs to locate the entry',
    useExternalIdsHint: 'Do not enable this if the current entry may match the wrong target.',
    personStandaloneHint: '"Person" can be selected and updated as a standalone field.',
    batchSilentSearchHint:
      'Runs a silent search based on the original name, takes the first result, and reuses the single-entity update flow.',
    rendererSearchHint:
      'The search flow still runs in the renderer; submitting sends a single update request.',
    updating: 'Updating…',
    update: 'Update',
    startUpdateFailed: 'Could not start the update',
    startBatchUpdateFailed: 'Could not start the bulk update',

    // Delete dialogs
    deleteRelatedOption: ({ items }: { items: string }) =>
      `Also delete ${items} linked to this entry`,
    andMoreCount: ({ count }: { count: number }) => `…and ${count} items in total`,
    addToScannerIgnoreFolder: ({ name }: { name: string }) =>
      `Add folder "${name}" to the scanner ignore list`,
    addToScannerIgnoreName: ({ name }: { name: string }) =>
      `Add "${name}" to the scanner ignore list`,

    // Collection forms
    newCollection: 'New collection',
    editCollection: 'Edit collection',
    collectionNamePlaceholder: 'Enter a collection name',
    coverLabel: 'Cover',
    pickCover: 'Pick cover',
    collectionDescriptionPlaceholder: 'Add a description (optional, supports Markdown)',
    collectionTypeLabel: 'Type',
    collectionTypeHint:
      'Static collections hold manually added items; dynamic collections update automatically from filters.',
    staticCollection: 'Static collection',
    dynamicCollection: 'Dynamic collection',
    nsfwLabel: 'Adult content',
    collectionNsfwHint: 'Mark this collection as adult content.',
    collectionUpdated: 'Collection updated.',
    collectionCreated: 'Collection created.',
    collectionCreatedWithEntities: ({ label }: { label: string }) =>
      `Collection created and ${label.toLowerCase()}s added.`,
    itemEntityLabel: 'Item',
    convertToStaticTitle: 'Convert to static collection',
    convertToStaticDescriptionWithCount: ({ count }: { count: number }) =>
      `This converts the dynamic collection into a static one. The current filter results (${count} items) are frozen as the collection contents. After conversion the contents no longer update automatically.`,
    convertToStaticDescription:
      'This converts the dynamic collection into a static one. After conversion the contents no longer update automatically.',
    converting: 'Converting…',
    confirmConvert: 'Convert',
    convertedToStatic: 'Converted to a static collection.',
    convertFailed: 'Conversion failed.',
    dynamicConfigTitle: 'Dynamic filter settings',
    enabledTypesCount: ({ count }: { count: number }) =>
      `${count} ${count === 1 ? 'type' : 'types'} enabled`,
    filterLabel: 'Filters',
    sortLabel: 'Sort:',
    sortAsc: 'Ascending',
    sortDesc: 'Descending',
    dynamicConfigHint: 'Enabled types without filter conditions include every item of that type.',
    filterConfigUpdated: 'Filter settings updated.',

    // Link relation labels
    gameLabel: 'Game',
    animeLabel: 'Anime',
    characterLabel: 'Character',
    personLabel: 'Person',
    companyLabel: 'Company',
    tagLabel: 'Tag',
    relationTypeLabel: 'Relation type',
    mediaTypeLabel: 'Media type',
    editRelatedEntries: 'Edit related entries',
    selectTypePlaceholder: 'Select type',
    characterRoleLabel: 'Character role',
    personRoleLabel: 'Person role',
    companyRoleLabel: 'Company role',
    creditRoleLabel: 'Credit',

    // Link association delete labels (used with delete-confirm dialog entity-label)
    linkLabels: {
      game: 'Game link',
      anime: 'Anime link',
      character: 'Character link',
      person: 'Person link',
      company: 'Company link',
      tag: 'Tag link',
      link: 'Link',
      externalId: 'External ID'
    }
  },

  pages: {
    libraryTitle: 'Library',
    globalSearch: 'Global search',
    showcaseTitle: 'Showcase',
    manageSections: 'Manage sections',
    collectionsTitle: 'Collections',
    newCollection: 'New collection',
    collectionsEmptyTitle: 'No collections yet',
    collectionsEmptyDescription: 'Create collections to organize your library.',
    favoritesTitle: 'Favorites',
    favoritesEmpty: ({ label }: { label: string }) => `No favorite ${label.toLowerCase()}s yet.`,
    uncategorizedTitle: ({ label }: { label: string }) => `Uncategorized ${label.toLowerCase()}s`,
    uncategorizedEmpty: ({ label }: { label: string }) =>
      `All ${label.toLowerCase()}s are categorized.`,
    dynamicCollection: 'Dynamic collection',
    playStatus: 'Play status'
  },

  explorer: {
    filter: 'Filter',
    sort: 'Sort',
    sortAsc: 'Ascending',
    sortDesc: 'Descending',
    overrideCollectionSort: 'Override collection sort',
    searchPlaceholder: 'Search…',
    filteredResults: 'Filtered results',
    noMatch: 'No matches.',
    emptyList: ({ label }: { label: string }) => `No ${label.toLowerCase()}s yet.`,
    uncategorized: 'Uncategorized'
  },

  search: {
    title: 'Library search',
    description: 'Search games, characters, people, and companies',
    placeholder: 'Search games, characters, people, companies…',
    typeToSearch: 'Type keywords to search.',
    emptyResult: ({ label }: { label: string }) => `No ${label.toLowerCase()} results.`,
    navigate: 'Navigate',
    select: 'Select',
    totalResults: ({ count }: { count: number }) =>
      count === 1 ? '1 result in total' : `${count} results in total`
  },

  showcase: {
    emptyTitle: 'The showcase is empty',
    emptyDescription:
      'Add sections to display your games, characters, people, or companies. Each section has its own filters and layout.',
    addFirstSection: 'Add the first section',
    sectionEmpty: ({ label }: { label: string }) => `No ${label.toLowerCase()}s yet.`,
    layoutHorizontal: 'Horizontal scroll',
    layoutGrid: 'Grid',

    manage: {
      title: 'Manage sections',
      empty: 'No sections yet. Use the buttons below to add one.',
      unnamed: 'Unnamed',
      show: 'Show',
      hide: 'Hide',
      addSection: 'Add section',
      selectPresets: 'Choose presets',
      sectionEntityLabel: 'Section',
      saved: 'Saved.',
      saveFailed: 'Save failed. Try again.'
    },

    form: {
      addTitle: 'Add section',
      editTitle: 'Edit section',
      titleRequired: 'Enter a section title.',
      title: 'Title',
      titlePlaceholder: 'Enter a section title…',
      entityType: 'Entity type',
      layout: 'Layout',
      openMode: 'Open in',
      openModePage: 'Page',
      openModeDialog: 'Dialog',
      cardSize: 'Card size',
      cardSizeXs: 'Extra small',
      cardSizeSm: 'Small',
      cardSizeMd: 'Medium',
      cardSizeLg: 'Large',
      cardSizeXl: 'Extra large',
      displayCount: 'Display count',
      displayCountUnlimited: 'Unlimited',
      sort: 'Sort',
      sortAsc: 'Ascending',
      sortDesc: 'Descending',
      filters: 'Filters',
      filtersSetCount: ({ count }: { count: number }) =>
        count === 1 ? '1 condition set' : `${count} conditions set`,
      filtersClickToSet: 'Click to set filters…'
    },

    presetsDialog: {
      title: 'Choose preset sections',
      empty: 'No presets available.',
      addWithCount: ({ count }: { count: number }) => `Add (${count})`
    },

    presets: {
      recentlyPlayed: { name: 'Recently played', description: 'Games sorted by last activity' },
      topRated: { name: 'Top rated', description: 'Games sorted by score' },
      recentlyAdded: { name: 'Recently added', description: 'Games sorted by date added' },
      allGames: { name: 'All games', description: 'Every game in the library' },
      favoriteGames: { name: 'Favorite games', description: 'Games you favorited' },
      recentlyWatched: { name: 'Recently watched', description: 'Anime sorted by last watched' },
      topRatedAnime: { name: 'Top rated anime', description: 'Anime sorted by score' },
      recentlyAddedAnime: {
        name: 'Recently added anime',
        description: 'Anime sorted by date added'
      },
      favoriteCharacters: { name: 'Favorite characters', description: 'Characters you favorited' },
      favoritePersons: { name: 'Favorite people', description: 'People you favorited' },
      favoriteCompanies: { name: 'Favorite companies', description: 'Companies you favorited' },
      allCollections: { name: 'All collections', description: 'Every collection in the library' },
      allTags: { name: 'All tags', description: 'Every tag in the library' }
    }
  }
}
