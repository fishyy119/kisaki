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
    empty: '暫無設定'
  },
  presetDialog: {
    title: '選擇預設設定',
    empty: '暫無可用預設',
    searchProvider: ({ id }: { id: string }) => `搜尋：${id}`,
    addWithCount: ({ count }: { count: number }) => `新增（${count}）`
  },
  presets: {
    visualNovel: {
      name: '視覺小說',
      description: '適合取得視覺小說的中文中繼資料'
    },
    videoGame: {
      name: '電子遊戲',
      description: '適合電子遊戲的通用預設'
    },
    anime: {
      name: '動漫',
      description: '以 Bangumi 元資料為主，由 TMDB 補齊圖片（TMDB 需自備 API Key）'
    }
  },

  profiles: {
    manageTitle: '刮削設定管理',
    emptyProfiles: '暫無設定，點選下方按鈕新增',
    unnamed: '（未命名）',
    searchProviderValue: ({ label }: { label: string }) => `搜尋：${label}`,
    addProfile: '新增設定',
    choosePreset: '選擇預設',
    profileEntityLabel: '設定',
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
