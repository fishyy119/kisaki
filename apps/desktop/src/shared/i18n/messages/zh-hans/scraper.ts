import type { Messages } from '../schema'

export const scraper = {
  providerSelect: {
    placeholder: '选择提供者…',
    empty: '暂无可用提供者',
    unavailable: '不可用',
    unsupported: '不支持'
  },
  profileSelect: {
    placeholder: '选择刮削配置',
    empty: '暂无配置',
    none: '不使用刮削配置'
  },
  recipes: {
    gameVisualNovel: {
      name: '视觉小说',
      description: '以 VNDB 目录为主干，中文事实与美术围绕补齐'
    },
    gameVideoGame: {
      name: '电子游戏',
      description: '覆盖面最广的游戏元数据，全部美术槽位由 SteamGridDB 领跑'
    },
    anime: {
      name: '动画',
      description: '按季拆分的动画条目，包含剧集、声优与完整美术'
    },
    comic: {
      name: '漫画',
      description: '漫画元数据，逐卷封面来自 MangaDex'
    },
    novelLightNovel: {
      name: '轻小说',
      description: '轻小说元数据，包含分卷、角色与封面'
    },
    novelFiction: {
      name: '通俗小说',
      description: '通用书目数据，自带跨源标识并按 ISBN 对齐'
    },
    person: {
      name: '人物',
      description: '工作人员、作者与声优，含肖像'
    },
    company: {
      name: '公司',
      description: '工作室、出版社与品牌，含 Logo'
    },
    character: {
      name: '角色',
      description: '角色资料，含立绘与声优出演'
    }
  },
  newProfile: {
    pathTitle: '创建配置',
    confirmTitle: '确认新配置',
    paths: {
      recipes: '推荐场景',
      provider: '单一数据源',
      blank: '空白'
    },
    recipesHint: '按场景策展的推荐组合，提供者与排序随所选内容语言变化',
    blankHint: '选择搜索源，所有槽位从空白开始',
    providerMissing: '未安装',
    recipeUnavailable: '该场景当前没有可用的搜索源',
    noRecipes: '该媒体类型暂无推荐场景',
    previewTitle: '生成的槽位',
    previewEmpty: '当前提供者无法填充任何槽位'
  },
  recipeUpdate: {
    badge: '有更新建议',
    title: '推荐配置已变化',
    hint: '该场景的当前推荐与此配置不同。应用后将覆盖搜索源与槽位设置。',
    beforeLabel: '当前',
    afterLabel: '建议',
    apply: '应用建议',
    dismiss: '忽略此建议',
    emptySlot: '（空）'
  },

  profiles: {
    manageTitle: '刮削配置管理',
    emptyProfiles: '暂无配置，点击下方按钮添加',
    unnamed: '（未命名）',
    addProfile: '添加配置',
    profileEntityLabel: '配置',
    deleteUsedByScanners: ({ count }: { count: number }) =>
      `${count} 个扫描器正在使用该配置，删除后它们将不再刮削、直接导入。`,
    newTitleEntityType: '选择实体类型',
    newTitleProvider: '选择主要提供者',
    newEntityTypeHint: '选择要创建配置的实体类型',
    newProviderHint: '选择一个主要的数据提供者作为默认配置的基础',
    noProvidersAvailable: '暂无可用的提供者',
    itemTitleAdd: '添加配置',
    itemTitleEdit: '编辑配置',
    nameLabel: '配置名称',
    namePlaceholder: '例如：视觉小说',
    copyId: '复制配置 ID',
    entityTypeLabel: '实体类型',
    selectEntityType: '选择实体类型',
    searchProviderLabel: '搜索提供者',
    defaultLanguageLabel: '默认语言',
    defaultLanguageHint:
      '用于实体解析和未单独指定的抓取语言。单个槽位提供者可覆盖抓取语言，但不会影响实体解析。若未指定，将使用系统语言。',
    slotsLabel: '槽位配置',
    slotsHint: '点击槽位配置数据来源和结果策略',
    providerCount: ({ count }: { count: number }) => `${count} 个提供者`,
    slots: {
      info: '基本信息',
      tags: '标签',
      seasons: '分季',
      episodes: '分集',
      chapters: '单元',
      volumes: '分卷',
      characters: '角色',
      persons: '人物',
      companies: '公司',
      relatedEntries: '关联条目',
      covers: '封面',
      backdrops: '背景图',
      logos: '徽标',
      icons: '图标',
      photos: '照片'
    },
    slotDialogTitle: ({ name }: { name: string }) => `配置：${name}`,
    strategyLabel: '策略',
    strategyHint: '多个提供者返回数据时的处理方式',
    selectStrategy: '选择策略',
    strategyFirst: '首个',
    strategyEnrich: '增强',
    strategyFirstHint: '使用第一个有效结果，忽略后续来源',
    strategyEnrichHint: '以首个结果为基准，补全缺失字段',
    unmatchedLabel: '未匹配实体',
    unmatchedHint: '是否追加后续数据源的未匹配实体',
    selectUnmatched: '选择未匹配实体策略',
    unmatchedIgnore: '忽略未匹配项',
    unmatchedAppend: '追加未匹配项',
    unmatchedIgnoreHint: '只补全已匹配实体，新的未匹配实体会被丢弃',
    unmatchedAppendHint: '未匹配实体会被追加，并可继续被后续来源补全',
    providersLabel: '数据提供者',
    providersHint: '选择为此槽位提供数据的来源，可调整优先级',
    noProviders: '暂无提供者',
    languageLabel: '语言：',
    languageDefaultPlaceholder: '默认',
    addProviderPlaceholder: '添加提供者…'
  }
} satisfies Messages['scraper']
