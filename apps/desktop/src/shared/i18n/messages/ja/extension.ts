import type { Messages } from '../schema'

type ReleaseActionKind = 'install' | 'update' | 'reinstall' | 'downgrade'

const RELEASE_ACTIONS: Record<ReleaseActionKind, string> = {
  install: 'インストール',
  update: '更新',
  reinstall: '再インストール',
  downgrade: 'ダウングレード'
}

/** Extension platform surfaces: manager pages, panels, dialogs, and webviews. */
export const extension = {
  title: '拡張機能',
  webviewPageClosed: 'この拡張機能ページは閉じられました',

  categories: {
    scraper: 'メタデータ',
    tool: 'ツール',
    theme: 'テーマ',
    integration: '連携',
    uncategorized: '未分類',
    joinSeparator: '、'
  },

  nav: {
    discover: '見つける',
    installed: 'インストール済み',
    repositories: 'リポジトリ',
    signers: '署名'
  },

  header: {
    reloadPending: ({ count }: { count: number }) =>
      `拡張機能のコードが更新されました（${count}）。ホストプロセスを再起動して適用してください`,
    reloadHost: '拡張機能ホストを再起動',
    reloadProcess: 'プロセスを再起動',
    install: '拡張機能をインストール'
  },

  host: {
    reloading: '拡張機能ホストを再起動しています',
    reloaded: '拡張機能ホストを再起動しました',
    reloadFailed: '拡張機能ホストを再起動できませんでした',
    codeUpdatedTitle: '拡張機能のコードが更新されました',
    pendingChanges: ({ subject }: { subject: string }) => `${subject}に未適用の変更があります`,
    subjectSingle: ({ id }: { id: string }) => `拡張機能 ${id}`,
    subjectMultiple: ({ count }: { count: number }) => `${count} 件の拡張機能`
  },

  entityMenu: {
    loading: '拡張機能メニューを読み込んでいます…',
    loadFailed: '拡張機能メニューを読み込めませんでした',
    partiallyUnavailable: '一部の拡張機能メニューは利用できません',
    actionFailed: '拡張機能メニューの操作に失敗しました'
  },

  actions: {
    install: 'インストール',
    update: '更新',
    reinstall: '再インストール',
    downgrade: 'ダウングレード',
    apply: '適用'
  },

  release: {
    actionTitle: ({ action }: { action: string }) => `拡張機能を${action}`,
    prepareTitle: '拡張機能リリースの準備',
    importLocalTitle: 'ローカル拡張機能をインポート',
    repositoryDescription: 'バージョン、リポジトリの出所、署名を確認して続行します',
    localDescription: 'ローカルの .kisx ファイルを選択して確認します',
    confirmAction: ({ action }: { action: string }) => `${action}を確定`,
    selectFile: 'ファイルを選択',
    planFailed: 'リリースプランを作成できませんでした',
    filePickerTitle: '拡張機能ファイルを選択',
    filePickerFilterName: '拡張機能パッケージ',
    cancelled: '操作はキャンセルされました',
    applied: ({ action }: { action: string }) => `拡張機能の${action}が完了しました`,
    applyFailed: '操作に失敗しました',
    signerTrusted: '署名は信頼済み',
    signerUntrusted: '署名は未信頼',
    signerChanged: '署名が変更されました',
    signerUnsigned: '未署名',
    kindStable: '安定版',
    kindPreview: 'プレビュー版',
    unknownSize: 'サイズ不明',
    repositoryLine: ({ name }: { name: string }) => `リポジトリ：${name}`,
    localFileLine: ({ size }: { size: string }) => `ローカルファイル · ${size}`,
    currentVersion: '現在のバージョン',
    notInstalled: '未インストール',
    releaseKind: 'リリース種別',
    signerFingerprint: '署名フィンガープリント',
    artifactSize: 'パッケージサイズ',
    changelog: '変更履歴',
    viewChangelog: '表示',
    needsConfirmation: '確認が必要です',
    enableAfterApply: '適用後に有効化',
    updatePolicy: '更新ポリシー',
    trustSigner: 'この拡張機能の署名フィンガープリントを信頼する',
    pickLocalHint: 'ローカルの拡張機能パッケージ（.kisx）を選択してください'
  },

  policy: {
    manual: '手動',
    auto: '自動',
    pinned: '固定'
  },

  installer: {
    releaseTitle: ({ action, name }: { action: ReleaseActionKind; name: string }) =>
      `拡張機能 ${name} を${RELEASE_ACTIONS[action]}`,
    localTitle: 'ローカル拡張機能パッケージを適用',
    completedTitle: ({ action }: { action: ReleaseActionKind }) =>
      `拡張機能の${RELEASE_ACTIONS[action]}が完了しました`,
    completedSummary: ({
      action,
      name,
      version
    }: {
      action: ReleaseActionKind
      name: string
      version: string
    }) => `${name} v${version} を${RELEASE_ACTIONS[action]}しました`,
    cancelledSummary: ({ action }: { action: ReleaseActionKind }) =>
      `拡張機能の${RELEASE_ACTIONS[action]}はキャンセルされました`,
    localCancelledSummary: '拡張機能パッケージの適用はキャンセルされました',
    phases: {
      waitLock: '拡張機能パッケージの書き込みロックを待機しています',
      prepare: '拡張機能パッケージを準備しています',
      verify: '拡張機能パッケージを検証しています',
      extract: '拡張機能パッケージを展開しています',
      commit: '拡張機能のインストール状態をコミットしています'
    }
  },

  repositoryRefresh: {
    refreshOneTitle: ({ name }: { name: string }) => `リポジトリ ${name} を更新`,
    refreshAllTitle: 'すべての拡張機能リポジトリを更新',
    allSubjectLabel: 'すべての拡張機能リポジトリ',
    cancelledSummary: '拡張機能リポジトリの更新はキャンセルされました',
    preparing: '拡張機能リポジトリの更新を準備しています',
    noneEnabled: '有効な拡張機能リポジトリがありません',
    refreshingOne: ({ name }: { name: string }) => `${name} を更新しています`,
    refreshedOne: ({ name }: { name: string }) => `${name} を更新しました`,
    oneFailedTitle: 'リポジトリの更新に失敗しました',
    oneFailedSummary: ({ name }: { name: string }) => `${name} を更新できませんでした`,
    oneNotModifiedTitle: 'リポジトリに変更はありません',
    oneCompletedTitle: 'リポジトリの更新が完了しました',
    oneNotModifiedSummary: ({ name }: { name: string }) => `${name} は最新です`,
    oneRefreshedSummary: ({ name }: { name: string }) => `${name} を更新しました`,
    allFailedTitle: '拡張機能リポジトリの更新に失敗しました',
    allPartialTitle: '一部の拡張機能リポジトリの更新に失敗しました',
    allCompletedTitle: '拡張機能リポジトリの更新が完了しました',
    noneEnabledSummary: '有効な拡張機能リポジトリはありません',
    allSummary: ({
      processed,
      total,
      succeeded,
      notModified,
      failed
    }: {
      processed: number
      total: number
      succeeded: number
      notModified: number
      failed: number
    }) =>
      `${processed}/${total} 件のリポジトリを処理しました。成功 ${succeeded}、変更なし ${notModified}、失敗 ${failed}。`
  },

  updatePolicyDialog: {
    title: '更新設定',
    policyLabel: '更新ポリシー',
    receivePrerelease: 'プレビュー版の更新を受け取る',
    saved: '更新設定を保存しました',
    saveFailed: '更新設定を保存できませんでした'
  },

  uninstall: {
    title: ({ name }: { name: string }) => `${name} をアンインストールしますか？`,
    purgeData: '拡張機能のデータも削除する',
    confirmPurge: 'アンインストールして削除',
    confirm: 'アンインストール',
    uninstalledPurged: '拡張機能をアンインストールし、データを削除しました',
    uninstalled: '拡張機能をアンインストールしました',
    purgeFailed: '拡張機能はアンインストールされましたが、データの削除に失敗しました',
    failed: 'アンインストールに失敗しました'
  },

  discover: {
    emptyTitle: '拡張機能が見つかりません',
    emptyCategoryDescription: 'このカテゴリには利用できる拡張機能がありません',
    emptyDescription: '利用できる拡張機能はありません',
    loadMore: 'さらに読み込む',
    sortRelevance: '関連度',
    sortName: '名前',
    sortPublishedAt: '公開日',
    sortUpdatedAt: '更新日',
    sortRepositoryPriority: 'リポジトリ',
    searchPlaceholder: '拡張機能の名前や説明を検索…',
    allRepositories: 'すべてのリポジトリ',
    compatibleOnly: '互換バージョンのみ表示',
    allCompatibility: 'すべての互換状態を表示',
    ascending: '昇順',
    descending: '降順',
    allCategories: 'すべて',
    unknownAuthor: '作者不明',
    sourceCount: ({ count }: { count: number }) => `${count} 件のソース`,
    noVersion: 'バージョンなし',
    noDescription: '説明はありません',
    homepage: 'ホームページ',
    details: '詳細',
    installed: 'インストール済み',
    install: 'インストール',
    unknownTime: '日時不明',
    unknownSize: 'サイズ不明',
    extensionId: '拡張機能 ID',
    author: '作者',
    latestPublish: '最新リリース',
    codeRepository: 'コードリポジトリ',
    versions: 'バージョン',
    latestBadge: '最新版',
    previewBadge: 'プレビュー版',
    yankedBadge: '取り下げ済み',
    apiIncompatibleBadge: 'API 非互換',
    noArtifactBadge: 'パッケージなし',
    unsignedBadge: '未署名',
    sourcesLine: ({ value }: { value: string }) => `ソース：${value}`,
    publishedLine: ({ value }: { value: string }) => `公開日時：${value}`,
    apiLine: ({ value }: { value: string }) => `拡張機能 API：${value}`,
    sizeLine: ({ value }: { value: string }) => `パッケージサイズ：${value}`
  },

  installed: {
    filterAll: 'すべて',
    filterEnabled: '有効',
    filterDisabled: '無効',
    sortName: '名前',
    sortStatus: 'ステータス',
    sortHasUpdate: '更新',
    startupUpdating: '起動時更新中',
    repositoryRefreshFailed: 'リポジトリの更新に失敗しました',
    autoUpdateFailedCount: ({ count }: { count: number }) => `${count} 件の自動更新に失敗しました`,
    searchPlaceholder: 'インストール済みの拡張機能を検索…',
    checkUpdates: '更新を確認',
    showAll: 'すべて表示',
    showUpdatesOnly: '更新ありのみ表示',
    ascending: '昇順',
    descending: '降順',
    updatesAvailable: '利用可能な更新があります',
    updatesAvailableCount: ({ count }: { count: number }) => `${count} 件の拡張機能を更新できます`,
    noUpdates: '利用可能な更新はありません',
    checkUpdatesFailed: '更新を確認できませんでした',
    emptyTitle: 'インストール済みの拡張機能はありません',
    emptyDescription: '「見つける」ページから拡張機能をインストールしてください',
    noMatchTitle: '一致する拡張機能がありません',
    noMatchDescription: 'フィルターを調整してみてください',

    unknownVersion: 'バージョン不明',
    statusReady: '正常',
    statusInvalid: 'パッケージが無効',
    statusMissingPackage: 'パッケージが見つかりません',
    runtimeLoading: '読み込み中',
    runtimeRunning: '実行中',
    runtimeFailed: '読み込み失敗',
    runtimeStopped: '停止中',
    builtinManaged: '内蔵拡張機能は Kisaki が管理します',
    enableFailed: '拡張機能を有効化できませんでした',
    packageNotRunnable: '拡張機能パッケージは現在実行できません',
    enabledFeedback: '拡張機能を有効にしました',
    disabledFeedback: '拡張機能を無効にしました',
    operationFailed: '操作に失敗しました',
    extensionOperationFailed: '拡張機能の操作に失敗しました',
    builtinBadge: '内蔵',
    updateBadge: '更新',
    unknownAuthor: '不明',
    noDescription: '説明はありません',
    enableWithApp: 'アプリと同時に有効化',
    enabledState: '有効',
    disabledState: '無効',
    update: '更新',
    detailsTooltip: '詳細',
    updatePolicyTooltip: '更新設定',
    uninstallTooltip: 'アンインストール',

    details: {
      basicInfo: '基本情報',
      extensionId: '拡張機能 ID',
      version: 'バージョン',
      author: '作者',
      unknownAuthor: '作者不明',
      category: 'カテゴリ',
      installedAt: 'インストール日時',
      homepage: 'ホームページ',
      status: 'ステータス',
      enabledStatus: '有効状態',
      enabled: '有効',
      disabled: '無効',
      packageStatus: 'パッケージの状態',
      runtimeStatus: '実行状態',
      runtimeError: '実行エラー',
      installationSource: 'インストール元',
      sourceType: '種類',
      sourceBuiltin: '内蔵拡張機能',
      sourceRepository: 'リポジトリからインストール',
      sourceLocalFile: 'ローカルファイル',
      sourceUnknown: '不明なソース',
      repository: 'リポジトリ',
      repositoryUrl: 'リポジトリ URL',
      releaseDigest: 'リリースダイジェスト',
      manifestDigest: 'マニフェストダイジェスト',
      artifactSha256: 'パッケージ SHA256',
      signerFingerprint: '署名フィンガープリント',
      releaseVersion: 'リリースバージョン',
      publishedAt: '公開日時',
      extensionApi: '拡張機能 API',
      file: 'ファイル',
      installDir: 'インストール先フォルダー',
      updateConfig: '更新設定',
      updatePolicy: '更新ポリシー',
      pinnedVersion: '固定バージョン',
      receivePrerelease: 'プレビュー版の更新を受け取る',
      packageIssues: 'パッケージの問題',
      runtimeDiagnostics: '実行時診断',
      unknownTime: '日時不明',
      severityInfo: '情報',
      severityWarning: '警告',
      severityError: 'エラー'
    }
  },

  repository: {
    none: 'なし',
    stateEnabled: '有効',
    stateDisabled: '無効',
    healthDisabled: '無効',
    healthError: '異常',
    healthNeverRefreshed: '未更新',
    healthOk: '正常',
    added: 'リポジトリを追加しました',
    addFailed: 'リポジトリを追加できませんでした',
    officialAdded: '公式リポジトリを追加しました',
    officialAddFailed: '公式リポジトリを追加できませんでした',
    refreshAllStarted: '拡張機能リポジトリの更新を開始しました',
    refreshFailed: 'リポジトリを更新できませんでした',
    refreshStarted: 'リポジトリの更新を開始しました',
    enabledFeedback: 'リポジトリを有効にしました',
    disabledFeedback: 'リポジトリを無効にしました',
    deleted: 'リポジトリを削除しました',
    operationFailed: 'リポジトリの操作に失敗しました',
    panelTitle: '拡張機能リポジトリ',
    panelSummary: ({ count }: { count: number }) =>
      `${count} 件のリポジトリ。優先度順にカタログを集約します`,
    refreshAll: 'すべて更新',
    addOfficial: '公式リポジトリを追加',
    add: 'リポジトリを追加',
    emptyTitle: '拡張機能リポジトリはありません',
    priorityLine: ({ value }: { value: string }) => `優先度：${value}`,
    packageCountLine: ({ count }: { count: number }) => `パッケージ：${count}`,
    manifestUpdatedLine: ({ value }: { value: string }) => `マニフェスト更新：${value}`,
    lastCheckedLine: ({ value }: { value: string }) => `最終確認：${value}`,
    detailsTooltip: '詳細',

    addDialog: {
      title: '拡張機能リポジトリを追加',
      manifestUrl: 'リポジトリマニフェスト URL',
      displayName: '表示名',
      displayNamePlaceholder: '空欄の場合はマニフェスト名を使用'
    },

    removeDialog: {
      title: ({ name }: { name: string }) => `${name} を削除しますか？`,
      description:
        'このリポジトリを削除しますか？削除後はこのリポジトリから拡張機能カタログを取得しなくなります。インストール済みの拡張機能はアンインストールされません。',
      deleting: '削除中'
    },

    details: {
      basicInfo: '基本情報',
      repositoryId: 'リポジトリ ID',
      priority: '優先度',
      packages: 'パッケージ',
      localState: 'ローカル状態',
      manifestUrl: 'リポジトリマニフェスト URL',
      manifestMetadata: 'マニフェストメタデータ',
      manifestDigest: 'マニフェストダイジェスト',
      manifestUpdatedAt: 'マニフェスト更新日時',
      refreshState: '更新状態',
      lastChecked: '最終確認',
      lastSuccess: '最終成功',
      lastError: '最近のエラー',
      localRecord: 'ローカル記録',
      createdAt: '作成日時',
      updatedAt: '更新日時'
    }
  },

  signer: {
    none: 'なし',
    localConfirmation: 'ローカル確認',
    revoked: '署名の信頼を取り消しました',
    revokeFailed: '署名の信頼を取り消せませんでした',
    panelTitle: '署名の信頼',
    panelSummary: ({ count }: { count: number }) =>
      `${count} 件の拡張機能レベル署名フィンガープリント`,
    emptyTitle: '信頼済みの署名フィンガープリントはありません',
    sourceLine: ({ value }: { value: string }) => `ソース：${value}`,
    trustedAtLine: ({ value }: { value: string }) => `信頼日時：${value}`,
    viewDetails: '詳細を表示',
    revokeTrust: '信頼を取り消す',

    removeDialog: {
      title: '署名の信頼を取り消しますか？',
      description: ({ id }: { id: string }) =>
        `「${id}」の署名の信頼を取り消しますか？新しいリリースがこのフィンガープリントを使用する場合、再確認が必要になります。`,
      revoking: '取り消し中',
      revoke: '取り消す'
    },

    details: {
      title: '署名の詳細',
      extensionId: '拡張機能 ID',
      algorithm: 'アルゴリズム',
      keyId: 'キー ID',
      fingerprint: '署名フィンガープリント',
      publicKey: '公開鍵',
      trustRecordId: '信頼記録 ID',
      sourceRepositoryId: 'ソースリポジトリ ID',
      sourceRepositoryUrl: 'ソースリポジトリ URL',
      trustedAt: '信頼日時',
      createdAt: '作成日時'
    }
  }
} satisfies Messages['extension']
