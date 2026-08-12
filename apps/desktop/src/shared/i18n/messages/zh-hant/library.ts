import type { Messages } from '../schema'

export const library = {
  entities: {
    game: '遊戲',
    anime: '動漫',
    character: '角色',
    person: '人物',
    company: '公司',
    collection: '合集',
    tag: '標籤'
  },

  fields: {
    name: '名稱',
    sortName: '排序名',
    originalName: '原名',
    description: '簡介',
    score: '評分',
    myScore: '我的評分',
    gender: '性別',
    age: '年齡',
    birthDate: '生日',
    deathDate: '忌日',
    foundedDate: '成立日期',
    releaseDate: '發行日期',
    addedDate: '加入日期',
    bloodType: '血型',
    height: '身高',
    weight: '體重',
    bust: '胸圍',
    waist: '腰圍',
    hips: '臀圍',
    cup: '罩杯',
    measurements: '體型',
    tags: '標籤',
    collections: '合集',
    relatedGames: '相關遊戲',
    relatedPersons: '相關人物',
    relatedCharacters: '相關角色',
    relatedCompanies: '相關公司',
    characterPersons: '角色關聯人物',
    externalSites: '外部連結',
    externalIds: '外部 ID',
    photos: '照片',
    covers: '封面',
    backdrops: '背景',
    logos: '標誌',
    icons: '圖示',
    note: '備註',
    role: '職位',
    type: '類型',
    status: '狀態',
    playDuration: '遊玩時長',
    lastActiveAt: '最近遊玩',
    order: '排序',
    format: '類型',
    totalEpisodes: '總話數',
    episodes: '劇集',
    extras: '特典',
    watchDuration: '觀看時長',
    lastWatchedAt: '最近觀看',
    relatedAnimes: '相關動漫',
    relatedEntries: '關聯條目'
  },

  status: {
    notStarted: '未開始',
    inProgress: '進行中',
    partial: '部分完成',
    completed: '已完成',
    multiple: '多周目',
    shelved: '已擱置'
  },

  animeStatus: {
    planned: '想看',
    watching: '在看',
    completed: '已看完',
    onHold: '擱置',
    dropped: '棄番'
  },

  gender: {
    male: '男性',
    female: '女性',
    other: '其他'
  },

  bloodType: {
    a: 'A型',
    b: 'B型',
    o: 'O型',
    ab: 'AB型'
  },

  roles: {
    gamePerson: {
      director: '導演',
      scenario: '劇本',
      illustration: '原畫',
      music: '音樂',
      programmer: '程式',
      actor: '聲優',
      other: '其他'
    },
    characterPerson: {
      actor: '聲優',
      illustration: '原畫',
      designer: '設計',
      other: '其他'
    },
    gameCharacter: {
      main: '主角',
      supporting: '配角',
      cameo: '客串',
      other: '其他'
    },
    gameCompany: {
      developer: '開發',
      publisher: '發行',
      distributor: '經銷',
      other: '其他'
    },
    animePerson: {
      originalCreator: '原作',
      director: '監督',
      series: '系列構成',
      scenario: '腳本',
      episodeDirector: '演出',
      characterDesign: '角色設計',
      animationDirector: '作畫監督',
      animation: '原畫',
      art: '美術',
      photography: '攝影',
      sound: '音響',
      music: '音樂',
      producer: '製片人',
      other: '其他'
    },
    animeCharacter: {
      main: '主角',
      supporting: '配角',
      cameo: '客串',
      other: '其他'
    },
    animeCompany: {
      studio: '製作',
      producer: '出品',
      distributor: '發行',
      other: '其他'
    }
  },

  animeFormat: {
    tv: 'TV',
    movie: '劇場版',
    ova: 'OVA',
    ona: 'ONA',
    special: '特別篇',
    other: '其他'
  },

  animeEpisodeType: {
    regular: '正片',
    special: '特別篇'
  },

  mediaRelation: {
    sequel: '續作',
    prequel: '前作',
    sideStory: '外傳',
    parentStory: '本篇',
    summary: '總集篇',
    fullStory: '完整版',
    adaptation: '改編作品',
    sourceMaterial: '原作',
    alternative: '不同版本',
    other: '其他'
  },

  animeExtraKind: {
    trailer: '預告',
    pv: 'PV',
    ncop: '無字幕 OP',
    nced: '無字幕 ED',
    interview: '訪談',
    other: '其他'
  },

  counts: {
    game: ({ count }: { count: number }) => `${count} 款遊戲`,
    anime: ({ count }: { count: number }) => `${count} 部動漫`,
    character: ({ count }: { count: number }) => `${count} 個角色`,
    person: ({ count }: { count: number }) => `${count} 位人物`,
    company: ({ count }: { count: number }) => `${count} 家公司`,
    collection: ({ count }: { count: number }) => `${count} 個合集`,
    tag: ({ count }: { count: number }) => `${count} 個標籤`
  },

  spoiler: {
    maskedName: '劇透內容',
    maskedNote: '已隱藏，開啟「顯示劇透」後可查看'
  },

  menu: {
    addToCollection: '加入合集',
    removeFromCollection: '從合集中移除',
    noCollections: '無可用合集',
    newCollection: '新增合集…',
    playStatus: '遊玩狀態',
    editScore: '修改評分',
    favorite: '喜歡',
    setFavorite: '設為喜歡',
    unsetFavorite: '取消喜歡',
    openGameDir: '開啟遊戲目錄',
    launchConfig: '啟動設定',
    media: '媒體管理',
    updateMetadata: '更新中繼資料',
    manageExternalIds: '管理外部 ID',
    mergeDuplicates: '合併重複實體',
    editInfo: '編輯資訊',
    editContent: '編輯內容',
    editFilter: '編輯篩選',
    convertToStatic: '轉為靜態',
    batchUpdateMetadata: '批次更新中繼資料',
    batchDelete: '批次刪除'
  },

  feedback: {
    addedToCollection: '已加入合集',
    addFailed: '加入失敗',
    removedFromCollection: '已從合集中移除',
    removeFailed: '移除失敗',
    statusUpdated: '狀態已更新',
    updateFailed: '更新失敗',
    createFailed: '建立失敗',
    favoriteAdded: '已加入喜歡',
    favoriteRemoved: '已取消喜歡',
    nsfwMarked: '已標記為 NSFW',
    nsfwCleared: '已取消 NSFW 標記',
    saveFailedRetry: '儲存失敗，請重試',
    deleteFailedWithReason: ({ message }: { message: string }) => `刪除失敗：${message}`,
    searchFailed: '搜尋失敗',
    unknownError: '未知錯誤',
    gameDirNotSet: '遊戲目錄未設定',
    openGameDirFailed: '無法開啟遊戲目錄',
    pickFileFailed: '選擇檔案失敗',
    pickCoverFailed: '選擇封面失敗',
    deletedSummary: ({ items }: { items: string[] }) =>
      items.length > 0 ? `已刪除 ${items.join('、')}` : '已刪除',
    nameAndMore: ({ name, count }: { name: string; count: number }) => `${name} 等 ${count} 項`
  },

  select: {
    searchPlaceholder: ({ label }: { label: string }) => `搜尋${label}…`,
    selectPlaceholder: ({ label }: { label: string }) => `選擇${label}…`
  },

  searcher: {
    scraperProfile: '刮削設定',
    searchLabel: ({ label }: { label: string }) => `搜尋${label}`,
    namePlaceholder: ({ label }: { label: string }) => `輸入${label}名稱…`,
    columnName: '名稱',
    columnOriginalName: '原名',
    columnBirth: '出生',
    columnDeath: '逝世',
    columnFounded: '成立',
    columnReleaseDate: '發行日期',
    startHint: ({ label }: { label: string }) => `輸入${label}名稱開始搜尋`,
    noMatchTitle: '無符合結果',
    noMatchDescription: '請嘗試其他關鍵字。',
    resultCount: ({ count }: { count: number }) => `共 ${count} 筆結果`,
    selectedOne: '已選擇 1 筆',
    idLabel: ({ label }: { label: string }) => `${label} ID`,
    idDescription: '從搜尋結果選擇或直接輸入 ID。',
    idPlaceholder: '從上方選擇或直接輸入…'
  },

  detail: {
    notFoundTitle: ({ label }: { label: string }) => `${label}不存在`,
    notFoundDescription: ({ label }: { label: string }) => `該${label}可能已被刪除。`,
    tabs: {
      overview: '概覽',
      characters: '角色',
      persons: '人物',
      companies: '公司',
      relatedGames: '相關遊戲',
      relatedAnimes: '相關動漫',
      relatedPersons: '相關人物',
      relatedCharacters: '相關角色',
      activity: '活動',
      saves: '存檔',
      notes: '筆記'
    },
    tooltips: {
      score: '評分',
      favoriteAdd: '加入喜歡',
      favoriteRemove: '取消喜歡',
      spoilerShow: '顯示劇透',
      spoilerHide: '隱藏劇透',
      openDir: '開啟目錄'
    },
    sections: {
      description: '簡介',
      tags: '標籤',
      externalSites: '外部連結',
      details: '詳細資訊'
    },
    empty: {
      description: '暫無簡介',
      tags: '暫無標籤',
      externalSites: '暫無外部連結',
      relatedGames: '暫無相關遊戲',
      relatedAnimes: '暫無相關動漫',
      relatedPersons: '暫無相關人物',
      relatedCharacters: '暫無相關角色',
      relatedEntries: '暫無關聯條目',
      characters: '暫無角色',
      persons: '暫無人物',
      companies: '暫無公司'
    },
    manage: '管理',
    ageValue: ({ age }: { age: number }) => `${age}歲`,
    addEntity: ({ label }: { label: string }) => `新增${label}`,
    collectionEmptyTitle: ({ label }: { label: string }) => `此合集暫無${label}`,
    collectionEmptyDescription: ({ label }: { label: string }) =>
      `透過掃描器將${label}加入此合集。`,
    tagEmptyTitle: ({ label }: { label: string }) => `此標籤暫無${label}`,
    tagEmptyDescription: ({ label }: { label: string }) => `尚無${label}使用此標籤。`
  },

  forms: {
    editBasicInfo: '編輯基本資訊',
    editDetails: '編輯詳細資訊',
    editDescription: '編輯簡介',
    editScore: '編輯評分',
    editName: '編輯名稱',
    editOriginalName: '編輯原名',
    editTags: '編輯標籤',
    editExternalSites: '編輯相關連結',
    editTag: '編輯標籤',
    manageMedia: '媒體管理',
    manageExternalIds: '管理外部 ID',
    addEntityTitle: ({ label }: { label: string }) => `新增${label}`,
    editEntityTitle: ({ label }: { label: string }) => `編輯${label}`,

    editGameCharacters: '編輯角色',
    editGamePersons: '編輯人物',
    editGameCompanies: '編輯公司',
    editAnimeCharacters: '編輯角色',
    editAnimePersons: '編輯製作人員',
    editAnimeCompanies: '編輯公司',
    editCharacterGames: '編輯登場遊戲',
    editCharacterAnimes: '編輯出演動漫',
    editCharacterPersons: '編輯相關人員',
    editPersonGames: '編輯參與遊戲',
    editPersonAnimes: '編輯參與動漫',
    editPersonCharacters: '編輯配音角色',
    editCompanyGames: '編輯相關遊戲',
    editCompanyAnimes: '編輯相關動漫',
    editCollectionEntities: '編輯合集內容',

    notePlaceholder: '選填備註…',
    noteInfoPlaceholder: '備註資訊…',
    includesSpoiler: '包含劇透',
    showSpoilers: '顯示劇透',
    hideSpoilers: '隱藏劇透',
    emptyListHint: ({ label }: { label: string }) => `暫無${label}，點擊下方按鈕新增`,
    selectEntityRequired: ({ label }: { label: string }) => `請選擇${label}`,

    namePlaceholder: ({ label }: { label: string }) => `${label}名稱`,
    originalNamePlaceholder: '原文名稱',
    sortNamePlaceholder: '用於排序的名稱',
    selectGender: '選擇性別',
    selectBloodType: '選擇血型',
    agePlaceholder: '歲',
    birthDateInvalidInteger: '生日只能填寫整數。',
    deathDateInvalidInteger: '忌日只能填寫整數。',
    birthDateInvalidFormat: '生日格式不正確。',
    deathDateInvalidFormat: '忌日格式不正確。',
    foundedDateInvalidFormat: '成立日期格式不正確。',
    releaseDateInvalidFormat: '發行日期格式不正確。',
    foundedDateYearDayWithoutMonth: '成立日期填寫了年份和日期時，必須同時填寫月份。',
    releaseDateYearDayWithoutMonth: '發行日期填寫了年份和日期時，必須同時填寫月份。',
    totalEpisodesPlaceholder: '可留空',
    totalEpisodesInvalid: '總集數必須為非負整數。',

    scoreRangeHint: '評分範圍 0-10，支援一位小數（如 8.5）。',
    scoreOutOfRange: '評分必須在 0-10 之間。',

    markdownSupported: '支援 Markdown',
    descriptionPlaceholder: ({ label }: { label: string }) => `輸入${label}簡介（支援 Markdown）…`,

    addLink: '新增連結',
    editLink: '編輯連結',
    siteNameLabel: '名稱',
    siteNamePlaceholder: '如：官網、VNDB…',
    siteUrlLabel: '連結',
    requiredFieldsMissing: '請填寫必填欄位',
    deleteLinkConfirmTitle: '確認刪除連結？',
    deleteLinkConfirmDescription: '確定要刪除這條連結嗎？此操作無法復原。',

    addExternalId: '新增外部 ID',
    editExternalId: '編輯外部 ID',
    externalIdSourceLabel: '來源',
    externalIdSourcePlaceholder: '如：vndb、steam、bangumi',
    externalIdValueLabel: '外部 ID',
    externalIdValuePlaceholder: '如：v12345',
    externalIdSourceAndIdRequired: '請填寫來源和 ID',
    externalIdEmptyValues: '外部 ID 中存在空值，請檢查後重試',
    externalIdDuplicates: '存在重複的外部 ID，請檢查後重試',
    externalIdSaveFailed: '儲存失敗，請檢查是否與其他實體存在重複外部 ID',
    emptyExternalIdsHint: '暫無外部 ID，點擊下方按鈕新增',

    addTag: '新增標籤',
    editTagLink: '編輯標籤',
    selectTagRequired: '請選擇標籤',
    emptyTagsHint: '暫無標籤，點擊下方按鈕新增',
    tagNamePlaceholder: '標籤名稱',
    tagDescriptionPlaceholder: '標籤描述（選填，支援 Markdown）',
    tagNsfwHint: '標記此標籤為成人內容。',

    mediaUpdated: '媒體已更新',
    mediaDeleted: '媒體已刪除',
    importFromFile: '從檔案匯入',
    importFromUrl: '從連結匯入',
    searchImages: '搜尋圖片',
    crop: '裁剪',
    emptyMedia: ({ label }: { label: string }) => `暫無${label}`,
    imageEntityLabel: '圖片',
    mediaTypes: {
      cover: '封面',
      backdrop: '背景',
      logo: '標誌',
      icon: '圖示',
      photo: '照片'
    },
    mediaDescriptions: {
      gameCover: '遊戲封面圖，用於卡片和列表顯示。',
      gameBackdrop: '詳情頁背景圖。',
      gameLogo: '遊戲標題標誌。',
      gameIcon: '小尺寸圖示。',
      animeCover: '動漫封面圖，用於卡片和列表顯示。',
      animeBackdrop: '詳情頁背景圖。',
      animeLogo: '動漫標題標誌。',
      characterPhoto: '角色照片，用於卡片和詳情顯示。',
      personPhoto: '人物照片，用於卡片和詳情顯示。',
      companyLogo: '公司標誌，用於卡片和詳情顯示。'
    },
    importMediaFromUrlTitle: ({ label }: { label: string }) => `從連結匯入${label}`,
    importMediaFromUrlDescription: ({ label }: { label: string }) =>
      `輸入圖片 URL 以匯入${label}。`,
    imageUrlLabel: '圖片連結',
    imageUrlInvalid: '請輸入有效的 URL',
    imageFormatsHint: '支援 JPG、PNG、WebP 等常見圖片格式。',
    previewLabel: '預覽：',
    previewLoadFailed: '無法載入預覽',
    importing: '匯入中…',
    searchMediaTitle: ({ label }: { label: string }) => `搜尋${label}`,
    searchKeywordPlaceholder: '輸入搜尋關鍵字…',
    searchStartHint: '點擊搜尋開始',
    searchFailedHint: '搜尋失敗',
    searchNoImages: '未找到相關圖片',
    confirmSelection: '確認選擇',
    cropMediaTitle: ({ label }: { label: string }) => `裁剪${label}`,
    cropFailed: '裁剪失敗',

    updateMetadataTitle: '更新中繼資料',
    batchUpdateMetadataTitle: '批次更新中繼資料',
    batchSelectedCount: ({ count, label }: { count: number; label: string }) =>
      `${count} 個${label}`,
    scraperConfigLabel: '刮削器設定',
    updateFieldsLabel: '更新項目',
    selectAll: '全選',
    selectNone: '全不選',
    scalarStrategyLabel: '單值策略',
    scalarStrategyPlaceholder: '選擇單值策略…',
    scalarStrategyIfMissing: '僅缺失時寫入',
    scalarStrategyOverwrite: '覆蓋現有值',
    scalarStrategyIfMissingHint: '僅在目前值缺失時寫入新值。',
    scalarStrategyOverwriteHint: '如存在可用新值，則覆蓋目前值。',
    collectionStrategyLabel: '集合策略',
    collectionStrategyPlaceholder: '選擇集合策略…',
    collectionStrategyMerge: '合併追加',
    collectionStrategyReplace: '整體取代',
    collectionStrategyMergeHint: '保留現有內容，並追加新增內容。',
    collectionStrategyReplaceHint: '以新內容整體取代目前內容；資料來源明確為空的集合將被清空。',
    useExternalIdsLabel: '使用目前外部 ID 輔助定位',
    useExternalIdsHint: '若目前條目可能對應錯誤目標，請勿啟用此項。',
    personStandaloneHint: '「人物」可作為獨立項目單獨勾選更新。',
    batchSilentSearchHint: '將基於「原名」執行靜默檢索，並預設採用首個結果，再複用單體更新流程。',
    rendererSearchHint: '檢索流程仍在 renderer 側執行，提交時僅發送一次更新請求。',
    updating: '更新中…',
    update: '更新',
    startUpdateFailed: '啟動更新失敗',
    startBatchUpdateFailed: '啟動批次更新失敗',

    deleteRelatedOption: ({ items }: { items: string }) => `同時刪除關聯的 ${items}`,
    andMoreCount: ({ count }: { count: number }) => `…等 ${count} 項`,
    addToScannerIgnoreFolder: ({ name }: { name: string }) =>
      `將資料夾「${name}」加入掃描器忽略清單`,
    addToScannerIgnoreName: ({ name }: { name: string }) => `將「${name}」加入掃描器忽略清單`,

    newCollection: '新增合集',
    editCollection: '編輯合集',
    collectionNamePlaceholder: '輸入合集名稱',
    coverLabel: '封面',
    pickCover: '選擇封面',
    collectionDescriptionPlaceholder: '新增描述（選填，支援 Markdown）',
    collectionTypeLabel: '類型',
    collectionTypeHint: '靜態合集手動加入內容，動態合集依篩選條件自動更新。',
    staticCollection: '靜態合集',
    dynamicCollection: '動態合集',
    nsfwLabel: '成人內容',
    collectionNsfwHint: '標記此合集包含成人內容。',
    collectionUpdated: '合集已更新',
    collectionCreated: '合集已建立',
    collectionCreatedWithEntities: ({ label }: { label: string }) => `已建立合集並加入${label}`,
    itemEntityLabel: '項目',
    convertToStaticTitle: '轉換為靜態合集',
    convertToStaticDescriptionWithCount: ({ count }: { count: number }) =>
      `此操作將把動態合集轉換為靜態合集，目前篩選結果（共 ${count} 項）將被固化為合集內容。轉換後，合集內容將不再隨資料變化自動更新。`,
    convertToStaticDescription:
      '此操作將把動態合集轉換為靜態合集。轉換後，合集內容將不再自動更新。',
    converting: '轉換中…',
    confirmConvert: '確認轉換',
    convertedToStatic: '已轉換為靜態合集',
    convertFailed: '轉換失敗',
    dynamicConfigTitle: '動態篩選設定',
    enabledTypesCount: ({ count }: { count: number }) => `已啟用 ${count} 個類型`,
    filterLabel: '篩選',
    sortLabel: '排序：',
    sortAsc: '升冪',
    sortDesc: '降冪',
    dynamicConfigHint: '已啟用但未設定篩選條件的類型將包含該類型的全部項目。',
    filterConfigUpdated: '篩選設定已更新',

    gameLabel: '遊戲',
    animeLabel: '動漫',
    characterLabel: '角色',
    personLabel: '人物',
    companyLabel: '公司',
    tagLabel: '標籤',
    relationTypeLabel: '關係類型',
    mediaTypeLabel: '媒體類型',
    editRelatedEntries: '編輯關聯條目',
    selectTypePlaceholder: '選擇類型',
    characterRoleLabel: '角色類型',
    personRoleLabel: '人物類型',
    companyRoleLabel: '公司類型',
    creditRoleLabel: '職位',

    linkLabels: {
      game: '遊戲關聯',
      anime: '動漫關聯',
      character: '角色關聯',
      person: '人物關聯',
      company: '公司關聯',
      tag: '標籤關聯',
      link: '連結',
      externalId: '外部 ID'
    }
  },

  pages: {
    libraryTitle: '媒體庫',
    globalSearch: '全域搜尋',
    showcaseTitle: '陳列櫃',
    manageSections: '管理區塊',
    collectionsTitle: '合集',
    newCollection: '新建合集',
    collectionsEmptyTitle: '暫無合集',
    collectionsEmptyDescription: '建立合集來整理你的媒體庫。',
    favoritesTitle: '喜歡',
    favoritesEmpty: ({ label }: { label: string }) => `暫無喜歡的${label}。`,
    uncategorizedTitle: ({ label }: { label: string }) => `未分類${label}`,
    uncategorizedEmpty: ({ label }: { label: string }) => `所有${label}都已分類。`,
    dynamicCollection: '動態合集',
    playStatus: '遊玩狀態'
  },

  explorer: {
    filter: '篩選',
    sort: '排序',
    sortAsc: '升冪',
    sortDesc: '降冪',
    overrideCollectionSort: '覆蓋合集內排序',
    searchPlaceholder: '搜尋…',
    filteredResults: '篩選結果',
    noMatch: '無符合結果。',
    emptyList: ({ label }: { label: string }) => `暫無${label}。`,
    uncategorized: '未分類'
  },

  search: {
    title: '庫搜尋',
    description: '搜尋遊戲、角色、人物和公司',
    placeholder: '搜尋遊戲、角色、人物、公司…',
    typeToSearch: '輸入關鍵字搜尋。',
    emptyResult: ({ label }: { label: string }) => `無${label}結果。`,
    navigate: '導覽',
    select: '選擇',
    totalResults: ({ count }: { count: number }) => `共 ${count} 筆結果`
  },

  showcase: {
    emptyTitle: '陳列櫃為空',
    emptyDescription:
      '新增區塊來展示你的遊戲、角色、人物或公司。每個區塊可以有獨立的篩選條件和版面配置。',
    addFirstSection: '新增第一個區塊',
    sectionEmpty: ({ label }: { label: string }) => `暫無${label}。`,
    layoutHorizontal: '橫向捲動',
    layoutGrid: '網格',

    manage: {
      title: '管理區塊',
      empty: '暫無區塊，點選下方按鈕新增。',
      unnamed: '未命名',
      show: '顯示',
      hide: '隱藏',
      addSection: '新增區塊',
      selectPresets: '選擇預設',
      sectionEntityLabel: '區塊',
      saved: '已儲存。',
      saveFailed: '儲存失敗，請重試。'
    },

    form: {
      addTitle: '新增區塊',
      editTitle: '編輯區塊',
      titleRequired: '請輸入區塊標題。',
      title: '標題',
      titlePlaceholder: '輸入區塊標題…',
      entityType: '實體類型',
      layout: '版面配置',
      openMode: '開啟方式',
      openModePage: '頁面',
      openModeDialog: '對話方塊',
      cardSize: '卡片大小',
      cardSizeXs: '超小',
      cardSizeSm: '小',
      cardSizeMd: '中',
      cardSizeLg: '大',
      cardSizeXl: '超大',
      displayCount: '顯示數量',
      displayCountUnlimited: '不限',
      sort: '排序',
      sortAsc: '升冪',
      sortDesc: '降冪',
      filters: '篩選條件',
      filtersSetCount: ({ count }: { count: number }) => `已設定 ${count} 個條件`,
      filtersClickToSet: '點選設定篩選條件…'
    },

    presetsDialog: {
      title: '選擇預設區塊',
      empty: '暫無可用預設。',
      addWithCount: ({ count }: { count: number }) => `新增 (${count})`
    },

    presets: {
      recentlyPlayed: { name: '最近遊玩', description: '依最後活躍時間排序的遊戲' },
      topRated: { name: '高分遊戲', description: '依評分排序的遊戲' },
      recentlyAdded: { name: '最新加入', description: '依加入時間排序的遊戲' },
      allGames: { name: '全部遊戲', description: '庫中的全部遊戲' },
      favoriteGames: { name: '喜歡的遊戲', description: '已加紅心的遊戲' },
      recentlyWatched: { name: '最近觀看', description: '依最近觀看時間排序的動漫' },
      topRatedAnime: { name: '高分動漫', description: '依評分排序的動漫' },
      recentlyAddedAnime: { name: '最新加入的動漫', description: '依加入時間排序的動漫' },
      favoriteCharacters: { name: '喜歡的角色', description: '已加紅心的角色' },
      favoritePersons: { name: '喜歡的人物', description: '已加紅心的人物' },
      favoriteCompanies: { name: '喜歡的公司', description: '已加紅心的公司' },
      allCollections: { name: '全部合集', description: '庫中的全部合集' },
      allTags: { name: '全部標籤', description: '庫中的全部標籤' }
    }
  }
} satisfies Messages['library']
