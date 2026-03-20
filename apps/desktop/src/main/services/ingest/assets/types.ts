export type PendingAssetTask =
  | {
      type: 'game'
      gameId: string
      field: 'coverFile' | 'backdropFile' | 'logoFile' | 'iconFile'
      url: string
    }
  | {
      type: 'person'
      personId: string
      url: string
    }
  | {
      type: 'company'
      companyId: string
      url: string
    }
  | {
      type: 'character'
      characterId: string
      url: string
    }
