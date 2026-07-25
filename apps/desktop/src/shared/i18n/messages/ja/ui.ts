import type { Messages } from '../schema'

export const ui = {
  stateView: {
    errorTitle: '読み込み失敗'
  },
  combobox: {
    noMatches: '一致する項目がありません。',
    create: ({ name }: { name: string }) => `「${name}」を作成`
  },
  imagePicker: {
    picked: '選択済み：',
    pick: '画像を選択',
    clear: 'クリア'
  },
  imageCropper: {
    title: '画像を切り抜く',
    recommendedRatio: ({ ratio }: { ratio: string }) => `推奨比率：${ratio}`,
    fixedRatio: ({ ratio }: { ratio: string }) => `固定比率：${ratio}`,
    lockRatio: '比率を固定',
    freeCrop: '自由切り抜き',
    cropArea: ({ width, height }: { width: number; height: number }) =>
      `切り抜き範囲：${width} × ${height} px`,
    confirm: '切り抜く'
  },
  markdown: {
    editorTitle: 'Markdown を編集',
    previewTitle: 'プレビュー',
    toolbar: {
      bold: '太字',
      italic: '斜体',
      strikethrough: '取り消し線',
      inlineCode: 'インラインコード',
      codeBlock: 'コードブロック',
      link: 'リンク',
      imageSyntax: '画像構文',
      heading1: '見出し 1',
      heading2: '見出し 2',
      quote: '引用',
      bulletedList: '箇条書きリスト',
      numberedList: '番号付きリスト',
      taskList: 'タスクリスト',
      table: '表',
      footnote: '脚注',
      attachImage: '画像を添付',
      preview: 'プレビュー',
      fullscreen: '全画面',
      exitFullscreen: '全画面を終了'
    }
  },
  partialDate: {
    yearPlaceholder: '年',
    monthPlaceholder: '月',
    dayPlaceholder: '日',
    invalidInteger: '日付には整数のみ入力できます。',
    yearDayWithoutMonth: '年と日を入力した場合は、月も入力してください。'
  },
  rankingList: {
    expandTitle: 'ランキング',
    viewAll: ({ count }: { count: number }) => `全 ${count} 件を表示`
  },
  charts: {
    day: '日',
    week: '週',
    month: '月',
    hourly: '時間帯',
    weekday: '曜日',
    dayOfMonth: '日付',
    duration: 'プレイ時間',
    noActivity: '活動なし',
    legendLess: '少',
    legendMore: '多',
    peak: ({ label, value }: { label: string; value: string }) => `ピーク：${label}、${value}`,
    peakNone: 'ピーク：活動なし',
    mostActive: ({ label, value }: { label: string; value: string }) =>
      `最も活発：${label}、${value}`,
    mostActiveNone: '最も活発：活動なし'
  },
  deleteConfirm: {
    deleteTitle: ({ label }: { label: string }) => `${label}を削除しますか？`,
    removeTitle: ({ label }: { label: string }) => `${label}を取り除きますか？`,
    removeNamedDescription: ({ name }: { name: string }) => `「${name}」を取り除きますか？`,
    removeDescription: ({ label }: { label: string }) => `この${label}を取り除きますか？`,
    deleteNamedDescription: ({ name, label }: { name: string; label: string }) =>
      `「${name}」を削除しますか？この操作は取り消せず、${label}のデータは完全に削除されます。`,
    deleteDescription: ({ label }: { label: string }) =>
      `この操作は取り消せず、${label}のデータは完全に削除されます。`,
    removing: '取り除いています…',
    deleting: '削除しています…'
  },
  spoiler: {
    title: 'ネタバレを表示しますか？',
    description: '有効にすると、ネタバレとしてマークされたコンテンツが直ちに表示されます。'
  }
} satisfies Messages['ui']
