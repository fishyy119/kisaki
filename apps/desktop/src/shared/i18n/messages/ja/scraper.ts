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
    empty: 'プロファイルがありません'
  },
  presetDialog: {
    title: 'プリセットを選択',
    empty: '利用可能なプリセットがありません',
    searchProvider: ({ id }: { id: string }) => `検索：${id}`,
    addWithCount: ({ count }: { count: number }) => `追加（${count}）`
  },
  presets: {
    visualNovel: {
      name: 'ビジュアルノベル',
      description: 'ビジュアルノベルの中国語メタデータの取得に最適'
    },
    videoGame: {
      name: 'ビデオゲーム',
      description: 'ビデオゲーム向けの汎用プリセット'
    }
  },

  profiles: {
    manageTitle: 'スクレイパープロファイル管理',
    emptyProfiles: 'プロファイルがありません。下のボタンから追加してください。',
    unnamed: '（名称未設定）',
    searchProviderValue: ({ label }: { label: string }) => `検索：${label}`,
    addProfile: 'プロファイルを追加',
    choosePreset: 'プリセットを選択',
    profileEntityLabel: 'プロファイル',
    newTitleMediaType: 'メディアタイプを選択',
    newTitleProvider: 'メインプロバイダーを選択',
    newMediaTypeHint: '新しいプロファイルのメディアタイプを選択します。',
    newProviderHint: 'デフォルトプロファイルの基礎となるメインのデータプロバイダーを選択します。',
    noProvidersAvailable: '利用可能なプロバイダーがありません',
    itemTitleAdd: 'プロファイルを追加',
    itemTitleEdit: 'プロファイルを編集',
    nameLabel: 'プロファイル名',
    namePlaceholder: '例：ビジュアルノベル',
    idLabel: 'プロファイル ID',
    copyIdTooltip: 'プロファイル ID をコピー',
    idCopied: 'プロファイル ID をコピーしました。',
    mediaTypeLabel: 'メディアタイプ',
    selectMediaType: 'メディアタイプを選択',
    searchProviderLabel: '検索プロバイダー',
    defaultLanguageLabel: 'デフォルト言語',
    defaultLanguageHint:
      'エンティティ解決と、個別に指定されていない取得の言語に使われます。スロットのプロバイダーは取得言語を上書きできますが、エンティティ解決には影響しません。未設定の場合はシステム言語を使用します。',
    slotsLabel: 'スロット設定',
    slotsHint: 'スロットをクリックしてデータソースと結果の戦略を設定します。',
    providerCount: ({ count }: { count: number }) => `${count} 件のプロバイダー`,
    slots: {
      info: '基本情報',
      tags: 'タグ',
      characters: 'キャラクター',
      persons: '人物',
      companies: '会社',
      covers: 'カバー',
      backdrops: '背景画像',
      logos: 'ロゴ',
      icons: 'アイコン',
      photos: '写真'
    },
    slotDialogTitle: ({ name }: { name: string }) => `設定：${name}`,
    strategyLabel: '戦略',
    strategyHint: '複数のプロバイダーがデータを返した場合の結合方法です。',
    selectStrategy: '戦略を選択',
    strategyFirst: '最初のみ',
    strategyEnrich: '補完',
    strategyFirstHint: '最初の有効な結果を使い、以降のソースは無視します。',
    strategyEnrichHint: '最初の結果を基準に、欠けているフィールドを補完します。',
    unmatchedLabel: '未マッチのエンティティ',
    unmatchedHint: '後続ソースの未マッチのエンティティを追加するかどうかです。',
    selectUnmatched: '未マッチエンティティの戦略を選択',
    unmatchedIgnore: '未マッチを無視',
    unmatchedAppend: '未マッチを追加',
    unmatchedIgnoreHint:
      'マッチ済みのエンティティのみ補完し、新しい未マッチのエンティティは破棄します。',
    unmatchedAppendHint: '未マッチのエンティティを追加し、後続ソースでの補完を可能にします。',
    providersLabel: 'データプロバイダー',
    providersHint: 'このスロットのデータソースを選択し、優先順位を調整します。',
    noProviders: 'プロバイダーがありません',
    languageLabel: '言語：',
    languageDefaultPlaceholder: 'デフォルト',
    addProviderPlaceholder: 'プロバイダーを追加…'
  }
} satisfies Messages['scraper']
