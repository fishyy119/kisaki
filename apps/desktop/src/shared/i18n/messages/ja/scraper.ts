import type { Messages } from '../schema'

export const scraper = {
  providerSelect: {
    placeholder: 'プロバイダーを選択…',
    empty: '利用可能なプロバイダーがありません',
    unavailable: '利用不可',
    unsupported: '非対応'
  },
  profileSelect: {
    placeholder: 'スクレイパープロファイルを選択',
    empty: 'プロファイルがありません',
    none: 'プロファイルを使用しない'
  },
  recipes: {
    gameVisualNovel: {
      name: 'ビジュアルノベル',
      description: 'VNDB のカタログを軸に、ローカライズ情報とアートを周辺で補完'
    },
    gameVideoGame: {
      name: 'ビデオゲーム',
      description: '最も広いゲームメタデータ。アート全スロットを SteamGridDB がリード'
    },
    anime: {
      name: 'アニメ',
      description: 'シーズン単位のアニメエントリ。エピソード・キャスト・フルアート対応'
    },
    comic: {
      name: 'コミック',
      description: 'マンガメタデータ。巻ごとのカバーは MangaDex から'
    },
    novelLightNovel: {
      name: 'ライトノベル',
      description: 'ライトノベルのメタデータ。巻・キャラクター・カバー対応'
    },
    novelFiction: {
      name: '一般書籍',
      description: '汎用書誌データ。クロスソース識別子と ISBN で整合'
    },
    person: {
      name: '人物',
      description: 'スタッフ・作者・声優。ポートレート付き'
    },
    company: {
      name: '会社',
      description: 'スタジオ・出版社・ブランド。ロゴ付き'
    },
    character: {
      name: 'キャラクター',
      description: 'キャラクター情報。ポートレートとキャスト出演付き'
    }
  },
  newProfile: {
    pathTitle: 'プロファイルを作成',
    confirmTitle: '新しいプロファイルの確認',
    paths: {
      recipes: 'おすすめ',
      provider: '単一ソース',
      blank: '空白'
    },
    recipesHint:
      'シーン別のキュレーション構成。プロバイダーと順序は選択したコンテンツ言語に従います',
    blankHint: '検索ソースを選択します。すべてのスロットは空から始まります',
    providerMissing: '未インストール',
    recipeUnavailable: 'このシーンで利用可能な検索ソースが現在ありません',
    noRecipes: 'このメディアタイプにはおすすめシーンがありません',
    previewTitle: '生成されるスロット',
    previewEmpty: '現在のプロバイダーではスロットを埋められません'
  },
  recipeUpdate: {
    badge: '更新の提案',
    title: '推奨構成が変わりました',
    hint: 'このシーンの現在の推奨がプロファイル構成と異なります。適用すると検索ソースとスロット設定を上書きします。',
    beforeLabel: '現在',
    afterLabel: '提案',
    apply: '提案を適用',
    dismiss: 'この提案を無視',
    emptySlot: '（空）'
  },

  profiles: {
    manageTitle: 'スクレイパープロファイル管理',
    emptyProfiles: 'プロファイルがありません。下のボタンから追加してください。',
    unnamed: '（名称未設定）',
    addProfile: 'プロファイルを追加',
    profileEntityLabel: 'プロファイル',
    deleteUsedByScanners: ({ count }: { count: number }) =>
      `${count} 件のスキャナーがこのプロファイルを使用しています。削除するとスクレイピングせずに直接取り込みます。`,
    newTitleEntityType: 'エンティティタイプを選択',
    newTitleProvider: 'メインプロバイダーを選択',
    newEntityTypeHint: '新しいプロファイルのエンティティタイプを選択します',
    newProviderHint: 'デフォルトプロファイルの基礎となるメインのデータプロバイダーを選択します',
    noProvidersAvailable: '利用可能なプロバイダーがありません',
    itemTitleAdd: 'プロファイルを追加',
    itemTitleEdit: 'プロファイルを編集',
    nameLabel: 'プロファイル名',
    namePlaceholder: '例：ビジュアルノベル',
    copyId: 'プロファイル ID をコピー',
    entityTypeLabel: 'エンティティタイプ',
    selectEntityType: 'エンティティタイプを選択',
    searchProviderLabel: '検索プロバイダー',
    defaultLanguageLabel: 'デフォルト言語',
    defaultLanguageHint:
      'エンティティ解決と、個別に指定されていない取得の言語に使われます。スロットのプロバイダーは取得言語を上書きできますが、エンティティ解決には影響しません。未設定の場合はシステム言語を使用します。',
    slotsLabel: 'スロット設定',
    slotsHint: 'スロットをクリックしてデータソースと結果の戦略を設定します',
    providerCount: ({ count }: { count: number }) => `${count} 件のプロバイダー`,
    slots: {
      info: '基本情報',
      tags: 'タグ',
      seasons: 'シーズン',
      episodes: 'エピソード',
      chapters: 'ユニット',
      volumes: '巻',
      characters: 'キャラクター',
      persons: '人物',
      companies: '会社',
      relatedEntries: '関連エントリー',
      covers: 'カバー',
      backdrops: '背景画像',
      logos: 'ロゴ',
      icons: 'アイコン',
      photos: '写真'
    },
    slotDialogTitle: ({ name }: { name: string }) => `設定：${name}`,
    strategyLabel: '戦略',
    strategyHint: '複数のプロバイダーがデータを返した場合の結合方法です',
    selectStrategy: '戦略を選択',
    strategyFirst: '最初のみ',
    strategyEnrich: '補完',
    strategyFirstHint: '最初の有効な結果を使い、以降のソースは無視します',
    strategyEnrichHint: '最初の結果を基準に、欠けているフィールドを補完します',
    unmatchedLabel: '未マッチのエンティティ',
    unmatchedHint: '後続ソースの未マッチのエンティティを追加するかどうかです',
    selectUnmatched: '未マッチエンティティの戦略を選択',
    unmatchedIgnore: '未マッチを無視',
    unmatchedAppend: '未マッチを追加',
    unmatchedIgnoreHint:
      'マッチ済みのエンティティのみ補完し、新しい未マッチのエンティティは破棄します',
    unmatchedAppendHint: '未マッチのエンティティを追加し、後続ソースでの補完を可能にします',
    providersLabel: 'データプロバイダー',
    providersHint: 'このスロットのデータソースを選択し、優先順位を調整します',
    noProviders: 'プロバイダーがありません',
    languageLabel: '言語：',
    languageDefaultPlaceholder: 'デフォルト',
    addProviderPlaceholder: 'プロバイダーを追加…'
  }
} satisfies Messages['scraper']
