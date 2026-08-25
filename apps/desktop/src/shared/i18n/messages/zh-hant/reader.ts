import type { Messages } from '@shared/i18n'

/** Reader window: the comic pager and the novel text engine share one shell. */
export const reader = {
  loading: '正在開啟…',
  loadFailed: '無法開啟閱讀器',
  close: '關閉',

  units: {
    comicLabel: '單元',
    novelLabel: '卷',
    previous: '上一單元',
    next: '下一單元',
    endOfUnit: '本單元結束',
    lastUnit: '已是最後一個單元',
    readBadge: '已讀',
    noFile: '該單元沒有可讀取的檔案'
  },

  comic: {
    pageFlow: '翻頁方向',
    pageFlowRtl: '從右到左',
    pageFlowLtr: '從左到右',
    pageFlowVertical: '垂直捲動',
    spread: '跨頁顯示',
    coverAlone: '封面單獨成頁',
    fitWidth: '符合寬度',
    fitHeight: '符合高度',
    zoomIn: '放大',
    zoomOut: '縮小',
    pageLoadFailed: '無法載入該頁',
    emptyPages: '該檔案沒有可讀取的頁面',
    openFailed: '無法開啟該單元',
    nextUnitHint: '已到結尾——繼續閱讀下一單元'
  },

  novel: {
    progress: ({ percent }: { percent: number }) => `${percent}%`,
    toc: '目錄',
    emptyToc: '沒有目錄',
    fontSizeDecrease: '縮小文字',
    fontSizeIncrease: '放大文字',
    openFailed: '無法開啟該卷'
  },

  shortcuts: {
    open: '鍵盤快速鍵',
    title: '鍵盤快速鍵',
    turnPage: '翻頁',
    switchUnit: '上一個或下一個單元',
    jumpEdges: '首頁或末頁',
    zoom: '放大、縮小或還原',
    closeReader: '關閉閱讀器'
  }
} satisfies Messages['reader']
