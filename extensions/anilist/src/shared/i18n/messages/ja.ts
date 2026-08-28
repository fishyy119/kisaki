import type { AnilistMessages } from '../index'

export const ja: AnilistMessages = {
  errors: {
    authRequired: 'まず AniList アカウントにサインインしてください',
    tokenExpired: 'AniList のサインインが期限切れです。再度サインインしてください。',
    notFound: 'その AniList エントリは存在しません',
    rateLimited: 'AniList へのリクエストが多すぎます。しばらくしてから再試行してください。',
    rejected: 'AniList API がリクエストを拒否しました',
    unavailable: 'AniList API は一時的に利用できません',
    networkFailed: 'AniList API のネットワークリクエストに失敗しました',
    operationCancelled: '操作はキャンセルされました',
    baseUrlInvalid: 'http または https のアドレスを入力してください',
    idInvalid: ({ value }) => `「${value}」は有効な AniList ID ではありません`,
    relayUnavailable: 'Kisaki OAuth リレーは一時的に利用できません。後でもう一度お試しください。',
    loginSessionExpired:
      'AniList サインインセッションの有効期限が切れました。再度サインインしてください。',
    loginCallbackInvalid:
      'AniList サインインのコールバック検証に失敗しました。再度サインインしてください。',
    noPendingLogin: '完了待ちの AniList サインインはありません',
    loginNotReady: 'AniList サインインはまだ準備できていません',
    operationRunning: 'AniList リストの操作が既に実行中です。完了までお待ちください。'
  },

  oauth: {
    loginSucceededTitle: 'AniList サインインが完了しました',
    loginFailedTitle: 'AniList サインインに失敗しました',
    loginCompleted: ({ userName }) => `${userName} としてサインインしました`,
    callbackFailed: 'AniList サインインを完了できませんでした'
  },

  sync: {
    autoSyncFailedTitle: 'AniList 同期に失敗しました',
    autoSyncFailedFallback: '変更を AniList に送信できませんでした',
    pushTaskTitle: 'ライブラリを AniList リストへ送信',
    pushSummary: ({ pushed, skipped, failed }) =>
      `送信 ${pushed} 件、スキップ ${skipped} 件、失敗 ${failed} 件`
  },

  import: {
    taskTitle: 'AniList リストをインポート',
    phaseRead: 'AniList リストを読み込み中',
    phaseApply: 'リストのエントリを適用中',
    itemFailed: ({ id }) => `${id} のインポートに失敗しました`,
    summary: ({ created, updated, unchanged, skipped, failed }) =>
      `作成 ${created} 件、更新 ${updated} 件、変更なし ${unchanged} 件、スキップ ${skipped} 件、失敗 ${failed} 件`
  },

  settings: {
    webviewTitle: 'AniList',
    commandLabel: '設定',
    commandDescription: 'AniList へのサインイン、リストのインポート、スクレイピング設定を行います'
  },

  ui: {
    loading: '読み込み中…',
    unavailable: 'AniList の設定を読み込めませんでした',
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
        'ブラウザからサインインして AniList リストと連携します。トークンは約 1 年間有効で、更新はできません。',
      statusLabel: 'ステータス',
      configuredLabel: 'サインイン済み',
      missingLabel: '未サインイン',
      pendingLabel: 'ブラウザでのサインインを待機中…',
      login: 'AniList でサインイン',
      completeLogin: '認可を完了しました',
      cancelLogin: 'サインインをキャンセル',
      logout: 'サインアウト',
      verify: 'アカウントを確認',
      verifiedAs: ({ userName }) => `${userName} としてサインイン中`
    },

    integration: {
      title: 'リスト連携',
      syncEnabledLabel: '変更を自動送信',
      syncEnabledDescription:
        'AniList ID を持つエントリのステータスとスコアの変更をリストへ送信します',
      pushScoreLabel: 'スコアを含める',
      pushScoreDescription:
        'ローカルスコアを AniList に書き込みます。スコアが空でも消去はされません。',
      pushAll: '今すぐ全件送信',
      importTitle: 'リストをインポート',
      importDescription:
        'リストのステータスとスコアを一致するエントリへ書き込みます。不足エントリの作成は選択したプロファイルでスクレイピングします。',
      listAnime: 'アニメリスト',
      listManga: 'マンガリスト',
      updateExistingLabel: '既存エントリを更新',
      createMissingLabel: '不足エントリを作成',
      animeProfileLabel: 'アニメプロファイル',
      comicProfileLabel: 'マンガプロファイル',
      novelProfileLabel: 'ノベルプロファイル',
      profilePlaceholder: 'プロファイルを選択',
      startImport: 'インポート',
      taskProgress: ({ current, total }) => `${current} / ${total}`,
      taskRunning: '実行中',
      taskCompleted: '完了',
      taskFailed: '失敗',
      taskCancelled: 'キャンセル済み',
      cancelTask: 'キャンセル'
    },

    endpoints: {
      title: 'エンドポイント',
      description: '公式ホストに接続できない場合はミラーを指定します',
      graphqlUrlLabel: 'GraphQL URL',
      graphqlUrlDescription: 'AniList GraphQL API のルート',
      relayUrlLabel: 'OAuth リレー URL',
      relayUrlDescription: 'AniList サインインを完了する Kisaki リレーのルート',
      restoreDefaults: '公式エンドポイントに戻す'
    },

    preferences: {
      title: '設定',
      description: 'すべての AniList 検索とスクレイピングに適用されます',
      preferRomajiLabel: 'ローマ字タイトルを優先',
      preferRomajiDescription:
        'コンテンツ言語に対応するタイトルがない場合、ローマ字タイトルを表示名として使用します',
      timeoutLabel: 'リクエストタイムアウト',
      timeoutDescription: '1 回の AniList レスポンスを待つ秒数',
      seconds: '秒',
      retryLabel: '再試行回数',
      retryDescription: 'レート制限やサーバーエラー後の追加試行回数',
      retryUnit: '回',
      reset: '既定の設定に戻す',
      resetDescription: 'エンドポイントと設定が既定値に戻ります。サインインは保持されます。',
      resetSucceeded: '既定の設定に戻しました'
    }
  }
}
