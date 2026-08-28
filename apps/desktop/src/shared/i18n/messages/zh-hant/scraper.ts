import type { Messages } from '../schema'

export const scraper = {
  providerSelect: {
    placeholder: '選擇提供者…',
    empty: '暫無可用提供者',
    unavailable: '不可用',
    unsupported: '不支援'
  },
  profileSelect: {
    placeholder: '選擇刮削設定',
    empty: '暫無設定',
    none: '不使用刮削設定'
  },
  recipes: {
    gameVisualNovel: {
      name: '視覺小說',
      description: '以 VNDB 目錄為主幹，中文事實與美術圍繞補齊'
    },
    gameVideoGame: {
      name: '電子遊戲',
      description: '覆蓋面最廣的遊戲中繼資料，全部美術欄位由 SteamGridDB 領跑'
    },
    anime: {
      name: '動畫',
      description: '按季拆分的動畫條目，包含劇集、聲優與完整美術'
    },
    comic: {
      name: '漫畫',
      description: '漫畫中繼資料，逐卷封面來自 MangaDex'
    },
    novelLightNovel: {
      name: '輕小說',
      description: '輕小說中繼資料，包含分卷、角色與封面'
    },
    novelFiction: {
      name: '通俗小說',
      description: '通用書目資料，自帶跨來源識別碼並按 ISBN 對齊'
    },
    person: {
      name: '人物',
      description: '工作人員、作者與聲優，含肖像'
    },
    company: {
      name: '公司',
      description: '工作室、出版社與品牌，含 Logo'
    },
    character: {
      name: '角色',
      description: '角色資料，含立繪與聲優出演'
    }
  },
  newProfile: {
    pathTitle: '建立設定',
    confirmTitle: '確認新設定',
    paths: {
      recipes: '推薦場景',
      provider: '單一資料來源',
      blank: '空白'
    },
    recipesHint: '按場景策展的推薦組合，提供者與排序隨所選內容語言變化',
    blankHint: '選擇搜尋來源，所有欄位從空白開始',
    providerMissing: '未安裝',
    recipeUnavailable: '該場景目前沒有可用的搜尋來源',
    noRecipes: '該媒體類型暫無推薦場景',
    previewTitle: '產生的欄位',
    previewEmpty: '目前的提供者無法填充任何欄位'
  },
  recipeUpdate: {
    badge: '有更新建議',
    title: '推薦設定已變化',
    hint: '該場景的目前推薦與此設定不同。套用後將覆蓋搜尋來源、語言與欄位設定。',
    beforeLabel: '目前',
    afterLabel: '建議',
    apply: '套用建議',
    dismiss: '忽略此建議',
    emptySlot: '（空）',
    systemLocale: '系統語言',
    ignoredNotice: '在推薦再次變化前保持忽略'
  },

  profiles: {
    manageTitle: '刮削設定管理',
    emptyProfiles: '暫無設定，點選下方按鈕新增',
    unnamed: '（未命名）',
    addProfile: '新增設定',
    profileEntityLabel: '設定',
    deleteUsedByScanners: ({ count }: { count: number }) =>
      `${count} 個掃描器正在使用該設定，刪除後它們將不再刮削、直接匯入。`,
    newTitleMediaType: '選擇媒體類型',
    newTitleProvider: '選擇主要提供者',
    newMediaTypeHint: '選擇要建立設定的媒體類型',
    newProviderHint: '選擇一個主要的資料提供者作為預設設定的基礎',
    noProvidersAvailable: '暫無可用的提供者',
    itemTitleAdd: '新增設定',
    itemTitleEdit: '編輯設定',
    nameLabel: '設定名稱',
    namePlaceholder: '例如：視覺小說',
    idLabel: '設定 ID',
    copyIdTooltip: '複製設定 ID',
    idCopied: '設定 ID 已複製',
    mediaTypeLabel: '媒體類型',
    selectMediaType: '選擇媒體類型',
    searchProviderLabel: '搜尋提供者',
    defaultLanguageLabel: '預設語言',
    defaultLanguageHint:
      '用於實體解析和未單獨指定的擷取語言。單一槽位提供者可覆寫擷取語言，但不會影響實體解析。若未指定，將使用系統語言。',
    slotsLabel: '槽位設定',
    slotsHint: '點選槽位設定資料來源和結果策略',
    providerCount: ({ count }: { count: number }) => `${count} 個提供者`,
    slots: {
      info: '基本資訊',
      tags: '標籤',
      seasons: '分季',
      episodes: '分集',
      chapters: '單元',
      volumes: '分卷',
      characters: '角色',
      persons: '人物',
      companies: '公司',
      relatedEntries: '關聯條目',
      covers: '封面',
      backdrops: '背景圖',
      logos: '標誌',
      icons: '圖示',
      photos: '照片'
    },
    slotDialogTitle: ({ name }: { name: string }) => `設定：${name}`,
    strategyLabel: '策略',
    strategyHint: '多個提供者回傳資料時的處理方式',
    selectStrategy: '選擇策略',
    strategyFirst: '首個',
    strategyEnrich: '增強',
    strategyFirstHint: '使用第一個有效結果，忽略後續來源',
    strategyEnrichHint: '以首個結果為基準，補全缺漏欄位',
    unmatchedLabel: '未匹配實體',
    unmatchedHint: '是否附加後續資料來源的未匹配實體',
    selectUnmatched: '選擇未匹配實體策略',
    unmatchedIgnore: '忽略未匹配項',
    unmatchedAppend: '附加未匹配項',
    unmatchedIgnoreHint: '只補全已匹配實體，新的未匹配實體會被捨棄',
    unmatchedAppendHint: '未匹配實體會被附加，並可繼續被後續來源補全',
    providersLabel: '資料提供者',
    providersHint: '選擇為此槽位提供資料的來源，可調整優先順序',
    noProviders: '暫無提供者',
    languageLabel: '語言：',
    languageDefaultPlaceholder: '預設',
    addProviderPlaceholder: '新增提供者…'
  }
} satisfies Messages['scraper']
