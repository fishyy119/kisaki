import type { SteamMessages } from '../index'

export const ja: SteamMessages = {
  errors: {
    keyRequired: 'まず Steam Web API キーを保存してください',
    steamIdInvalid: '有効な SteamID64 を入力してください(7656 で始まる 17 桁の数字)',
    keyRejected: 'Steam が Web API キーを拒否しました',
    profileNotVisible:
      'Steam からゲームが返されませんでした。SteamID と、プロフィールのゲーム詳細が公開されているか確認してください。',
    notFound: 'その Steam アプリは存在しないか、ストアで公開されていません',
    rateLimited: 'Steam へのリクエストが多すぎます。しばらくしてから再試行してください。',
    rejected: 'Steam API がリクエストを拒否しました',
    unavailable: 'Steam API は一時的に利用できません',
    networkFailed: 'Steam へのネットワークリクエストに失敗しました',
    operationCancelled: '操作はキャンセルされました',
    idInvalid: ({ value }) => `「${value}」は有効な Steam アプリ ID ではありません`,
    keyEmpty: 'Web API キーを入力してください',
    operationRunning: 'Steam インポートが既に実行中です。完了までお待ちください。'
  },

  import: {
    taskTitle: '所有している Steam ゲームをインポート',
    phaseRead: '所有ゲームを読み込み中',
    phaseApply: 'エントリを作成中',
    itemFailed: ({ id }) => `${id} のインポートに失敗しました`,
    summary: ({ created, existing, failed }) =>
      `作成 ${created} 件、既存 ${existing} 件、失敗 ${failed} 件`
  },

  settings: {
    webviewTitle: 'Steam',
    commandLabel: '設定',
    commandDescription:
      'Steam アカウントの接続、所有ゲームのインポート、スクレイピング設定を行います'
  },

  ui: {
    loading: '読み込み中…',
    unavailable: 'Steam の設定を読み込めませんでした',
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
        '所有ゲームのインポートには個人の Web API キーとアカウントの SteamID64 が必要です。プロフィールのゲーム詳細は公開されている必要があります。',
      statusLabel: 'ステータス',
      configuredLabel: 'キー保存済み',
      missingLabel: 'キー未保存',
      keyLabel: 'Web API キー',
      keyPlaceholder: 'Web API キーを貼り付け',
      steamIdLabel: 'SteamID64',
      steamIdDescription: '17 桁の数字。プロフィール URL やサードパーティツールで確認できます',
      saveKey: 'キーを保存',
      clearKey: 'キーを削除',
      verify: '確認',
      verifiedGames: ({ count }) => `${count} 本のゲームが表示可能`,
      openKeyPage: 'Web API キーを取得'
    },

    integration: {
      title: '所有ゲームのインポート',
      description:
        '所有ライブラリを読み込み、選択したプロファイルで不足エントリを作成します。既に Steam ID を持つエントリは変更されません。',
      profileLabel: 'ゲームプロファイル',
      profilePlaceholder: 'プロファイルを選択',
      startImport: '所有ゲームをインポート',
      taskProgress: ({ current, total }) => `${current} / ${total}`,
      taskRunning: '実行中',
      taskCompleted: '完了',
      taskFailed: '失敗',
      taskCancelled: 'キャンセル済み',
      cancelTask: 'キャンセル'
    },

    preferences: {
      title: '設定',
      description: 'すべての Steam リクエストに適用されます',
      timeoutLabel: 'リクエストタイムアウト',
      timeoutDescription: '1 回のレスポンスを待つ秒数',
      seconds: '秒',
      retryLabel: '再試行回数',
      retryDescription: 'レート制限やサーバーエラー後の追加試行回数',
      retryUnit: '回',
      reset: '既定の設定に戻す',
      resetDescription: '設定が既定値に戻ります。保存済みのキーは保持されます。',
      resetSucceeded: '既定の設定に戻しました'
    }
  }
}
