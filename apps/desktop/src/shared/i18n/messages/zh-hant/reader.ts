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
    noFile: '該單元沒有可讀取的檔案',
    unsupportedFile: '內建閱讀器無法顯示該檔案格式'
  },

  comic: {
    pageFlow: '翻頁方向',
    pageFlowRtl: '從右到左',
    pageFlowLtr: '從左到右',
    pageFlowVertical: '垂直捲動',
    fitWidth: '符合寬度',
    fitHeight: '符合高度',
    pageLoadFailed: '無法載入該頁',
    emptyPages: '該檔案沒有可讀取的頁面',
    nextChapterHint: '已到結尾——繼續閱讀下一單元'
  },

  novel: {
    progress: ({ percent }: { percent: number }) => `${percent}%`,
    toc: '目錄',
    emptyToc: '沒有目錄',
    fontSize: '字級',
    fontSizeDecrease: '縮小文字',
    fontSizeIncrease: '放大文字',
    openFailed: '無法開啟該卷',
    location: '位置'
  },

  shortcuts: {
    title: '鍵盤快速鍵',
    turnPage: '翻頁',
    switchUnit: '切換單元',
    toggleToolbar: '顯示/隱藏工具列'
  }
}
