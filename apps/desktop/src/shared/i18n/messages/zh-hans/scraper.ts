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
    empty: '暂无配置'
  },
  presetDialog: {
    title: '选择预设配置',
    empty: '暂无可用预设',
    searchProvider: ({ id }: { id: string }) => `搜索：${id}`,
    addWithCount: ({ count }: { count: number }) => `添加（${count}）`
  },
  presets: {
    visualNovel: {
      name: '视觉小说',
      description: '适合获取视觉小说的中文元数据'
    },
    videoGame: {
      name: '电子游戏',
      description: '适合电子游戏的通用预设'
    },
    anime: {
      name: '动漫',
      description: '以 Bangumi 元数据为主，由 TMDB 补齐图片（TMDB 需自备 API Key）'
    }
  },

  profiles: {
    manageTitle: '刮削配置管理',
    emptyProfiles: '暂无配置，点击下方按钮添加',
    unnamed: '（未命名）',
    searchProviderValue: ({ label }: { label: string }) => `搜索：${label}`,
    addProfile: '添加配置',
    choosePreset: '选择预设',
    profileEntityLabel: '配置',
    newTitleMediaType: '选择媒体类型',
    newTitleProvider: '选择主要提供者',
    newMediaTypeHint: '选择要创建配置的媒体类型',
    newProviderHint: '选择一个主要的数据提供者作为默认配置的基础',
    noProvidersAvailable: '暂无可用的提供者',
    itemTitleAdd: '添加配置',
    itemTitleEdit: '编辑配置',
    nameLabel: '配置名称',
    namePlaceholder: '例如：视觉小说',
    idLabel: '配置 ID',
    copyIdTooltip: '复制配置 ID',
    idCopied: '配置 ID 已复制',
    mediaTypeLabel: '媒体类型',
    selectMediaType: '选择媒体类型',
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
