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
    noFile: 'このユニットには読み込めるファイルがありません',
    unsupportedFile: '内蔵リーダーではこのファイル形式を表示できません'
  },

  comic: {
    pageFlow: 'ページ送り',
    pageFlowRtl: '右から左',
    pageFlowLtr: '左から右',
    pageFlowVertical: '縦スクロール',
    fitWidth: '幅に合わせる',
    fitHeight: '高さに合わせる',
    pageLoadFailed: 'このページを読み込めませんでした',
    emptyPages: 'このファイルには読み込めるページがありません',
    nextChapterHint: '最後に到達しました——次のユニットへ進む'
  },

  novel: {
    progress: ({ percent }: { percent: number }) => `${percent}%`,
    toc: '目次',
    emptyToc: '目次がありません',
    fontSize: '文字サイズ',
    fontSizeDecrease: '文字を小さく',
    fontSizeIncrease: '文字を大きく',
    openFailed: 'この巻を開けませんでした',
    location: '位置'
  },

  shortcuts: {
    title: 'キーボードショートカット',
    turnPage: 'ページをめくる',
    switchUnit: 'ユニットを切り替える',
    toggleToolbar: 'ツールバーの表示/非表示'
  }
}
