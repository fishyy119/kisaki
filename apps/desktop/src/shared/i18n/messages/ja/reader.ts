import type { Messages } from '@shared/i18n'

/** Reader window: the comic pager and the novel text engine share one shell. */
export const reader = {
  loading: '開いています…',
  loadFailed: 'リーダーを開けませんでした',
  close: '閉じる',

  units: {
    comicLabel: 'ユニット',
    novelLabel: '巻',
    previous: '前のユニット',
    next: '次のユニット',
    endOfUnit: 'このユニットの終わり',
    lastUnit: 'これが最後のユニットです',
    readBadge: '既読',
    noFile: 'このユニットには読み込めるファイルがありません'
  },

  comic: {
    pageFlow: 'ページ送り',
    pageFlowRtl: '右から左',
    pageFlowLtr: '左から右',
    pageFlowVertical: '縦スクロール',
    spread: '見開き表示',
    coverAlone: '表紙を単独で表示',
    fitWidth: '幅に合わせる',
    fitHeight: '高さに合わせる',
    zoomIn: '拡大',
    zoomOut: '縮小',
    pageLoadFailed: 'このページを読み込めませんでした',
    emptyPages: 'このファイルには読み込めるページがありません',
    openFailed: 'このユニットを開けませんでした',
    nextUnitHint: '最後に到達しました——次のユニットへ進む'
  },

  novel: {
    progress: ({ percent }: { percent: number }) => `${percent}%`,
    toc: '目次',
    emptyToc: '目次がありません',
    fontSizeDecrease: '文字を小さく',
    fontSizeIncrease: '文字を大きく',
    openFailed: 'この巻を開けませんでした'
  },

  shortcuts: {
    open: 'キーボードショートカット',
    title: 'キーボードショートカット',
    turnPage: 'ページをめくる',
    switchUnit: '前後のユニット',
    jumpEdges: '最初・最後のページ',
    zoom: '拡大・縮小・等倍',
    closeReader: 'リーダーを閉じる'
  }
} satisfies Messages['reader']
