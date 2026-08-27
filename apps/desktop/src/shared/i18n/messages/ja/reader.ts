import type { Messages } from '@shared/i18n'

/** Reader window: the comic pager and the novel text engine share one shell. */
export const reader = {
  loading: '開いています…',
  loadFailed: 'リーダーを開けませんでした',
  close: '閉じる',

  chrome: {
    navigation: 'ナビゲーション',
    enterFullScreen: '全画面'
  },

  panel: {
    outline: '目次',
    pages: 'ページ',
    marks: 'マーク',
    search: '検索',
    outlineHeading: 'このユニット内',
    noPages: 'このユニットにはプレビューできるページがありません'
  },

  search: {
    open: '本文を検索',
    placeholder: '本文を検索',
    noResults: '一致するものがありません',
    unnamedSection: '無題のセクション',
    tooMany: ({ count }: { count: number }) =>
      `先頭 ${count} 件のみ表示しています——検索語を絞ってください`
  },

  footnote: {
    title: '注'
  },

  marks: {
    addBookmark: 'しおり',
    highlight: 'ハイライト',
    copy: 'コピー',
    dismiss: '閉じる',
    edit: 'マークを編集',
    color: 'ハイライトの色',
    notePlaceholder: 'メモ',
    saveNote: '保存',
    remove: '削除',
    empty: 'マークはまだありません',
    bookmarksHeading: 'しおり',
    highlightsHeading: 'ハイライト',
    page: ({ page }: { page: number }) => `${page} ページ`,
    bookmarkAdded: 'しおりを追加しました',
    bookmarkRemoved: 'しおりを削除しました',
    failed: 'マークを保存できませんでした'
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
    jumpToPage: 'ページへ移動',
    jump: '移動',
    elapsed: ({ minutes }: { minutes: number }) => `${minutes} 分`
  },

  typography: {
    open: '組版',
    font: 'フォント',
    fontBook: '書籍のフォント',
    fontSerif: '明朝',
    fontSans: 'ゴシック',
    fontCustom: 'カスタム',
    customFont: 'フォント名',
    fontPick: 'フォントを選択',
    fontSearch: 'フォントを検索',
    fontSize: '文字サイズ',
    lineHeight: '行間',
    paragraphSpacing: '段落間隔',
    textWidth: '段の幅',
    twoColumns: '2段組み',
    justify: '両端揃え',
    writingMode: '組み方向',
    writingModeBook: '書籍に従う',
    writingModeVertical: '縦書き',
    writingModeHorizontal: '横書き',
    tint: 'ページの地色',
    tintTheme: 'テーマに従う',
    tintPaper: '紙',
    tintSepia: 'セピア',
    reset: '組版をリセット'
  },

  units: {
    comicLabel: 'ユニット',
    novelLabel: '巻',
    previous: '前のユニット',
    next: '次のユニット',
    endOfUnit: 'このユニットの終わり',
    lastUnit: 'これが最後のユニットです',
    readBadge: '既読',
    noFile: 'このユニットには読み込めるファイルがありません',
    openFailed: 'このユニットを開けませんでした',
    nextUnitHint: '最後に到達しました——次のユニットへ進む'
  },

  image: {
    settingsOpen: 'ページ設定',
    pageFlow: 'ページ送り',
    pageFlowRtl: '右から左',
    pageFlowLtr: '左から右',
    pageFlowVertical: '縦スクロール',
    pageLayout: 'ページ構成',
    layoutSingle: '単ページ',
    layoutDouble: '見開き',
    coverAlone: '表紙を単独で表示',
    fit: 'フィット',
    fitPage: 'ページに合わせる',
    fitWidth: '幅に合わせる',
    fitHeight: '高さに合わせる',
    zoomIn: '拡大',
    zoomOut: '縮小',
    brightness: '明るさ',
    contrast: 'コントラスト',
    autoCrop: '余白を切り取る',
    reset: 'ページ設定をリセット',
    pageLoadFailed: 'このページを読み込めませんでした',
    emptyPages: 'このファイルには読み込めるページがありません'
  },

  shortcuts: {
    open: 'キーボードショートカット',
    title: 'キーボードショートカット',
    turnPage: 'ページをめくる',
    switchUnit: '前後のユニット',
    jumpEdges: '最初・最後のページ',
    jumpToPage: 'ページへ移動',
    zoom: '拡大・縮小・等倍',
    ctrlWheel: 'Ctrl+ホイール',
    search: '本文を検索',
    bookmark: '現在の位置にしおり',
    navigation: 'ナビゲーションの切り替え',
    fullScreen: '全画面の切り替え',
    closeReader: 'リーダーを閉じる'
  }
} satisfies Messages['reader']
