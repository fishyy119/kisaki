import type { Messages } from '../schema'

export const ui = {
  stateView: {
    errorTitle: '載入失敗'
  },
  combobox: {
    noMatches: '找不到符合項目',
    create: ({ name }: { name: string }) => `建立「${name}」`
  },
  imagePicker: {
    picked: '已選擇：',
    pick: '選擇圖片',
    clear: '清除'
  },
  imageCropper: {
    title: '裁切圖片',
    recommendedRatio: ({ ratio }: { ratio: string }) => `建議比例：${ratio}`,
    fixedRatio: ({ ratio }: { ratio: string }) => `固定比例：${ratio}`,
    lockRatio: '鎖定比例',
    freeCrop: '自由裁切',
    cropArea: ({ width, height }: { width: number; height: number }) =>
      `裁切區域：${width} × ${height} px`,
    confirm: '確認裁切'
  },
  markdown: {
    editorTitle: '編輯 Markdown',
    previewTitle: '預覽',
    toolbar: {
      bold: '粗體',
      italic: '斜體',
      strikethrough: '刪除線',
      inlineCode: '行內程式碼',
      codeBlock: '程式碼區塊',
      link: '連結',
      imageSyntax: '圖片語法',
      heading1: '一級標題',
      heading2: '二級標題',
      quote: '引用',
      bulletedList: '無序清單',
      numberedList: '有序清單',
      taskList: '任務清單',
      table: '表格',
      footnote: '註腳',
      attachImage: '附加圖片',
      preview: '預覽',
      fullscreen: '全螢幕',
      exitFullscreen: '退出全螢幕'
    }
  },
  partialDate: {
    yearPlaceholder: '年',
    monthPlaceholder: '月',
    dayPlaceholder: '日',
    invalidInteger: '日期只能填寫整數',
    yearDayWithoutMonth: '填寫了年份和日期時，必須同時填寫月份'
  },
  rankingList: {
    expandTitle: '排行',
    viewAll: ({ count }: { count: number }) => `檢視全部 ${count} 項`
  },
  charts: {
    day: '日',
    week: '週',
    month: '月',
    hourly: '小時',
    weekday: '星期',
    dayOfMonth: '日期',
    duration: '時長',
    noActivity: '無活動',
    legendLess: '少',
    legendMore: '多',
    peak: ({ label, value }: { label: string; value: string }) => `峰值：${label}，${value}`,
    peakNone: '峰值：無活動',
    mostActive: ({ label, value }: { label: string; value: string }) =>
      `最活躍：${label}，${value}`,
    mostActiveNone: '最活躍：無活動'
  },
  deleteConfirm: {
    deleteTitle: ({ label }: { label: string }) => `確認刪除${label}？`,
    removeTitle: ({ label }: { label: string }) => `確認移除${label}？`,
    removeNamedDescription: ({ name }: { name: string }) => `確定要移除「${name}」嗎？`,
    removeDescription: ({ label }: { label: string }) => `確定要移除此${label}嗎？`,
    deleteNamedDescription: ({ name, label }: { name: string; label: string }) =>
      `確定要刪除「${name}」嗎？此操作無法復原，${label}資料將被永久刪除。`,
    deleteDescription: ({ label }: { label: string }) => `此操作無法復原，${label}資料將被永久刪除`,
    removing: '移除中…',
    deleting: '刪除中…'
  },
  spoiler: {
    title: '顯示劇透？',
    description: '開啟後將立即顯示被標記為劇透的內容'
  }
} satisfies Messages['ui']
