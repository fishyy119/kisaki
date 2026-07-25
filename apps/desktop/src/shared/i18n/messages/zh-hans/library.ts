import type { Messages } from '../schema'

export const library = {
  entities: {
    game: '游戏',
    character: '角色',
    person: '人物',
    company: '公司',
    collection: '合集',
    tag: '标签'
  },

  fields: {
    name: '名称',
    sortName: '排序名',
    originalName: '原名',
    description: '简介',
    score: '评分',
    myScore: '我的评分',
    gender: '性别',
    age: '年龄',
    birthDate: '生日',
    deathDate: '忌日',
    foundedDate: '成立日期',
    releaseDate: '发行日期',
    addedDate: '添加日期',
    bloodType: '血型',
    height: '身高',
    weight: '体重',
    bust: '胸围',
    waist: '腰围',
    hips: '臀围',
    cup: '罩杯',
    measurements: '体型',
    tags: '标签',
    collections: '合集',
    relatedGames: '相关游戏',
    relatedPersons: '相关人物',
    relatedCharacters: '相关角色',
    relatedCompanies: '相关公司',
    relatedSites: '相关链接',
    externalIds: '外部 ID',
    photos: '照片',
    covers: '封面',
    backdrops: '背景',
    logos: '徽标',
    icons: '图标',
    note: '备注',
    role: '职位',
    type: '类型',
    status: '状态',
    playDuration: '游玩时长',
    lastActiveAt: '最近游玩',
    order: '排序'
  },

  status: {
    notStarted: '未开始',
    inProgress: '进行中',
    partial: '部分完成',
    completed: '已完成',
    multiple: '多周目',
    shelved: '已搁置'
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
      director: '导演',
      scenario: '剧本',
      illustration: '原画',
      music: '音乐',
      programmer: '程序',
      actor: '声优',
      other: '其他'
    },
    characterPerson: {
      actor: '声优',
      illustration: '原画',
      designer: '设计',
      other: '其他'
    },
    gameCharacter: {
      main: '主角',
      supporting: '配角',
      cameo: '客串',
      other: '其他'
    },
    gameCompany: {
      developer: '开发',
      publisher: '发行',
      distributor: '分销',
      other: '其他'
    }
  },

  counts: {
    game: ({ count }: { count: number }) => `${count} 款游戏`,
    character: ({ count }: { count: number }) => `${count} 个角色`,
    person: ({ count }: { count: number }) => `${count} 位人物`,
    company: ({ count }: { count: number }) => `${count} 家公司`,
    collection: ({ count }: { count: number }) => `${count} 个合集`,
    tag: ({ count }: { count: number }) => `${count} 个标签`
  },

  spoiler: {
    maskedName: '剧透内容',
    maskedNote: '已隐藏，开启「显示剧透」后可查看'
  },

  menu: {
    addToCollection: '添加至合集',
    removeFromCollection: '从合集中移除',
    noCollections: '无可用合集',
    newCollection: '新建合集…',
    playStatus: '游玩状态',
    editScore: '修改评分',
    favorite: '喜欢',
    setFavorite: '设为喜欢',
    unsetFavorite: '取消喜欢',
    openGameDir: '打开游戏目录',
    launchConfig: '启动配置',
    media: '媒体管理',
    updateMetadata: '更新元数据',
    manageExternalIds: '管理外部 ID',
    mergeDuplicates: '合并重复实体',
    editInfo: '编辑信息',
    editContent: '编辑内容',
    editFilter: '编辑筛选',
    convertToStatic: '转为静态',
    batchUpdateMetadata: '批量更新元数据',
    batchDelete: '批量删除'
  },

  feedback: {
    addedToCollection: '已添加至合集',
    addFailed: '添加失败',
    removedFromCollection: '已从合集中移除',
    removeFailed: '移除失败',
    statusUpdated: '状态已更新',
    updateFailed: '更新失败',
    createFailed: '创建失败',
    favoriteAdded: '已添加至喜欢',
    favoriteRemoved: '已取消喜欢',
    nsfwMarked: '已标记为 NSFW',
    nsfwCleared: '已取消 NSFW 标记',
    saveFailedRetry: '保存失败，请重试',
    deleteFailedWithReason: ({ message }: { message: string }) => `删除失败：${message}`,
    searchFailed: '搜索失败',
    unknownError: '未知错误',
    gameDirNotSet: '游戏目录未设置',
    openGameDirFailed: '无法打开游戏目录',
    pickFileFailed: '选择文件失败',
    pickCoverFailed: '选择封面失败',
    deletedSummary: ({ items }: { items: string[] }) =>
      items.length > 0 ? `已删除 ${items.join('、')}` : '已删除',
    nameAndMore: ({ name, count }: { name: string; count: number }) => `${name} 等 ${count} 项`
  },

  select: {
    searchPlaceholder: ({ label }: { label: string }) => `搜索${label}…`,
    selectPlaceholder: ({ label }: { label: string }) => `选择${label}…`
  },

  searcher: {
    scraperProfile: '刮削配置',
    searchLabel: ({ label }: { label: string }) => `搜索${label}`,
    namePlaceholder: ({ label }: { label: string }) => `输入${label}名称…`,
    columnName: '名称',
    columnOriginalName: '原名',
    columnBirth: '出生',
    columnDeath: '逝世',
    columnFounded: '成立',
    columnReleaseDate: '发行日期',
    startHint: ({ label }: { label: string }) => `输入${label}名称开始搜索`,
    noMatchTitle: '无匹配结果',
    noMatchDescription: '请尝试其他关键词。',
    resultCount: ({ count }: { count: number }) => `共 ${count} 条结果`,
    selectedOne: '已选择 1 条',
    idLabel: ({ label }: { label: string }) => `${label} ID`,
    idDescription: '从搜索结果选择或直接输入 ID。',
    idPlaceholder: '从上方选择或直接输入…'
  },

  detail: {
    notFoundTitle: ({ label }: { label: string }) => `${label}不存在`,
    notFoundDescription: ({ label }: { label: string }) => `该${label}可能已被删除。`,
    tabs: {
      overview: '概览',
      characters: '角色',
      persons: '人物',
      companies: '公司',
      relatedGames: '相关游戏',
      relatedPersons: '相关人物',
      relatedCharacters: '相关角色',
      activity: '活动',
      saves: '存档',
      notes: '笔记'
    },
    tooltips: {
      score: '评分',
      favoriteAdd: '添加喜欢',
      favoriteRemove: '取消喜欢',
      spoilerShow: '显示剧透',
      spoilerHide: '隐藏剧透',
      openDir: '打开目录'
    },
    sections: {
      description: '简介',
      tags: '标签',
      relatedSites: '相关链接',
      details: '详细信息'
    },
    empty: {
      description: '暂无简介',
      tags: '暂无标签',
      relatedSites: '暂无相关链接',
      relatedGames: '暂无相关游戏',
      relatedPersons: '暂无相关人物',
      relatedCharacters: '暂无相关角色',
      characters: '暂无角色',
      persons: '暂无人物',
      companies: '暂无公司'
    },
    manage: '管理',
    ageValue: ({ age }: { age: number }) => `${age}岁`,
    addEntity: ({ label }: { label: string }) => `添加${label}`,
    collectionEmptyTitle: ({ label }: { label: string }) => `此合集暂无${label}`,
    collectionEmptyDescription: ({ label }: { label: string }) =>
      `通过扫描器添加${label}到此合集。`,
    tagEmptyTitle: ({ label }: { label: string }) => `此标签暂无${label}`,
    tagEmptyDescription: ({ label }: { label: string }) => `尚无${label}使用此标签。`
  },

  forms: {
    editBasicInfo: '编辑基本信息',
    editDetails: '编辑详细信息',
    editDescription: '编辑简介',
    editScore: '编辑评分',
    editName: '编辑名称',
    editOriginalName: '编辑原名',
    editTags: '编辑标签',
    editRelatedSites: '编辑相关链接',
    editTag: '编辑标签',
    manageMedia: '媒体管理',
    manageExternalIds: '管理外部 ID',
    addEntityTitle: ({ label }: { label: string }) => `添加${label}`,
    editEntityTitle: ({ label }: { label: string }) => `编辑${label}`,

    editGameCharacters: '编辑角色',
    editGamePersons: '编辑人物',
    editGameCompanies: '编辑公司',
    editCharacterGames: '编辑登场游戏',
    editCharacterPersons: '编辑相关人员',
    editPersonGames: '编辑参与游戏',
    editPersonCharacters: '编辑配音角色',
    editCompanyGames: '编辑相关游戏',
    editCollectionEntities: '编辑合集内容',

    notePlaceholder: '可选备注…',
    noteInfoPlaceholder: '备注信息…',
    includesSpoiler: '包含剧透',
    showSpoilers: '显示剧透',
    hideSpoilers: '隐藏剧透',
    emptyListHint: ({ label }: { label: string }) => `暂无${label}，点击下方按钮添加`,
    selectEntityRequired: ({ label }: { label: string }) => `请选择${label}`,

    namePlaceholder: ({ label }: { label: string }) => `${label}名称`,
    originalNamePlaceholder: '原文名称',
    sortNamePlaceholder: '用于排序的名称',
    selectGender: '选择性别',
    selectBloodType: '选择血型',
    agePlaceholder: '岁',
    birthDateInvalidInteger: '生日只能填写整数。',
    deathDateInvalidInteger: '忌日只能填写整数。',
    birthDateInvalidFormat: '生日格式不正确。',
    deathDateInvalidFormat: '忌日格式不正确。',
    foundedDateInvalidFormat: '成立日期格式不正确。',
    releaseDateInvalidFormat: '发行日期格式不正确。',
    foundedDateYearDayWithoutMonth: '成立日期填写了年份和日期时，必须同时填写月份。',
    releaseDateYearDayWithoutMonth: '发行日期填写了年份和日期时，必须同时填写月份。',

    scoreRangeHint: '评分范围 0-10，支持一位小数（如 8.5）。',
    scoreOutOfRange: '评分必须在 0-10 之间。',

    markdownSupported: '支持 Markdown',
    descriptionPlaceholder: ({ label }: { label: string }) => `输入${label}简介（支持 Markdown）…`,

    addLink: '添加链接',
    editLink: '编辑链接',
    siteNameLabel: '名称',
    siteNamePlaceholder: '如：官网、VNDB…',
    siteUrlLabel: '链接',
    requiredFieldsMissing: '请填写必填字段',
    deleteLinkConfirmTitle: '确认删除链接？',
    deleteLinkConfirmDescription: '确定要删除这条链接吗？此操作无法撤销。',

    addExternalId: '添加外部 ID',
    editExternalId: '编辑外部 ID',
    externalIdSourceLabel: '来源',
    externalIdSourcePlaceholder: '如：vndb、steam、bangumi',
    externalIdValueLabel: '外部 ID',
    externalIdValuePlaceholder: '如：v12345',
    externalIdSourceAndIdRequired: '请填写来源和 ID',
    externalIdEmptyValues: '外部 ID 中存在空值，请检查后重试',
    externalIdDuplicates: '存在重复的外部 ID，请检查后重试',
    externalIdSaveFailed: '保存失败，请检查是否与其他实体存在重复外部 ID',
    emptyExternalIdsHint: '暂无外部 ID，点击下方按钮添加',

    addTag: '添加标签',
    editTagLink: '编辑标签',
    selectTagRequired: '请选择标签',
    emptyTagsHint: '暂无标签，点击下方按钮添加',
    tagNamePlaceholder: '标签名称',
    tagDescriptionPlaceholder: '标签描述（可选，支持 Markdown）',
    tagNsfwHint: '标记此标签为成人内容。',

    mediaUpdated: '媒体已更新',
    mediaDeleted: '媒体已删除',
    importFromFile: '从文件导入',
    importFromUrl: '从链接导入',
    searchImages: '搜索图片',
    crop: '裁剪',
    emptyMedia: ({ label }: { label: string }) => `暂无${label}`,
    imageEntityLabel: '图片',
    mediaTypes: {
      cover: '封面',
      backdrop: '背景',
      logo: '徽标',
      icon: '图标',
      photo: '照片'
    },
    mediaDescriptions: {
      gameCover: '游戏封面图，用于卡片和列表显示。',
      gameBackdrop: '详情页背景图。',
      gameLogo: '游戏标题 Logo。',
      gameIcon: '小尺寸图标。',
      characterPhoto: '角色照片，用于卡片和详情显示。',
      personPhoto: '人物照片，用于卡片和详情显示。',
      companyLogo: '公司徽标，用于卡片和详情显示。'
    },
    importMediaFromUrlTitle: ({ label }: { label: string }) => `从链接导入${label}`,
    importMediaFromUrlDescription: ({ label }: { label: string }) =>
      `输入图片 URL 以导入${label}。`,
    imageUrlLabel: '图片链接',
    imageUrlInvalid: '请输入有效的 URL',
    imageFormatsHint: '支持 JPG、PNG、WebP 等常见图片格式。',
    previewLabel: '预览：',
    previewLoadFailed: '无法加载预览',
    importing: '导入中…',
    searchMediaTitle: ({ label }: { label: string }) => `搜索${label}`,
    searchKeywordPlaceholder: '输入搜索关键词…',
    searchStartHint: '点击搜索开始',
    searchFailedHint: '搜索失败',
    searchNoImages: '未找到相关图片',
    confirmSelection: '确认选择',
    cropMediaTitle: ({ label }: { label: string }) => `裁剪${label}`,
    cropFailed: '裁剪失败',

    updateMetadataTitle: '更新元数据',
    batchUpdateMetadataTitle: '批量更新元数据',
    batchSelectedCount: ({ count, label }: { count: number; label: string }) =>
      `${count} 个${label}`,
    scraperConfigLabel: '刮削器配置',
    updateFieldsLabel: '更新项',
    selectAll: '全选',
    selectNone: '全不选',
    scalarStrategyLabel: '单值策略',
    scalarStrategyPlaceholder: '选择单值策略…',
    scalarStrategyIfMissing: '仅缺失时写入',
    scalarStrategyOverwrite: '覆盖现有值',
    scalarStrategyIfMissingHint: '仅在当前值缺失时写入新值。',
    scalarStrategyOverwriteHint: '如存在可用新值，则覆盖当前值。',
    collectionStrategyLabel: '集合策略',
    collectionStrategyPlaceholder: '选择集合策略…',
    collectionStrategyMerge: '合并追加',
    collectionStrategyReplace: '整体替换',
    collectionStrategyMergeHint: '保留现有内容，并追加新增内容。',
    collectionStrategyReplaceHint: '以新内容整体替换当前内容。',
    useExternalIdsLabel: '使用当前外部 ID 辅助定位',
    useExternalIdsHint: '若当前条目可能对应错误目标，请勿启用此项。',
    personStandaloneHint: '「人物」可作为独立项单独勾选更新。',
    batchSilentSearchHint: '将基于「原名」执行静默检索，并默认采用首个结果，再复用单体更新流程。',
    rendererSearchHint: '检索流程仍在 renderer 侧执行，提交时仅发送一次更新请求。',
    updating: '更新中…',
    update: '更新',
    startUpdateFailed: '启动更新失败',
    startBatchUpdateFailed: '启动批量更新失败',

    deleteRelatedOption: ({ items }: { items: string }) => `同时删除关联的 ${items}`,
    andMoreCount: ({ count }: { count: number }) => `…等 ${count} 项`,
    addToScannerIgnoreFolder: ({ name }: { name: string }) =>
      `将文件夹「${name}」加入扫描器忽略列表`,
    addToScannerIgnoreName: ({ name }: { name: string }) => `将「${name}」加入扫描器忽略列表`,

    newCollection: '新建合集',
    editCollection: '编辑合集',
    collectionNamePlaceholder: '输入合集名称',
    coverLabel: '封面',
    pickCover: '选择封面',
    collectionDescriptionPlaceholder: '添加描述（可选，支持 Markdown）',
    collectionTypeLabel: '类型',
    collectionTypeHint: '静态合集手动添加内容，动态合集根据筛选条件自动更新。',
    staticCollection: '静态合集',
    dynamicCollection: '动态合集',
    nsfwLabel: '成人内容',
    collectionNsfwHint: '标记此合集包含成人内容。',
    collectionUpdated: '合集已更新',
    collectionCreated: '合集已创建',
    collectionCreatedWithEntities: ({ label }: { label: string }) => `已创建合集并添加${label}`,
    itemEntityLabel: '项目',
    convertToStaticTitle: '转换为静态合集',
    convertToStaticDescriptionWithCount: ({ count }: { count: number }) =>
      `此操作将把动态合集转换为静态合集，当前筛选结果（共 ${count} 项）将被固化为合集内容。转换后，合集内容将不再随数据变化自动更新。`,
    convertToStaticDescription:
      '此操作将把动态合集转换为静态合集。转换后，合集内容将不再自动更新。',
    converting: '转换中…',
    confirmConvert: '确认转换',
    convertedToStatic: '已转换为静态合集',
    convertFailed: '转换失败',
    dynamicConfigTitle: '动态筛选配置',
    enabledTypesCount: ({ count }: { count: number }) => `已启用 ${count} 个类型`,
    filterLabel: '筛选',
    sortLabel: '排序：',
    sortAsc: '升序',
    sortDesc: '降序',
    dynamicConfigHint: '已启用但未设置筛选条件的类型将包含该类型的全部项目。',
    filterConfigUpdated: '筛选配置已更新',

    gameLabel: '游戏',
    characterLabel: '角色',
    personLabel: '人物',
    companyLabel: '公司',
    tagLabel: '标签',
    relationTypeLabel: '关系类型',
    selectTypePlaceholder: '选择类型',
    characterRoleLabel: '角色类型',
    personRoleLabel: '人物类型',
    companyRoleLabel: '公司类型',
    creditRoleLabel: '职位',

    linkLabels: {
      game: '游戏关联',
      character: '角色关联',
      person: '人物关联',
      company: '公司关联',
      tag: '标签关联',
      link: '链接',
      externalId: '外部 ID'
    }
  },

  pages: {
    libraryTitle: '媒体库',
    globalSearch: '全局搜索',
    showcaseTitle: '陈列柜',
    manageSections: '管理区块',
    collectionsTitle: '合集',
    newCollection: '新建合集',
    collectionsEmptyTitle: '暂无合集',
    collectionsEmptyDescription: '创建合集来整理你的媒体库。',
    favoritesTitle: '喜欢',
    favoritesEmpty: ({ label }: { label: string }) => `暂无喜欢的${label}。`,
    uncategorizedTitle: ({ label }: { label: string }) => `未分类${label}`,
    uncategorizedEmpty: ({ label }: { label: string }) => `所有${label}都已分类。`,
    dynamicCollection: '动态合集',
    playStatus: '游玩状态'
  },

  explorer: {
    filter: '筛选',
    sort: '排序',
    sortAsc: '升序',
    sortDesc: '降序',
    overrideCollectionSort: '覆盖合集内排序',
    searchPlaceholder: '搜索…',
    filteredResults: '筛选结果',
    noMatch: '无匹配结果。',
    emptyList: ({ label }: { label: string }) => `暂无${label}。`,
    uncategorized: '未分类'
  },

  search: {
    title: '库搜索',
    description: '搜索游戏、角色、人物和公司',
    placeholder: '搜索游戏、角色、人物、公司…',
    typeToSearch: '输入关键词搜索。',
    emptyResult: ({ label }: { label: string }) => `无${label}结果。`,
    navigate: '导航',
    select: '选择',
    totalResults: ({ count }: { count: number }) => `共 ${count} 条结果`
  },

  showcase: {
    emptyTitle: '陈列柜为空',
    emptyDescription:
      '添加区块来展示你的游戏、角色、人物或公司。每个区块可以有独立的筛选条件和布局。',
    addFirstSection: '添加第一个区块',
    sectionEmpty: ({ label }: { label: string }) => `暂无${label}。`,
    layoutHorizontal: '横向滚动',
    layoutGrid: '网格',

    manage: {
      title: '管理区块',
      empty: '暂无区块，点击下方按钮添加。',
      unnamed: '未命名',
      show: '显示',
      hide: '隐藏',
      addSection: '添加区块',
      selectPresets: '选择预设',
      sectionEntityLabel: '区块',
      saved: '已保存。',
      saveFailed: '保存失败，请重试。'
    },

    form: {
      addTitle: '添加区块',
      editTitle: '编辑区块',
      titleRequired: '请输入区块标题。',
      title: '标题',
      titlePlaceholder: '输入区块标题…',
      entityType: '实体类型',
      layout: '布局',
      openMode: '打开方式',
      openModePage: '页面',
      openModeDialog: '弹窗',
      cardSize: '卡片大小',
      cardSizeXs: '超小',
      cardSizeSm: '小',
      cardSizeMd: '中',
      cardSizeLg: '大',
      cardSizeXl: '超大',
      displayCount: '显示数量',
      displayCountUnlimited: '不限',
      sort: '排序',
      sortAsc: '升序',
      sortDesc: '降序',
      filters: '筛选条件',
      filtersSetCount: ({ count }: { count: number }) => `已设置 ${count} 个条件`,
      filtersClickToSet: '点击设置筛选条件…'
    },

    presetsDialog: {
      title: '选择预设区块',
      empty: '暂无可用预设。',
      addWithCount: ({ count }: { count: number }) => `添加 (${count})`
    },

    presets: {
      recentlyPlayed: { name: '最近游玩', description: '按最后活跃时间排序的游戏' },
      topRated: { name: '高分游戏', description: '按评分排序的游戏' },
      recentlyAdded: { name: '最新添加', description: '按添加时间排序的游戏' },
      allGames: { name: '全部游戏', description: '库中的全部游戏' },
      favoriteGames: { name: '喜欢的游戏', description: '已红心的游戏' },
      favoriteCharacters: { name: '喜欢的角色', description: '已红心的角色' },
      favoritePersons: { name: '喜欢的人物', description: '已红心的人物' },
      favoriteCompanies: { name: '喜欢的公司', description: '已红心的公司' },
      allCollections: { name: '全部合集', description: '库中的全部合集' },
      allTags: { name: '全部标签', description: '库中的全部标签' }
    }
  }
} satisfies Messages['library']
