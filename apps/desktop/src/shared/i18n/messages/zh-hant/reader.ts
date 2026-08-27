import type { Messages } from '@shared/i18n'

/** Reader window: the comic pager and the novel text engine share one shell. */
export const reader = {
  loading: '正在開啟…',
  loadFailed: '無法開啟閱讀器',
  close: '關閉',

  chrome: {
    navigation: '導覽',
    enterFullScreen: '全螢幕'
  },

  panel: {
    outline: '目錄',
    pages: '頁面',
    marks: '標記',
    search: '搜尋',
    outlineHeading: '本單元內',
    noPages: '該單元沒有可預覽的頁面'
  },

  search: {
    open: '書內搜尋',
    placeholder: '書內搜尋',
    noResults: '沒有相符結果',
    unnamedSection: '未命名章節',
    tooMany: ({ count }: { count: number }) => `僅顯示前 ${count} 筆相符——請縮小搜尋範圍`
  },

  footnote: {
    title: '註釋'
  },

  marks: {
    addBookmark: '書籤',
    highlight: '螢光標記',
    copy: '複製',
    dismiss: '關閉',
    edit: '編輯標記',
    color: '螢光顏色',
    notePlaceholder: '備註',
    saveNote: '儲存',
    remove: '刪除',
    empty: '還沒有標記',
    bookmarksHeading: '書籤',
    highlightsHeading: '螢光標記',
    page: ({ page }: { page: number }) => `第 ${page} 頁`,
    bookmarkAdded: '已新增書籤',
    bookmarkRemoved: '已移除書籤',
    failed: '無法儲存該標記'
  },

  /** Bare setting readouts, shared by every reader surface that shows one. */
  values: {
    percent: ({ value }: { value: number }) => `${value}%`,
    pixels: ({ value }: { value: number }) => `${value} px`,
    ratio: ({ value }: { value: number }) => value.toFixed(1),
    em: ({ value }: { value: number }) => `${value} em`
  },

  progress: {
    pageOf: ({ page, total }: { page: number; total: number | null }) =>
      total === null ? `${page} / ?` : `${page} / ${total}`,
    jumpToPage: '跳至頁面',
    jump: '跳轉',
    elapsed: ({ minutes }: { minutes: number }) => `${minutes} 分鐘`
  },

  typography: {
    open: '排版',
    font: '字型',
    fontBook: '書籍內建',
    fontSerif: '襯線',
    fontSans: '無襯線',
    fontCustom: '自訂',
    customFont: '字型名稱',
    fontPick: '選擇字型',
    fontSearch: '搜尋字型',
    fontSize: '文字大小',
    lineHeight: '行高',
    paragraphSpacing: '段落間距',
    textWidth: '欄寬',
    twoColumns: '雙欄',
    justify: '左右對齊',
    writingMode: '排版方向',
    writingModeBook: '跟隨書籍',
    writingModeVertical: '直排',
    writingModeHorizontal: '橫排',
    tint: '頁面底色',
    tintTheme: '跟隨主題',
    tintPaper: '紙感',
    tintSepia: '護眼',
    reset: '重設排版'
  },

  units: {
    comicLabel: '單元',
    novelLabel: '卷',
    previous: '上一單元',
    next: '下一單元',
    endOfUnit: '本單元結束',
    lastUnit: '已是最後一個單元',
    readBadge: '已讀',
    noFile: '該單元沒有可讀取的檔案',
    openFailed: '無法開啟該單元',
    nextUnitHint: '已到結尾——繼續閱讀下一單元'
  },

  image: {
    settingsOpen: '頁面設定',
    pageFlow: '翻頁方向',
    pageFlowRtl: '從右到左',
    pageFlowLtr: '從左到右',
    pageFlowVertical: '垂直捲動',
    pageLayout: '頁面版面',
    layoutSingle: '單頁',
    layoutDouble: '雙頁',
    coverAlone: '封面單獨成頁',
    fit: '符合方式',
    fitPage: '符合頁面',
    fitWidth: '符合寬度',
    fitHeight: '符合高度',
    zoomIn: '放大',
    zoomOut: '縮小',
    brightness: '亮度',
    contrast: '對比',
    autoCrop: '裁去頁面白邊',
    reset: '重設頁面設定',
    pageLoadFailed: '無法載入該頁',
    emptyPages: '該檔案沒有可讀取的頁面'
  },

  shortcuts: {
    open: '鍵盤快速鍵',
    title: '鍵盤快速鍵',
    turnPage: '翻頁',
    switchUnit: '上一個或下一個單元',
    jumpEdges: '首頁或末頁',
    jumpToPage: '跳至頁面',
    zoom: '放大、縮小或還原',
    ctrlWheel: 'Ctrl+滾輪',
    search: '書內搜尋',
    bookmark: '為目前位置加書籤',
    navigation: '開關導覽',
    fullScreen: '開關全螢幕',
    closeReader: '關閉閱讀器'
  }
} satisfies Messages['reader']
