export interface ExternalId {
  source: string
  id: string
}

export interface ExternalSite {
  label: string
  url: string
}

export interface PartialDate {
  year?: number | undefined
  month?: number | undefined
  day?: number | undefined
}
