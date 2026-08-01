import type { Messages } from '../schema'

/** Scanner: page, items, issues, fix dialog, settings, form, test, and extraction rules. */
export const scanner = {
  title: 'スキャナー',
  addScanner: 'スキャナーを追加',
  scanAll: 'すべてスキャン',
  cancelAll: 'すべてキャンセル',
  settingsTooltip: 'スキャナー設定',
  emptyTitle: 'スキャナーはまだありません',
  emptyDescription: 'スキャナーを追加すると、メディアファイルを自動で検出して取り込めます。',

  table: {
    name: '名前',
    type: '種類',
    scraperProfile: 'スクレイパープロファイル',
    targetCollection: '対象コレクション',
    newExisting: '新規 / 既存',
    status: 'ステータス',
    actions: '操作'
  },

  item: {
    statusIdle: '待機中',
    statusQueued: 'キュー待ち',
    statusScanning: 'スキャン中',
    statusPausing: '一時停止中',
    statusPaused: '一時停止',
    statusCancelling: 'キャンセル中',
    statusCompleted: '完了',
    statusCancelled: 'キャンセル済み',
    statusFailed: '失敗',
    pause: '一時停止',
    resume: '再開',
    scan: 'スキャン',
    cancel: 'キャンセル',
    cancelling: 'キャンセル中',
    newCount: ({ count }: { count: number }) => `新規 ${count}`,
    existingCount: ({ count }: { count: number }) => `既存 ${count}`,
    newCountTooltip: 'データベースに追加されたゲーム数',
    existingCountTooltip: 'パスが既に存在するゲーム数',
    issuesTooltip: ({ count }: { count: number }) => `問題 ${count}`,
    deleteTitle: '削除の確認',
    deleteDescription: ({ name }: { name: string }) =>
      `スキャナー「${name}」を削除しますか？この操作は取り消せません。`
  },

  issueTypes: {
    assetPersistFailed: 'アセットの保存に失敗',
    duplicateExternalId: '外部 ID の重複',
    metadataMissing: 'メタデータの欠落',
    pathUnavailable: 'パスにアクセス不可',
    scraperUnavailable: 'スクレイパーが利用不可',
    unexpectedError: '予期しないエラー',
    unsupportedEntry: '未対応のエントリ'
  },

  issues: {
    title: 'スキャンの問題',
    totalCount: ({ count }: { count: number }) => `全 ${count} 件`,
    searchPlaceholder: '名前、パス、原因を検索…',
    allTypes: 'すべての種類',
    noMatch: '一致する問題がありません。',
    table: {
      name: '名前',
      type: '種類',
      path: 'パス',
      reason: '原因',
      relatedGame: '関連ゲーム',
      actions: '操作'
    },
    openPath: 'パスを開く',
    addToExclusion: 'スキャン除外リストに追加',
    fixAndRescrape: '修正して再スクレイプ',
    alreadyExcluded: '既に除外リストにあります。',
    addedToExclusion: 'スキャン除外リストに追加しました。',
    excludeFailed: '除外リストに追加できませんでした'
  },

  fix: {
    title: 'スキャン結果を修正',
    updateExisting: '既存のゲームを更新',
    readdGame: 'ゲームを再追加',
    started: '再スクレイプを開始しました。',
    startFailed: '修正を開始できませんでした',
    unknownError: '不明なエラー',
    rescrape: '再スクレイプ'
  },

  settings: {
    title: 'スキャナー設定',
    saved: '設定を保存しました。',
    saveFailed: '保存に失敗しました',
    startAtOpen: '起動時に自動スキャン',
    startAtOpenDescription: 'アプリを開いたときにすべてのスキャナーを自動実行します。',
    ingestMode: '取り込みモード',
    ingestModeDescription: 'スキャナーが新しいゲームを検出した際の取り込み方法を制御します。',
    ingestPreferScraper: 'スクレイパー優先',
    ingestPreferScraperDescription:
      'まずスクレイパーで取り込み、失敗した場合は直接取り込みにフォールバックします。',
    ingestRequireScraper: 'スクレイパー必須',
    ingestRequireScraperDescription:
      'スクレイパー経由でのみ取り込み、スクレイプに失敗した場合は失敗として記録します。',
    ingestDirectOnly: '直接取り込みのみ',
    ingestDirectOnlyDescription: 'スクレイパーを使わず、認識結果からそのままゲームを作成します。',
    parallelCount: '並列処理数',
    parallelCountDescription:
      '1 つのスキャナーが同時に処理するエントリ数。1 は逐次処理を意味します。',
    ignoredNames: '無視する名前',
    ignoredNamesDescription: 'スキャナーは抽出後のこれらのエンティティ名をスキップします。',
    ignoredNamePlaceholder: '無視する名前を入力…',
    noIgnoredNames: '無視する名前はまだありません。'
  },

  form: {
    createTitle: 'スキャナーを作成',
    editTitle: 'スキャナーを編集',
    requiredFields: '必須項目を入力してください。',
    updated: 'スキャナーを更新しました。',
    created: 'スキャナーを作成しました。',
    updateFailed: '更新に失敗しました。もう一度お試しください。',
    createFailed: '作成に失敗しました。もう一度お試しください。',
    openLinkFailed: 'リンクを開けませんでした',
    name: '名前',
    namePlaceholder: '例：マイゲームライブラリ',
    type: '種類',
    scanPath: 'スキャンパス',
    scanPathPlaceholder: 'スキャンするフォルダーを選択',
    entityDepth: 'エンティティ階層',
    entityDepthHelp:
      'ディレクトリ構造内でメディアエンティティが位置する階層の深さです。0 はスキャンパスの直下がエンティティ、1 はサブディレクトリ内の項目がエンティティ、以降同様です。',
    scraperProfile: 'スクレイパープロファイル',
    scraperProfileHelp:
      'メタデータの取得に使うスクレイパープロファイルです。どのデータソースからどのフィールドを取得するかを決めます。',
    targetCollection: '対象コレクション',
    scanInterval: '自動スキャン間隔',
    scanIntervalDescription: '0 に設定すると自動スキャンを行いません。',
    minutes: '分',
    nameExtractionRules: '名前抽出ルール',
    nameExtractionRulesHelp:
      '正規表現ルールを順番に適用し、フォルダー名からゲーム名を抽出します。ルールは名前付きキャプチャグループ (?<name>...) で名前を抽出します。',
    nameExtractionRulesLink: '名前付きキャプチャグループのドキュメントを見る',
    editRules: 'ルールを編集',
    notConfigured: '未設定',
    ruleCount: ({ count }: { count: number }) => `${count} 件`,
    testConfig: '設定をテスト'
  },

  test: {
    title: 'スキャナー設定テスト',
    depth: '階層',
    rules: 'ルール',
    entities: 'エンティティ',
    matched: '一致',
    noEntitiesFound: '指定した階層でエンティティが見つかりませんでした。',
    allExcluded: 'すべてのエンティティが除外されています。',
    entityName: 'エンティティ名',
    extractedName: '抽出後の名前',
    rule: 'ルール',
    addToExclusion: '除外リストに追加'
  },

  rules: {
    title: '名前抽出ルール',
    empty: 'ルールはまだありません。下のボタンから追加してください。',
    unnamedRule: '（名称未設定のルール）',
    addRule: 'ルールを追加',
    selectPresets: 'プリセットを選択',
    itemAddTitle: 'ルールを追加',
    itemEditTitle: 'ルールを編集',
    description: '説明',
    descriptionPlaceholder: '例：角括弧のプレフィックスを削除',
    pattern: '正規表現',
    patternHintBefore: '名前付きキャプチャグループ',
    patternHintAfter: 'で抽出する名前を指定します。',
    presetsTitle: 'プリセットルールを選択',
    presetsAllAdded: 'すべてのプリセットルールが追加済みです。',
    addWithCount: ({ count }: { count: number }) => `追加 (${count})`,
    presets: {
      bracketPrefix: { name: '角括弧プレフィックス [xxx]', description: '先頭の [xxx] を削除' },
      parenPrefix: { name: '丸括弧プレフィックス (xxx)', description: '先頭の (xxx) を削除' },
      multiBracketPrefix: {
        name: '複数の角括弧プレフィックス',
        description: '連続する先頭の [xxx] を削除'
      },
      bracketSuffix: { name: '角括弧サフィックス [xxx]', description: '末尾の [xxx] を削除' },
      parenSuffix: { name: '丸括弧サフィックス (xxx)', description: '末尾の (xxx) を削除' },
      versionSuffix: { name: 'バージョンサフィックス _vX.X', description: '_v1.2.3 を削除' },
      yearSuffix: { name: '年サフィックス (YYYY)', description: '(2024) を削除' },
      langSuffix: { name: '言語サフィックス', description: 'CHS/CHT/JP/EN などを削除' },
      bracketBoth: {
        name: '前後の角括弧',
        description: '[プレフィックス] と [サフィックス] を削除'
      }
    }
  },

  run: {
    title: ({ name }: { name: string }) => `${name} をスキャン`,
    preparing: 'スキャンを準備しています',
    discovering: 'ディレクトリをスキャンしています',
    processing: 'スキャン結果を処理しています',
    finished: 'スキャンが完了しました',
    resultCompleted: 'スキャン完了',
    resultCancelled: 'スキャンをキャンセルしました',
    resultFailed: 'スキャンに失敗しました',
    resultSummary: ({
      status,
      processed,
      total,
      added,
      existing,
      failed,
      issues
    }: {
      status: string
      processed: number
      total: number
      added: number
      existing: number
      failed: number
      issues: number
    }) =>
      `${status}：処理 ${processed}/${total}、追加 ${added}、既存 ${existing}、失敗 ${failed}、問題 ${issues}`,
    reasons: {
      scrapeUnavailableRequired:
        'スクレイプ設定が利用できず、このモードではスクレイプが必須のため追加しませんでした。',
      noMetadataRequired:
        '利用できるメタデータが見つからず、このモードではスクレイプが必須のため追加しませんでした。',
      scrapeFailedRequired:
        'スクレイプに失敗し、このモードではスクレイプが必須のため追加しませんでした。',
      scrapeUnavailableFallback:
        'スクレイプ設定が利用できないため、フォルダー名でそのまま追加しました。',
      noMetadataFallback:
        '利用できるメタデータが見つからないため、フォルダー名でそのまま追加しました。',
      scrapeFailedFallback: 'スクレイプに失敗したため、フォルダー名でそのまま追加しました。',
      pathInaccessible: ({ message }: { message: string }) =>
        `パスにアクセスできないため追加しませんでした：${message}`,
      notScannableDirectory: 'パスはスキャン可能なディレクトリではないため追加しませんでした。',
      externalIdLinked:
        '外部 ID が既存のゲームに関連付けられているため、このパスは追加しませんでした。'
    }
  }
} satisfies Messages['scanner']
