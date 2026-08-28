import type { VndbMessages } from '../index'

export const ja: VndbMessages = {
  errors: {
    tokenInvalid: 'VNDB が API トークンを拒否しました。VNDB 拡張設定で確認してください。',
    tokenRequired: 'VNDB の API トークンを入力してください',
    notFound: 'その VNDB エントリは存在しません',
    rateLimited: 'VNDB へのリクエストが多すぎます。しばらくしてから再試行してください。',
    rejected: 'VNDB API がリクエストを拒否しました',
    unavailable: 'VNDB API は一時的に利用できません',
    networkFailed: 'VNDB API のネットワークリクエストに失敗しました',
    operationCancelled: '操作はキャンセルされました',
    baseUrlInvalid: 'http または https のアドレスを入力してください',
    idInvalid: ({ value }) => `「${value}」は有効な VNDB ID ではありません`,
    listPermissionMissing:
      'この VNDB トークンではリストを読み取れません。listread と listwrite の権限を持つトークンを作成してください。',
    operationRunning: 'VNDB リストの操作が既に実行中です。完了までお待ちください。'
  },

  sync: {
    autoSyncFailedTitle: 'VNDB 同期に失敗しました',
    autoSyncFailedFallback: '変更を VNDB に送信できませんでした',
    pushTaskTitle: 'ライブラリを VNDB リストへ送信',
    pushSummary: ({ pushed, skipped, failed }) =>
      `送信 ${pushed} 件、スキップ ${skipped} 件、失敗 ${failed} 件`
  },

  import: {
    taskTitle: 'VNDB リストをインポート',
    phaseRead: 'VNDB リストを読み込み中',
    phaseApply: 'リストのエントリを適用中',
    itemFailed: ({ id }) => `${id} のインポートに失敗しました`,
    summary: ({ created, updated, unchanged, skipped, failed }) =>
      `作成 ${created} 件、更新 ${updated} 件、変更なし ${unchanged} 件、スキップ ${skipped} 件、失敗 ${failed} 件`
  },

  settings: {
    webviewTitle: 'VNDB',
    commandLabel: '設定',
    commandDescription: '任意の VNDB API トークン、エンドポイント、スクレイピング設定を構成します'
  },

  ui: {
    loading: '読み込み中…',
    unavailable: 'VNDB の設定を読み込めませんでした',
    saved: '設定を保存しました',
    savePreferences: '保存',
    discardChanges: '破棄',
    unsavedChanges: '未保存の変更',
    actionFailed: '操作に失敗しました',
    cancel: 'キャンセル',
    confirm: '確認',

    credentials: {
      title: 'API トークン',
      description:
        'Kana API は公開されているため、トークンなしでもスクレイピングできます。個人トークンを追加するとレート上限が上がります。',
      statusLabel: 'ステータス',
      inputLabel: 'トークン',
      inputPlaceholder: 'VNDB のトークンを貼り付け',
      configuredLabel: '設定済み',
      missingLabel: '匿名アクセス',
      save: 'トークンを保存',
      clear: 'トークンを削除',
      test: '接続テスト',
      saveSucceeded: 'API トークンを保存しました',
      clearSucceeded: 'API トークンを削除しました',
      testSucceeded: 'VNDB はリクエストを受け入れました',
      openSettings: 'vndb.org でトークンを作成'
    },

    endpoints: {
      title: 'エンドポイント',
      description: '公式ホストに接続できない場合はミラーを指定します',
      apiBaseUrlLabel: 'API ベース URL',
      apiBaseUrlDescription: 'VNDB Kana API のルート',
      restoreDefaults: '公式エンドポイントに戻す'
    },

    preferences: {
      title: '設定',
      description: 'すべての VNDB 検索とスクレイピングに適用されます',
      preferRomanizedLabel: 'ローマ字タイトルを優先',
      preferRomanizedDescription:
        'コンテンツ言語に対応するタイトルがない場合、ローマ字タイトルを表示名として使用します',
      timeoutLabel: 'リクエストタイムアウト',
      timeoutDescription: '1 回の VNDB レスポンスを待つ秒数',
      seconds: '秒',
      retryLabel: '再試行回数',
      retryDescription: 'レート制限やサーバーエラー後の追加試行回数',
      retryUnit: '回',
      reset: '既定の設定に戻す',
      resetDescription: 'エンドポイントと設定が既定値に戻ります。トークンは保持されます。',
      resetSucceeded: '既定の設定に戻しました'
    },

    integration: {
      title: 'リスト連携',
      description:
        'VNDB リストと連携します。ライブラリへのインポートと、ローカルのステータス・スコア変更の送信を行います。listread と listwrite の権限を持つトークンが必要です。',
      verify: 'アカウントを確認',
      verifiedAs: ({ username }) => `${username} としてサインイン中`,
      permissionsLabel: 'リスト権限',
      listRead: '読み取り',
      listWrite: '書き込み',
      permissionGranted: '許可済み',
      permissionMissing: '不足',
      syncEnabledLabel: '変更を自動送信',
      syncEnabledDescription:
        'VNDB ID を持つエントリのステータスとスコアの変更をリストへ送信します',
      pushScoreLabel: 'スコアを含める',
      pushScoreDescription:
        'ローカルスコアを VNDB の投票として書き込みます。スコアが空でも投票は消去されません。',
      pushAll: '今すぐ全件送信',
      importTitle: 'リストをインポート',
      importDescription:
        'リストのステータスと投票を一致するエントリへ書き込みます。不足エントリの作成は選択したプロファイルでスクレイピングします。',
      profileLabel: 'スクレイピングプロファイル',
      profilePlaceholder: 'プロファイルを選択',
      updateExistingLabel: '既存エントリを更新',
      createMissingLabel: '不足エントリを作成',
      startImport: 'インポート',
      taskProgress: ({ current, total }) => `${current} / ${total}`,
      taskRunning: '実行中',
      taskCompleted: '完了',
      taskFailed: '失敗',
      taskCancelled: 'キャンセル済み',
      cancelTask: 'キャンセル'
    }
  }
}
