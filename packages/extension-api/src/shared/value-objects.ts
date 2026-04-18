export interface ExternalId {
  source: string
  id: string
}

export interface RelatedSite {
  label: string
  url: string
}

export interface PartialDate {
  year?: number
  month?: number
  day?: number
}
