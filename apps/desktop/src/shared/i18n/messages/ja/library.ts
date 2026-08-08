import type { Messages } from '../schema'

export const library = {
  entities: {
    game: 'ゲーム',
    character: 'キャラクター',
    person: '人物',
    company: '会社',
    collection: 'コレクション',
    tag: 'タグ'
  },

  fields: {
    name: '名前',
    sortName: 'ソート名',
    originalName: '原名',
    description: '概要',
    score: 'スコア',
    myScore: 'マイスコア',
    gender: '性別',
    age: '年齢',
    birthDate: '誕生日',
    deathDate: '命日',
    foundedDate: '設立日',
    releaseDate: '発売日',
    addedDate: '追加日',
    bloodType: '血液型',
    height: '身長',
    weight: '体重',
    bust: 'バスト',
    waist: 'ウエスト',
    hips: 'ヒップ',
    cup: 'カップ',
    measurements: 'スリーサイズ',
    tags: 'タグ',
    collections: 'コレクション',
    relatedGames: '関連ゲーム',
    relatedPersons: '関連人物',
    relatedCharacters: '関連キャラクター',
    relatedCompanies: '関連会社',
    characterPersons: 'キャラクター関連人物',
    relatedSites: '関連リンク',
    externalIds: '外部 ID',
    photos: '写真',
    covers: 'カバー',
    backdrops: '背景',
    logos: 'ロゴ',
    icons: 'アイコン',
    note: 'メモ',
    role: '役割',
    type: '種類',
    status: 'ステータス',
    playDuration: 'プレイ時間',
    lastActiveAt: '最終プレイ',
    order: '並び順'
  },

  status: {
    notStarted: '未プレイ',
    inProgress: 'プレイ中',
    partial: '一部クリア',
    completed: 'クリア済み',
    multiple: '周回プレイ',
    shelved: '積みゲー'
  },

  gender: {
    male: '男性',
    female: '女性',
    other: 'その他'
  },

  bloodType: {
    a: 'A型',
    b: 'B型',
    o: 'O型',
    ab: 'AB型'
  },

  roles: {
    gamePerson: {
      director: 'ディレクター',
      scenario: 'シナリオ',
      illustration: '原画',
      music: '音楽',
      programmer: 'プログラム',
      actor: '声優',
      other: 'その他'
    },
    characterPerson: {
      actor: '声優',
      illustration: '原画',
      designer: 'デザイン',
      other: 'その他'
    },
    gameCharacter: {
      main: 'メイン',
      supporting: 'サブ',
      cameo: 'カメオ',
      other: 'その他'
    },
    gameCompany: {
      developer: '開発',
      publisher: '発売',
      distributor: '販売',
      other: 'その他'
    }
  },

  counts: {
    game: ({ count }: { count: number }) => `${count} 本のゲーム`,
    character: ({ count }: { count: number }) => `${count} 体のキャラクター`,
    person: ({ count }: { count: number }) => `${count} 名の人物`,
    company: ({ count }: { count: number }) => `${count} 社`,
    collection: ({ count }: { count: number }) => `${count} 件のコレクション`,
    tag: ({ count }: { count: number }) => `${count} 件のタグ`
  },

  spoiler: {
    maskedName: 'ネタバレ内容',
    maskedNote: '非表示です。「ネタバレを表示」をオンにすると確認できます'
  },

  menu: {
    addToCollection: 'コレクションに追加',
    removeFromCollection: 'コレクションから削除',
    noCollections: '利用可能なコレクションがありません',
    newCollection: '新しいコレクション…',
    playStatus: 'プレイ状況',
    editScore: 'スコアを編集',
    favorite: 'お気に入り',
    setFavorite: 'お気に入りに設定',
    unsetFavorite: 'お気に入りを解除',
    openGameDir: 'ゲームフォルダーを開く',
    launchConfig: '起動設定',
    media: 'メディア管理',
    updateMetadata: 'メタデータを更新',
    manageExternalIds: '外部 ID を管理',
    mergeDuplicates: '重複エンティティを統合',
    editInfo: '情報を編集',
    editContent: '内容を編集',
    editFilter: 'フィルターを編集',
    convertToStatic: '静的に変換',
    batchUpdateMetadata: 'メタデータを一括更新',
    batchDelete: '一括削除'
  },

  feedback: {
    addedToCollection: 'コレクションに追加しました',
    addFailed: '追加に失敗しました',
    removedFromCollection: 'コレクションから削除しました',
    removeFailed: '削除に失敗しました',
    statusUpdated: 'ステータスを更新しました',
    updateFailed: '更新に失敗しました',
    createFailed: '作成に失敗しました',
    favoriteAdded: 'お気に入りに追加しました',
    favoriteRemoved: 'お気に入りを解除しました',
    nsfwMarked: 'NSFW としてマークしました',
    nsfwCleared: 'NSFW マークを解除しました',
    saveFailedRetry: '保存に失敗しました。もう一度お試しください',
    deleteFailedWithReason: ({ message }: { message: string }) => `削除に失敗しました：${message}`,
    searchFailed: '検索に失敗しました',
    unknownError: '不明なエラー',
    gameDirNotSet: 'ゲームフォルダーが設定されていません',
    openGameDirFailed: 'ゲームフォルダーを開けません',
    pickFileFailed: 'ファイルの選択に失敗しました',
    pickCoverFailed: 'カバーの選択に失敗しました',
    deletedSummary: ({ items }: { items: string[] }) =>
      items.length > 0 ? `${items.join('、')}を削除しました` : '削除しました',
    nameAndMore: ({ name, count }: { name: string; count: number }) => `${name} など ${count} 件`
  },

  select: {
    searchPlaceholder: ({ label }: { label: string }) => `${label}を検索…`,
    selectPlaceholder: ({ label }: { label: string }) => `${label}を選択…`
  },

  searcher: {
    scraperProfile: 'スクレイパープロファイル',
    searchLabel: ({ label }: { label: string }) => `${label}を検索`,
    namePlaceholder: ({ label }: { label: string }) => `${label}名を入力…`,
    columnName: '名前',
    columnOriginalName: '原名',
    columnBirth: '生年月日',
    columnDeath: '没年月日',
    columnFounded: '設立',
    columnReleaseDate: '発売日',
    startHint: ({ label }: { label: string }) => `${label}名を入力して検索を開始`,
    noMatchTitle: '一致する結果がありません',
    noMatchDescription: '別のキーワードをお試しください。',
    resultCount: ({ count }: { count: number }) => `全 ${count} 件`,
    selectedOne: '1 件選択中',
    idLabel: ({ label }: { label: string }) => `${label} ID`,
    idDescription: '検索結果から選択するか、ID を直接入力します。',
    idPlaceholder: '上から選択するか直接入力…'
  },

  detail: {
    notFoundTitle: ({ label }: { label: string }) => `${label}が見つかりません`,
    notFoundDescription: ({ label }: { label: string }) =>
      `この${label}は削除された可能性があります。`,
    tabs: {
      overview: '概要',
      characters: 'キャラクター',
      persons: '人物',
      companies: '会社',
      relatedGames: '関連ゲーム',
      relatedPersons: '関連人物',
      relatedCharacters: '関連キャラクター',
      activity: 'アクティビティ',
      saves: 'セーブ',
      notes: 'ノート'
    },
    tooltips: {
      score: 'スコア',
      favoriteAdd: 'お気に入りに追加',
      favoriteRemove: 'お気に入りを解除',
      spoilerShow: 'ネタバレを表示',
      spoilerHide: 'ネタバレを隠す',
      openDir: 'フォルダーを開く'
    },
    sections: {
      description: '概要',
      tags: 'タグ',
      relatedSites: '関連リンク',
      details: '詳細情報'
    },
    empty: {
      description: '概要はまだありません',
      tags: 'タグはまだありません',
      relatedSites: '関連リンクはまだありません',
      relatedGames: '関連ゲームはまだありません',
      relatedPersons: '関連人物はまだいません',
      relatedCharacters: '関連キャラクターはまだいません',
      characters: 'キャラクターはまだいません',
      persons: '人物はまだいません',
      companies: '会社はまだありません'
    },
    manage: '管理',
    ageValue: ({ age }: { age: number }) => `${age}歳`,
    addEntity: ({ label }: { label: string }) => `${label}を追加`,
    collectionEmptyTitle: ({ label }: { label: string }) =>
      `このコレクションに${label}はまだありません`,
    collectionEmptyDescription: ({ label }: { label: string }) =>
      `スキャナーで${label}をこのコレクションに追加します。`,
    tagEmptyTitle: ({ label }: { label: string }) => `このタグの${label}はまだありません`,
    tagEmptyDescription: ({ label }: { label: string }) =>
      `このタグを使う${label}はまだありません。`
  },

  forms: {
    editBasicInfo: '基本情報を編集',
    editDetails: '詳細情報を編集',
    editDescription: '概要を編集',
    editScore: 'スコアを編集',
    editName: '名前を編集',
    editOriginalName: '原名を編集',
    editTags: 'タグを編集',
    editRelatedSites: '関連リンクを編集',
    editTag: 'タグを編集',
    manageMedia: 'メディア管理',
    manageExternalIds: '外部 ID を管理',
    addEntityTitle: ({ label }: { label: string }) => `${label}を追加`,
    editEntityTitle: ({ label }: { label: string }) => `${label}を編集`,

    editGameCharacters: 'キャラクターを編集',
    editGamePersons: '人物を編集',
    editGameCompanies: '会社を編集',
    editCharacterGames: '登場ゲームを編集',
    editCharacterPersons: '関連スタッフを編集',
    editPersonGames: '参加ゲームを編集',
    editPersonCharacters: '担当キャラクターを編集',
    editCompanyGames: '関連ゲームを編集',
    editCollectionEntities: 'コレクション内容を編集',

    notePlaceholder: '任意のメモ…',
    noteInfoPlaceholder: 'メモ…',
    includesSpoiler: 'ネタバレを含む',
    showSpoilers: 'ネタバレを表示',
    hideSpoilers: 'ネタバレを隠す',
    emptyListHint: ({ label }: { label: string }) =>
      `${label}はまだありません。下のボタンから追加できます`,
    selectEntityRequired: ({ label }: { label: string }) => `${label}を選択してください`,

    namePlaceholder: ({ label }: { label: string }) => `${label}名`,
    originalNamePlaceholder: '原語の名前',
    sortNamePlaceholder: '並べ替えに使う名前',
    selectGender: '性別を選択',
    selectBloodType: '血液型を選択',
    agePlaceholder: '歳',
    birthDateInvalidInteger: '誕生日には整数のみ入力できます。',
    deathDateInvalidInteger: '命日には整数のみ入力できます。',
    birthDateInvalidFormat: '誕生日の形式が正しくありません。',
    deathDateInvalidFormat: '命日の形式が正しくありません。',
    foundedDateInvalidFormat: '設立日の形式が正しくありません。',
    releaseDateInvalidFormat: '発売日の形式が正しくありません。',
    foundedDateYearDayWithoutMonth: '設立日に年と日を入力する場合は、月も入力してください。',
    releaseDateYearDayWithoutMonth: '発売日に年と日を入力する場合は、月も入力してください。',

    scoreRangeHint: 'スコアは 0〜10 で、小数第 1 位まで入力できます（例：8.5）。',
    scoreOutOfRange: 'スコアは 0〜10 の範囲で入力してください。',

    markdownSupported: 'Markdown 対応',
    descriptionPlaceholder: ({ label }: { label: string }) =>
      `${label}の概要を入力（Markdown 対応）…`,

    addLink: 'リンクを追加',
    editLink: 'リンクを編集',
    siteNameLabel: '名前',
    siteNamePlaceholder: '例：公式サイト、VNDB…',
    siteUrlLabel: 'URL',
    requiredFieldsMissing: '必須項目を入力してください',
    deleteLinkConfirmTitle: 'リンクを削除しますか？',
    deleteLinkConfirmDescription: 'このリンクを削除します。この操作は元に戻せません。',

    addExternalId: '外部 ID を追加',
    editExternalId: '外部 ID を編集',
    externalIdSourceLabel: 'ソース',
    externalIdSourcePlaceholder: '例：vndb、steam、bangumi',
    externalIdValueLabel: '外部 ID',
    externalIdValuePlaceholder: '例：v12345',
    externalIdSourceAndIdRequired: 'ソースと ID を入力してください',
    externalIdEmptyValues: '空の外部 ID があります。確認して再試行してください',
    externalIdDuplicates: '重複した外部 ID があります。確認して再試行してください',
    externalIdSaveFailed:
      '保存に失敗しました。他のエンティティと外部 ID が重複していないか確認してください',
    emptyExternalIdsHint: '外部 ID はまだありません。下のボタンから追加できます',

    addTag: 'タグを追加',
    editTagLink: 'タグを編集',
    selectTagRequired: 'タグを選択してください',
    emptyTagsHint: 'タグはまだありません。下のボタンから追加できます',
    tagNamePlaceholder: 'タグ名',
    tagDescriptionPlaceholder: 'タグの説明（任意、Markdown 対応）',
    tagNsfwHint: 'このタグをアダルトコンテンツとしてマークします。',

    mediaUpdated: 'メディアを更新しました',
    mediaDeleted: 'メディアを削除しました',
    importFromFile: 'ファイルから読み込み',
    importFromUrl: 'URL から読み込み',
    searchImages: '画像を検索',
    crop: 'トリミング',
    emptyMedia: ({ label }: { label: string }) => `${label}はまだありません`,
    imageEntityLabel: '画像',
    mediaTypes: {
      cover: 'カバー',
      backdrop: '背景',
      logo: 'ロゴ',
      icon: 'アイコン',
      photo: '写真'
    },
    mediaDescriptions: {
      gameCover: 'カードやリストに表示されるゲームカバー画像。',
      gameBackdrop: '詳細ページの背景画像。',
      gameLogo: 'ゲームタイトルのロゴ。',
      gameIcon: '小さいサイズのアイコン。',
      characterPhoto: 'カードや詳細に表示されるキャラクター写真。',
      personPhoto: 'カードや詳細に表示される人物写真。',
      companyLogo: 'カードや詳細に表示される会社ロゴ。'
    },
    importMediaFromUrlTitle: ({ label }: { label: string }) => `URL から${label}を読み込み`,
    importMediaFromUrlDescription: ({ label }: { label: string }) =>
      `画像 URL を入力して${label}を読み込みます。`,
    imageUrlLabel: '画像 URL',
    imageUrlInvalid: '有効な URL を入力してください',
    imageFormatsHint: 'JPG、PNG、WebP などの一般的な画像形式に対応しています。',
    previewLabel: 'プレビュー：',
    previewLoadFailed: 'プレビューを読み込めません',
    importing: '読み込み中…',
    searchMediaTitle: ({ label }: { label: string }) => `${label}を検索`,
    searchKeywordPlaceholder: '検索キーワードを入力…',
    searchStartHint: '検索を押して開始します。',
    searchFailedHint: '検索に失敗しました',
    searchNoImages: '該当する画像が見つかりません',
    confirmSelection: '選択を確定',
    cropMediaTitle: ({ label }: { label: string }) => `${label}をトリミング`,
    cropFailed: 'トリミングに失敗しました',

    updateMetadataTitle: 'メタデータを更新',
    batchUpdateMetadataTitle: 'メタデータを一括更新',
    batchSelectedCount: ({ count, label }: { count: number; label: string }) =>
      `${count} 件の${label}`,
    scraperConfigLabel: 'スクレイパープロファイル',
    updateFieldsLabel: '更新する項目',
    selectAll: 'すべて選択',
    selectNone: 'すべて解除',
    scalarStrategyLabel: '単一値の戦略',
    scalarStrategyPlaceholder: '単一値の戦略を選択…',
    scalarStrategyIfMissing: '欠落時のみ書き込み',
    scalarStrategyOverwrite: '既存値を上書き',
    scalarStrategyIfMissingHint: '現在の値が欠落している場合のみ新しい値を書き込みます。',
    scalarStrategyOverwriteHint: '利用可能な新しい値があれば現在の値を上書きします。',
    collectionStrategyLabel: 'コレクションの戦略',
    collectionStrategyPlaceholder: 'コレクションの戦略を選択…',
    collectionStrategyMerge: 'マージして追加',
    collectionStrategyReplace: '全体を置き換え',
    collectionStrategyMergeHint: '既存の内容を保持し、新しい項目を追加します。',
    collectionStrategyReplaceHint:
      '現在の内容を新しい内容で置き換えます。取得元が空と明示したコレクションは削除されます。',
    useExternalIdsLabel: '現在の外部 ID で対象を特定する',
    useExternalIdsHint:
      '現在の項目が誤った対象に対応している可能性がある場合は有効にしないでください。',
    personStandaloneHint: '「人物」は独立した項目として個別に選択して更新できます。',
    batchSilentSearchHint:
      '「原名」に基づいてサイレント検索を実行し、最初の結果を既定で採用して、単体の更新フローを再利用します。',
    rendererSearchHint:
      '検索フローは引き続き renderer 側で実行され、送信時に更新リクエストを 1 回だけ送ります。',
    updating: '更新中…',
    update: '更新',
    startUpdateFailed: '更新を開始できません',
    startBatchUpdateFailed: '一括更新を開始できません',

    deleteRelatedOption: ({ items }: { items: string }) => `関連する${items}も削除する`,
    andMoreCount: ({ count }: { count: number }) => `…全 ${count} 件`,
    addToScannerIgnoreFolder: ({ name }: { name: string }) =>
      `フォルダー「${name}」をスキャナーの除外リストに追加`,
    addToScannerIgnoreName: ({ name }: { name: string }) =>
      `「${name}」をスキャナーの除外リストに追加`,

    newCollection: '新しいコレクション',
    editCollection: 'コレクションを編集',
    collectionNamePlaceholder: 'コレクション名を入力',
    coverLabel: 'カバー',
    pickCover: 'カバーを選択',
    collectionDescriptionPlaceholder: '説明を追加（任意、Markdown 対応）',
    collectionTypeLabel: '種類',
    collectionTypeHint:
      '静的コレクションは手動で内容を追加し、動的コレクションはフィルター条件に基づいて自動更新されます。',
    staticCollection: '静的コレクション',
    dynamicCollection: '動的コレクション',
    nsfwLabel: 'アダルトコンテンツ',
    collectionNsfwHint: 'このコレクションをアダルトコンテンツとしてマークします。',
    collectionUpdated: 'コレクションを更新しました',
    collectionCreated: 'コレクションを作成しました',
    collectionCreatedWithEntities: ({ label }: { label: string }) =>
      `コレクションを作成し、${label}を追加しました`,
    itemEntityLabel: 'アイテム',
    convertToStaticTitle: '静的コレクションに変換',
    convertToStaticDescriptionWithCount: ({ count }: { count: number }) =>
      `動的コレクションを静的コレクションに変換します。現在のフィルター結果（全 ${count} 件）がコレクションの内容として固定されます。変換後、内容はデータの変化に応じて自動更新されなくなります。`,
    convertToStaticDescription:
      '動的コレクションを静的コレクションに変換します。変換後、内容は自動更新されなくなります。',
    converting: '変換中…',
    confirmConvert: '変換する',
    convertedToStatic: '静的コレクションに変換しました',
    convertFailed: '変換に失敗しました',
    dynamicConfigTitle: '動的フィルター設定',
    enabledTypesCount: ({ count }: { count: number }) => `${count} 種類を有効化`,
    filterLabel: 'フィルター',
    sortLabel: '並び順：',
    sortAsc: '昇順',
    sortDesc: '降順',
    dynamicConfigHint:
      '有効化されているがフィルター条件が未設定の種類は、その種類のすべての項目を含みます。',
    filterConfigUpdated: 'フィルター設定を更新しました',

    gameLabel: 'ゲーム',
    characterLabel: 'キャラクター',
    personLabel: '人物',
    companyLabel: '会社',
    tagLabel: 'タグ',
    relationTypeLabel: '関係の種類',
    selectTypePlaceholder: '種類を選択',
    characterRoleLabel: 'キャラクターの役割',
    personRoleLabel: '人物の役割',
    companyRoleLabel: '会社の役割',
    creditRoleLabel: '役職',

    linkLabels: {
      game: 'ゲームの関連付け',
      character: 'キャラクターの関連付け',
      person: '人物の関連付け',
      company: '会社の関連付け',
      tag: 'タグの関連付け',
      link: 'リンク',
      externalId: '外部 ID'
    }
  },

  pages: {
    libraryTitle: 'ライブラリ',
    globalSearch: 'グローバル検索',
    showcaseTitle: 'ショーケース',
    manageSections: 'セクションを管理',
    collectionsTitle: 'コレクション',
    newCollection: '新規コレクション',
    collectionsEmptyTitle: 'コレクションはまだありません',
    collectionsEmptyDescription: 'コレクションを作成してライブラリを整理しましょう。',
    favoritesTitle: 'お気に入り',
    favoritesEmpty: ({ label }: { label: string }) => `お気に入りの${label}はまだありません。`,
    uncategorizedTitle: ({ label }: { label: string }) => `未分類の${label}`,
    uncategorizedEmpty: ({ label }: { label: string }) => `すべての${label}が分類済みです。`,
    dynamicCollection: 'ダイナミックコレクション',
    playStatus: 'プレイ状況'
  },

  explorer: {
    filter: 'フィルター',
    sort: '並べ替え',
    sortAsc: '昇順',
    sortDesc: '降順',
    overrideCollectionSort: 'コレクション内の並び順を上書き',
    searchPlaceholder: '検索…',
    filteredResults: 'フィルター結果',
    noMatch: '一致する結果がありません。',
    emptyList: ({ label }: { label: string }) => `${label}はまだありません。`,
    uncategorized: '未分類'
  },

  search: {
    title: 'ライブラリ検索',
    description: 'ゲーム、キャラクター、人物、会社を検索',
    placeholder: 'ゲーム、キャラクター、人物、会社を検索…',
    typeToSearch: 'キーワードを入力して検索します。',
    emptyResult: ({ label }: { label: string }) => `${label}の結果はありません。`,
    navigate: '移動',
    select: '選択',
    totalResults: ({ count }: { count: number }) => `全 ${count} 件の結果`
  },

  showcase: {
    emptyTitle: 'ショーケースは空です',
    emptyDescription:
      'セクションを追加してゲーム、キャラクター、人物、会社を展示しましょう。各セクションには独自のフィルターとレイアウトを設定できます。',
    addFirstSection: '最初のセクションを追加',
    sectionEmpty: ({ label }: { label: string }) => `${label}はまだありません。`,
    layoutHorizontal: '横スクロール',
    layoutGrid: 'グリッド',

    manage: {
      title: 'セクションを管理',
      empty: 'セクションはまだありません。下のボタンから追加してください。',
      unnamed: '名称未設定',
      show: '表示',
      hide: '非表示',
      addSection: 'セクションを追加',
      selectPresets: 'プリセットを選択',
      sectionEntityLabel: 'セクション',
      saved: '保存しました。',
      saveFailed: '保存に失敗しました。もう一度お試しください。'
    },

    form: {
      addTitle: 'セクションを追加',
      editTitle: 'セクションを編集',
      titleRequired: 'セクションのタイトルを入力してください。',
      title: 'タイトル',
      titlePlaceholder: 'セクションのタイトルを入力…',
      entityType: 'エンティティの種類',
      layout: 'レイアウト',
      openMode: '開き方',
      openModePage: 'ページ',
      openModeDialog: 'ダイアログ',
      cardSize: 'カードサイズ',
      cardSizeXs: '最小',
      cardSizeSm: '小',
      cardSizeMd: '中',
      cardSizeLg: '大',
      cardSizeXl: '最大',
      displayCount: '表示数',
      displayCountUnlimited: '無制限',
      sort: '並べ替え',
      sortAsc: '昇順',
      sortDesc: '降順',
      filters: 'フィルター条件',
      filtersSetCount: ({ count }: { count: number }) => `${count} 件の条件を設定済み`,
      filtersClickToSet: 'クリックしてフィルター条件を設定…'
    },

    presetsDialog: {
      title: 'プリセットセクションを選択',
      empty: '利用できるプリセットはありません。',
      addWithCount: ({ count }: { count: number }) => `追加 (${count})`
    },

    presets: {
      recentlyPlayed: {
        name: '最近プレイ',
        description: '最終アクティブ日時で並べたゲーム'
      },
      topRated: { name: '高評価ゲーム', description: 'スコアで並べたゲーム' },
      recentlyAdded: { name: '最近追加', description: '追加日時で並べたゲーム' },
      allGames: { name: 'すべてのゲーム', description: 'ライブラリ内のすべてのゲーム' },
      favoriteGames: { name: 'お気に入りのゲーム', description: 'お気に入りにしたゲーム' },
      favoriteCharacters: {
        name: 'お気に入りのキャラクター',
        description: 'お気に入りにしたキャラクター'
      },
      favoritePersons: { name: 'お気に入りの人物', description: 'お気に入りにした人物' },
      favoriteCompanies: { name: 'お気に入りの会社', description: 'お気に入りにした会社' },
      allCollections: {
        name: 'すべてのコレクション',
        description: 'ライブラリ内のすべてのコレクション'
      },
      allTags: { name: 'すべてのタグ', description: 'ライブラリ内のすべてのタグ' }
    }
  }
} satisfies Messages['library']
