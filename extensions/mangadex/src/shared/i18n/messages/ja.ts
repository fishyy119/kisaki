import type { MangadexMessages } from '../index'

export const ja: MangadexMessages = {
  errors: {
    authRequired: 'まず MangaDex パーソナルクライアントの資格情報を保存してください',
    authFailed: 'MangaDex が資格情報を拒否しました。4 つの値をすべて確認してください。',
    notFound: 'その MangaDex エントリは存在しません',
    rateLimited: 'MangaDex へのリクエストが多すぎます。しばらくしてから再試行してください。',
    rejected: 'MangaDex API がリクエストを拒否しました',
    unavailable: 'MangaDex API は一時的に利用できません',
    networkFailed: 'MangaDex へのネットワークリクエストに失敗しました',
    operationCancelled: '操作はキャンセルされました',
    idInvalid: ({ value }) => `「${value}」は有効な MangaDex ID ではありません`,
    credentialsIncomplete: '4 つの資格情報をすべて入力してください',
    operationRunning: 'MangaDex リストの操作が既に実行中です。完了までお待ちください。'
  },

  sync: {
    autoSyncFailedTitle: 'MangaDex 同期に失敗しました',
    autoSyncFailedFallback: '変更を MangaDex に送信できませんでした',
    pushTaskTitle: 'ライブラリを MangaDex へ送信',
    pushSummary: ({ pushed, skipped, failed }) =>
      `送信 ${pushed} 件、スキップ ${skipped} 件、失敗 ${failed} 件`
  },

  import: {
    taskTitle: 'MangaDex の読書ステータスをインポート',
    phaseRead: 'MangaDex のステータスを読み込み中',
    phaseApply: 'エントリを適用中',
    itemFailed: ({ id }) => `${id} のインポートに失敗しました`,
    summary: ({ created, updated, unchanged, skipped, failed }) =>
      `作成 ${created} 件、更新 ${updated} 件、変更なし ${unchanged} 件、スキップ ${skipped} 件、失敗 ${failed} 件`
  },

  settings: {
    webviewTitle: 'MangaDex',
    commandLabel: '設定',
    commandDescription:
      'MangaDex アカウントの接続、読書ステータスのインポート、スクレイピング設定を行います'
  },

  ui: {
    loading: '読み込み中…',
    unavailable: 'MangaDex の設定を読み込めませんでした',
    saved: '設定を保存しました',
    savePreferences: '保存',
    discardChanges: '破棄',
    unsavedChanges: '未保存の変更',
    actionFailed: '操作に失敗しました',
    cancel: 'キャンセル',
    confirm: '確認',

    account: {
      title: 'アカウント',
      description:
        'MangaDex のパーソナルツールはパーソナル API クライアントでサインインします。MangaDex の設定で作成し、その ID とシークレット、アカウントのユーザー名とパスワードを入力してください。すべてローカルのシークレットストアにのみ保存されます。',
      statusLabel: 'ステータス',
      configuredLabel: '接続済み',
      missingLabel: '未接続',
      clientIdLabel: 'クライアント ID',
      clientSecretLabel: 'クライアントシークレット',
      usernameLabel: 'ユーザー名',
      passwordLabel: 'パスワード',
      save: 'アカウントを接続',
      clear: '接続を解除',
      verify: 'アカウントを確認',
      verifiedAs: ({ userName }) => `${userName} として接続中`,
      openClientSettings: 'MangaDex API クライアントページを開く'
    },

    integration: {
      title: '読書連携',
      syncEnabledLabel: '変更を自動送信',
      syncEnabledDescription:
        'MangaDex ID を持つエントリのステータスとスコアの変更をアカウントへ送信します',
      pushScoreLabel: 'スコアを含める',
      pushScoreDescription:
        'ローカルスコアを MangaDex の評価として書き込みます。スコアが空でも消去はされません。',
      pushAll: '今すぐ全件送信',
      importTitle: '読書ステータスをインポート',
      importDescription:
        'ステータスを一致するエントリへ書き込みます。不足エントリの作成は選択したプロファイルでスクレイピングします。',
      importScoresLabel: '評価もインポート',
      updateExistingLabel: '既存エントリを更新',
      createMissingLabel: '不足エントリを作成',
      profilePlaceholder: 'プロファイルを選択',
      startImport: 'インポート',
      taskProgress: ({ current, total }) => `${current} / ${total}`,
      taskRunning: '実行中',
      taskCompleted: '完了',
      taskFailed: '失敗',
      taskCancelled: 'キャンセル済み',
      cancelTask: 'キャンセル'
    },

    preferences: {
      title: '設定',
      description: 'すべての MangaDex 検索とスクレイピングに適用されます',
      preferRomanizedLabel: 'ローマ字タイトルを優先',
      preferRomanizedDescription:
        'コンテンツ言語に対応するタイトルがない場合、ローマ字タイトルを表示名として使用します',
      timeoutLabel: 'リクエストタイムアウト',
      timeoutDescription: '1 回のレスポンスを待つ秒数',
      seconds: '秒',
      retryLabel: '再試行回数',
      retryDescription: 'レート制限やサーバーエラー後の追加試行回数',
      retryUnit: '回',
      reset: '既定の設定に戻す',
      resetDescription: '設定が既定値に戻ります。保存済みの資格情報は保持されます。',
      resetSucceeded: '既定の設定に戻しました'
    }
  }
}
