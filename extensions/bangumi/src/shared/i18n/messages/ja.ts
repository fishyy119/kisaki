/** Japanese message catalog for the Bangumi extension. */

import type { BangumiMediaScope } from '../../scopes'
import type { en } from './en'

type Scope = BangumiMediaScope
type CollectionType = 1 | 2 | 3 | 4 | 5

const NOUNS: Record<Scope, string> = {
  book: '書籍',
  game: 'ゲーム',
  anime: 'アニメ',
  music: '音楽エントリ'
}

const SCOPES: Record<Scope, string> = {
  book: '書籍',
  game: 'ゲーム',
  anime: 'アニメ',
  music: '音楽'
}

const COLLECTIONS: Record<Scope, Record<CollectionType, string>> = {
  book: { 1: '読みたい', 2: '読んだ', 3: '読んでいる', 4: '保留', 5: '中止' },
  game: { 1: 'プレイしたい', 2: 'プレイ済み', 3: 'プレイ中', 4: '保留', 5: '中止' },
  anime: { 1: '見たい', 2: '視聴済み', 3: '視聴中', 4: '保留', 5: '中止' },
  music: { 1: '聴きたい', 2: '聴いた', 3: '聴いている', 4: '保留', 5: '中止' }
}

function countOf(scope: Scope, count: number): string {
  return `${count} 件の${NOUNS[scope]}`
}

export const ja = {
  common: {
    cancel: 'キャンセル',
    close: '閉じる',
    confirm: '確認',
    create: '作成',
    preview: 'プレビュー',
    none: 'なし',
    listSeparator: '、'
  },

  media: {
    scopes: SCOPES,
    collections: COLLECTIONS
  },

  errors: {
    authRequired: '先に Bangumi アカウントにサインインしてください',
    authSessionInvalid: 'Bangumi セッションが無効になりました。再度サインインしてください。',
    tokenRefreshFailed: 'Bangumi 資格情報を更新できませんでした。再度サインインしてください。',
    refreshTokenMissing: 'Bangumi リフレッシュトークンが存在しません。再度サインインしてください。',
    tokenSaveFailed: 'Bangumi 資格情報を保存できませんでした',

    loginNotReady: 'Bangumi サインインはまだ準備できていません',
    loginCallbackMissingParams: 'Bangumi サインインのコールバックに必要なパラメータがありません',
    loginSessionExpired:
      'Bangumi サインインセッションの有効期限が切れました。再度サインインしてください。',
    loginCallbackInvalid:
      'Bangumi サインインのコールバック検証に失敗しました。再度サインインしてください。',
    noPendingLogin: '完了待ちの Bangumi サインインはありません',

    relayUnreachable: 'Kisaki OAuth リレーに接続できませんでした',
    relayUnavailable: 'Kisaki OAuth リレーは一時的に利用できません。後でもう一度お試しください。',
    relayAvailable: 'OAuth リレーは利用可能です',
    relayInvalidSession: 'OAuth リレーが認識できないサインインセッションを返しました',
    relayNoToken: 'OAuth リレーがアクセス資格情報を返しませんでした',

    apiNotFound: 'Bangumi エントリが存在しません',
    apiRateLimited: 'Bangumi API リクエストが多すぎます。後でもう一度お試しください。',
    apiRejected: 'Bangumi API がリクエストを拒否しました',
    apiUnavailable: 'Bangumi API は一時的に利用できません',
    networkFailed: 'Bangumi API のネットワークリクエストに失敗しました',
    accountResponseInvalid: 'Bangumi アカウントの応答を認識できませんでした',
    idInvalid: ({ value }) => `「${value}」は有効な Bangumi ID ではありません`,

    operationCancelled: '操作はキャンセルされました',
    jobCancelled: 'Bangumi ジョブはキャンセルされました',
    jobFailed: 'Bangumi ジョブが失敗しました',
    jobAlreadyRunning:
      'この Bangumi ジョブは既に実行中です。完了を待つか、先にキャンセルしてください。',

    invalidMediaScope: '有効な Bangumi メディア種別を選択してください',
    mediaScopeNotRegistered: 'この Bangumi メディア種別は登録されていません',
    localWriteUnsupported: ({ scope }: { scope: Scope }) =>
      `${SCOPES[scope]}はまだローカルライブラリへの書き込みに対応していません`,
    localWriteUnsupportedGeneric:
      'このメディア種別はまだローカルライブラリへの書き込みに対応していません',

    localMediaStatusUnknown: 'ローカル項目のステータスを認識できませんでした',
    localMediaMissing: 'ローカル項目が存在しません',
    bookKindUnresolved: 'この書籍がマンガか小説か Bangumi が示していないため、取り込みませんでした',
    localItemMissing: 'ローカルエントリが存在しません',
    importedItemMissing: 'インポート済みのローカルエントリが存在しません',
    targetCollectionMissing: '選択したターゲットコレクションが存在しません',
    selectTargetCollection: 'ターゲットコレクションを選択してください',
    indexTitleEmpty: 'Bangumi インデックスのタイトルが空のため、コレクションを作成できません',
    indexInputRequired: 'Bangumi インデックスの ID またはリンクを入力してください',
    indexInputInvalid:
      'Bangumi インデックスは数値 ID、または https://bgm.tv/index/<id> や https://bangumi.tv/index/<id> のようなリンクである必要があります',
    indexSubjectMissingId: 'Bangumi インデックスのエントリに有効な作品 ID がありません',
    collectionMissingSubjectId: 'Bangumi コレクションに有効な作品 ID がありません',
    profileRequired: 'ローカル項目の作成に使うスクレイパープロファイルを選択してください',
    profileNotFound: '選択したスクレイパープロファイルが存在しません'
  },

  oauth: {
    loginSucceededTitle: 'Bangumi サインイン完了',
    loginFailedTitle: 'Bangumi サインイン失敗',
    loginCompleted: ({ nickname }: { nickname: string }) =>
      `Bangumi にサインインしました：${nickname}`,
    callbackFailed:
      'Bangumi サインインのコールバックに失敗しました。設定ページに戻って再試行してください。'
  },

  notifications: {
    autoSyncFailedTitle: 'Bangumi 自動同期に失敗',
    autoSyncFailedFallback: 'Bangumi 自動同期に失敗しました'
  },

  commands: {
    authRefresh: {
      title: 'Bangumi 資格情報を更新',
      description: 'Bangumi トークンを更新して現在のアカウントを検証する'
    },
    syncChanged: {
      title: '変更された Bangumi エントリを同期',
      description: 'このセッション中にキューに入ったローカルエントリの変更を同期する'
    },
    syncFull: {
      title: 'Bangumi フル同期',
      description: 'ローカル項目をスキャンして Bangumi のコレクション状態と評価を同期する'
    },
    importCollections: {
      title: '自分の Bangumi コレクションをインポート',
      description: '現在の Bangumi ユーザーのコレクションをメディア種別ごとにインポートする'
    },
    importIndex: {
      title: 'Bangumi インデックスをインポート',
      description: 'Bangumi インデックスからメディア種別ごとにエントリをインポートする'
    }
  },

  jobs: {
    completed: 'Bangumi ジョブが完了しました',
    cancelled: 'Bangumi ジョブはキャンセルされました',

    auth: {
      refreshingToken: 'Bangumi 資格情報を更新しています…',
      verifyingAccount: 'Bangumi アカウントを検証しています…',
      accountValid: ({ nickname }: { nickname: string }) =>
        `Bangumi アカウントは有効です：${nickname}`,
      accountRefreshed: ({ nickname }: { nickname: string }) =>
        `Bangumi アカウント概要を更新しました：${nickname}`
    },

    sync: {
      loadingQueue: 'Bangumi 変更キューを読み込んでいます…',
      syncingQueue: 'Bangumi 変更キューを同期しています…',
      queueUnsupported: ({ scope }: { scope: Scope }) =>
        `${SCOPES[scope]}はまだローカル変更の同期に対応していません`,
      queueCompleted: ({ count }: { count: number }) =>
        `変更キューの同期が完了しました：${count} 件のエントリを同期しました`,
      fullUnsupported: ({ scope }: { scope: Scope }) =>
        `${SCOPES[scope]}はまだローカルフル同期に対応していません`,
      fullCompleted: ({ count, scope }: { count: number; scope: Scope }) =>
        `フル同期が完了しました：${countOf(scope, count)}を同期しました`,
      previewCompleted: ({ count, scope }: { count: number; scope: Scope }) =>
        `フル同期プレビューが完了しました：${countOf(scope, count)}を同期できます`,
      scanningItems: ({ scope }: { scope: Scope }) => `${NOUNS[scope]}をスキャンしています…`,
      collectingItems: ({ scope }: { scope: Scope }) =>
        `同期対象の${NOUNS[scope]}を計算しています…`,
      previewingItems: 'Bangumi フル同期をプレビューしています…',
      applyingItems: 'Bangumi フル同期エントリを同期しています…'
    },

    import: {
      validating: 'Bangumi インポートパラメータを確認しています…',
      validatingIndex: 'Bangumi インデックスインポートパラメータを確認しています…',
      readingCollections: ({ scope, type }: { scope: Scope; type: CollectionType }) =>
        `Bangumi「${COLLECTIONS[scope][type]}」コレクションを読み込んでいます…`,
      readingIndex: 'Bangumi インデックスエントリを読み込んでいます…',
      matchingLocal: ({ scope }: { scope: Scope }) => `${NOUNS[scope]}を照合しています…`,
      collectingPlan: ({ scope }: { scope: Scope }) =>
        `インポート対象の${NOUNS[scope]}を計算しています…`,
      preparing: ({ scope }: { scope: Scope }) => `${NOUNS[scope]}のインポートを準備しています…`,
      creatingLocal: ({ scope }: { scope: Scope }) => `${NOUNS[scope]}を追加しています…`,
      patchingLocal: ({ scope }: { scope: Scope }) => `${NOUNS[scope]}を更新しています…`,
      writeUnsupported: ({ scope }: { scope: Scope }) =>
        `${SCOPES[scope]}はまだローカルライブラリへの書き込みに対応していません`,
      collectionsCompleted: ({
        added,
        updated,
        scope
      }: {
        added: number
        updated: number
        scope: Scope
      }) =>
        `コレクションのインポートが完了しました：${countOf(scope, added)}を追加、既存 ${updated} 件を更新しました`,
      collectionsPreviewCompleted: ({
        toImport,
        toPatch,
        scope
      }: {
        toImport: number
        toPatch: number
        scope: Scope
      }) =>
        `コレクションのインポートプレビューが完了しました：${countOf(scope, toImport)}をインポートし、既存 ${toPatch} 件を更新します`,
      indexCompleted: ({
        added,
        updated,
        scope
      }: {
        added: number
        updated: number
        scope: Scope
      }) =>
        `インデックスのインポートが完了しました：${countOf(scope, added)}を追加、既存 ${updated} 件を更新しました`,
      indexPreviewCompleted: ({
        toImport,
        toPatch,
        scope
      }: {
        toImport: number
        toPatch: number
        scope: Scope
      }) =>
        `インデックスのインポートプレビューが完了しました：${countOf(scope, toImport)}をインポートし、既存 ${toPatch} 件を更新します`,
      buildingCollectionsPreview: 'コレクションインポートのプレビューを生成しています…',
      buildingIndexPreview: 'インデックスインポートのプレビューを生成しています…',
      buildingRemoteCollectionsPreview: 'リモートコレクションのプレビューを生成しています…',
      buildingRemoteIndexPreview: 'リモートインデックスのプレビューを生成しています…',
      remoteCollectionsPreviewCompleted: ({ scope }: { scope: Scope }) =>
        `${SCOPES[scope]}のリモートコレクションプレビューが完了しました`,
      remoteIndexPreviewCompleted: ({ scope }: { scope: Scope }) =>
        `${SCOPES[scope]}インデックスのリモートプレビューが完了しました`
    },

    preview: {
      remoteBadge: ({ scope }: { scope: Scope }) => `${SCOPES[scope]}リモートプレビュー`,
      createLocalBadge: ({ scope }: { scope: Scope }) => `ローカル${NOUNS[scope]}を作成`,
      updateLocalBadge: ({ scope }: { scope: Scope }) => `ローカル${NOUNS[scope]}を更新`,
      createRemoteCollectionBadge: 'Bangumi コレクションを作成',
      updateRemoteCollectionBadge: 'Bangumi コレクションを更新',
      collectionStatus: 'コレクション状態',
      status: 'ステータス',
      score: '評価',
      tags: 'タグ',
      collection: 'コレクション',
      unitProgress: '読書進捗',
      unitProgressValue: ({ volumes, chapters }: { volumes: number; chapters: number }) =>
        `${volumes} 巻 / ${chapters} 話`,
      notCollected: '未収集',
      notRated: '未評価',
      notInCollection: '未加入',
      notSet: '未設定',
      missing: '存在しない',
      create: '作成',
      remote: 'リモート',
      indexEntry: 'インデックスエントリ',
      remotePreview: 'リモートプレビュー'
    },

    gameStatus: {
      notStarted: 'プレイしたい',
      inProgress: 'プレイ中',
      partial: '一部クリア',
      completed: 'プレイ済み',
      multiple: '周回プレイ',
      shelved: '保留',
      unset: '未設定'
    },

    animeStatus: {
      planned: '見たい',
      watching: '視聴中',
      completed: '視聴済み',
      onHold: '保留',
      dropped: '中断',
      unset: '未設定'
    },

    bookStatus: {
      planned: '読みたい',
      reading: '読書中',
      completed: '読了',
      onHold: '保留',
      dropped: '中断',
      unset: '未設定'
    }
  },

  automations: {
    names: {
      'auth-refresh': 'Bangumi：起動時に資格情報を更新',
      'sync-changed': 'Bangumi：起動後に変更キューを同期',
      'sync-full-daily': 'Bangumi：毎日のフル同期'
    },
    labels: {
      'auth-refresh': '起動時に資格情報を更新',
      'sync-changed': '起動後に変更キューを同期',
      'sync-full-daily': '毎日のフル同期'
    },
    descriptions: {
      'auth-refresh': 'アプリ起動時に Bangumi 資格情報を更新して検証します',
      'sync-changed': '起動後に前回のセッション中に蓄積されたローカル変更を同期します',
      'sync-full-daily': '毎日早朝に一度ライブラリのフル同期を実行します'
    },
    status: {
      missing: '未作成',
      enabled: '有効',
      disabled: '無効'
    }
  },

  settings: {
    commandLabel: '設定',
    commandDescription: 'Bangumi 連携設定を開きます',
    webviewTitle: 'Bangumi'
  },

  ui: {
    loading: 'Bangumi 設定を読み込んでいます…',
    unavailable: 'Bangumi 設定は利用できません',
    saved: '設定を保存しました',
    unsavedChanges: '未保存の変更',
    discardChanges: '変更を破棄',
    savePreferences: '設定を保存',
    actionFailed: '操作に失敗しました。もう一度お試しください。',
    mediaScope: 'メディア種別',
    mediaScopePlaceholder: 'メディア種別を選択',

    tabs: {
      overview: '概要',
      account: 'アカウント',
      sync: '同期',
      import: 'インポート',
      automation: '自動化',
      maintenance: 'メンテナンス'
    },

    overview: {
      statusTitle: 'ステータス概要',
      accountLabel: 'アカウント',
      notLoggedIn: '未サインイン',
      loggedIn: 'サインイン済み',
      notAuthorized: '未認可',
      credentialsExpired: '資格情報の期限切れ',
      available: '利用可能',
      autoSyncLabel: '自動同期',
      enabled: '有効',
      disabled: '無効',
      syncItemCreate: 'コレクション作成',
      syncItemStatus: 'プレイ状況',
      syncItemScore: '評価',
      noSyncItems: '同期項目が未選択',
      recommendedAutomations: '推奨自動化',
      automationsComplete: 'すべて作成済み',
      automationsMissing: ({ count }: { count: number }) => `${count} 件が未作成`,
      templatesCount: ({ count }: { count: number }) => `${count} 件のテンプレート`,
      runtimeTitle: '実行状態',
      runningJobs: '実行中の Bangumi ジョブ',
      running: '実行中',
      idle: 'アイドル',
      localResources: '利用可能なローカルリソース',
      localResourcesSummary: ({
        profiles,
        collections
      }: {
        profiles: number
        collections: number
      }) => `スクレイパープロファイル ${profiles} 件 / コレクション ${collections} 件`,
      quickActionsTitle: 'ショートカット',
      importAction: 'Bangumi コレクションまたはインデックスをインポート',
      maintenanceAction: 'ネットワークとメンテナンスのオプションを調整',
      automationsTitle: '自動化テンプレート'
    },

    account: {
      sectionTitle: 'Bangumi アカウント',
      loginStatus: 'サインイン状態',
      verifiedDescription: ({ nickname }: { nickname: string }) =>
        `アカウントを検証しました：${nickname}`,
      notLoggedIn: '未サインイン',
      accessToken: 'アクセストークン',
      tokenSaved: '保存済み',
      tokenMissing: '未保存',
      refreshable: '更新可能',
      expired: '期限切れ',
      expiresAt: '資格情報の有効期限',
      actionsTitle: 'アカウント操作',
      login: 'Bangumi にサインイン',
      verify: 'アカウントを検証',
      refreshCredentials: '資格情報を更新',
      logout: 'サインアウト'
    },

    sync: {
      preferencesTitle: '自動同期設定',
      autoSync: '自動同期',
      autoSyncDescription: 'ローカル項目の作成とユーザー状態フィールドの変更を監視します',
      syncItems: '同期項目',
      itemCreate: 'コレクション作成',
      itemStatus: '項目ステータス',
      itemScore: '評価',
      itemUnitProgress: 'ユニット進捗',
      clearRemoteScore: 'リモート評価の削除を許可',
      clearRemoteScoreDescription: 'ローカル評価をクリアしたとき Bangumi の評価も削除します',
      manualTitle: '手動同期',
      manualDescription:
        '変更キューを今すぐ同期するか、一回限りのフル同期を設定します。進行状況とキャンセルはタスクセンターで処理されます。',
      syncChangedNow: '今すぐ変更を同期',
      fullSync: 'フル同期'
    },

    import: {
      noProfilesWarning:
        'このメディア種別のスクレイパープロファイルが未設定です。インポートのプレビューは可能ですが、ローカル書き込みには利用可能なプロファイルが必要です。',
      sourceTitle: 'インポート元',
      sourceDescription:
        'インポートは一回限りのタスクです。オプションは今回の実行のみに適用され、Bangumi 設定には保存されません。',
      myCollections: '自分のコレクション',
      myCollectionsDescription:
        '現在の Bangumi ユーザーの選択したメディア種別のコレクションを種別ごとにインポートします',
      bangumiIndex: 'Bangumi インデックス',
      bangumiIndexDescription: 'インデックスの ID またはリンクを入力してインポートを設定します',
      indexPlaceholder: 'インデックス ID または https://bgm.tv/index/..',
      configureImport: 'インポートを設定'
    },

    automation: {
      title: '推奨自動化',
      description:
        'ここでは Bangumi の推奨テンプレートのみ作成します。有効化・トリガー・履歴はメインアプリの自動化ページで管理します。',
      create: '作成'
    },

    maintenance: {
      networkTitle: 'ネットワークとクライアント',
      networkDescription: 'これらの設定は保存後、以降の Bangumi API リクエストに影響します',
      loginTimeout: 'サインインタイムアウト',
      minutes: '分',
      rateLimit: 'API レート制限',
      rateLimitDescription: 'リクエスト数 / 時間ウィンドウ',
      seconds: '秒',
      apiTimeout: 'API タイムアウト',
      retryCount: 'リトライ回数',
      retryUnit: '回',
      debounce: '自動同期デバウンス',
      notifyErrors: '同期エラー通知',
      notifyErrorsDescription: '同期ジョブが失敗したときメインアプリの通知を送信します',
      actionsTitle: 'メンテナンス操作',
      actionsDescription: 'これらの操作は即座に反映され、取り消せません',
      clearSyncState: '同期状態をクリア',
      clearSyncStateDescription:
        '同期フィンガープリントと変更キューをクリアします。次回の同期で全エントリを再比較します。',
      resetSettings: '既定の設定に戻す',
      resetSettingsDescription:
        'Bangumi 設定を既定値にリセットします。サインアウトや自動化の削除は行いません。',
      confirmAction: '実行を確認'
    },

    fullSync: {
      title: 'フル同期',
      syncData: '同期データ',
      itemStatus: '項目ステータス',
      itemScore: '評価',
      itemUnitProgress: 'ユニット進捗',
      updateExisting: '既存コレクションを更新',
      updateExistingDescription:
        'オフの場合、リモートに存在しないエントリの Bangumi コレクションのみ作成します',
      clearRemoteScore: 'リモート評価の削除を許可',
      batchSize: 'バッチサイズ',
      run: '同期を実行',
      previewTitle: 'フル同期プレビュー',
      previewDescription: 'Bangumi に同期される変更を確認します'
    },

    importCollections: {
      title: '自分のコレクションをインポート',
      profile: 'スクレイパープロファイル',
      profilePlaceholder: 'スクレイパープロファイルを選択',
      collectionTypes: 'コレクション種別',
      dataItems: 'インポートするユーザー状態フィールド',
      itemStatus: '項目ステータス',
      itemScore: '評価',
      itemTags: 'タグ',
      itemUnitProgress: '読書進捗',
      patchExisting: '既存エントリを更新',
      targetCollection: 'コレクションに追加',
      collectionPlaceholder: 'コレクションを選択',
      start: 'インポートを開始',
      previewTitle: '自分のコレクションのインポートプレビュー',
      previewDescription: '作成・更新・スキップされるエントリを確認します'
    },

    importIndex: {
      title: 'インデックスをインポート',
      index: 'インデックス',
      profile: 'スクレイパープロファイル',
      profilePlaceholder: 'スクレイパープロファイルを選択',
      targetCollection: 'ターゲットコレクション',
      targetNone: 'コレクションに追加しない',
      targetExisting: '既存のコレクション',
      targetByIndexTitle: 'インデックスタイトルから作成',
      selectCollection: 'コレクションを選択',
      collectionPlaceholder: 'コレクションを選択',
      patchExisting: '既存エントリを更新',
      start: 'インポートを開始',
      previewTitle: 'インデックスのインポートプレビュー',
      previewDescription: '作成・更新・スキップされるエントリを確認します'
    },

    previewDialog: {
      empty: '変更されるエントリはありません'
    }
  }
} satisfies typeof en
