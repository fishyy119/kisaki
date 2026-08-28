/**
 * Google Books API v1 response models.
 *
 * The volumes surface is a long-stable public contract; only fields this
 * extension reads are modeled, and every field is optional-tolerant.
 */

export interface GbIndustryIdentifier {
  type?: string | null
  identifier?: string | null
}

export interface GbImageLinks {
  smallThumbnail?: string | null
  thumbnail?: string | null
  small?: string | null
  medium?: string | null
  large?: string | null
  extraLarge?: string | null
}

export interface GbVolumeInfo {
  title?: string | null
  subtitle?: string | null
  authors?: string[] | null
  publisher?: string | null
  /** `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`. */
  publishedDate?: string | null
  description?: string | null
  industryIdentifiers?: GbIndustryIdentifier[] | null
  pageCount?: number | null
  /** BISAC paths such as `"Comics & Graphic Novels / Manga / General"`. */
  categories?: string[] | null
  imageLinks?: GbImageLinks | null
  language?: string | null
  infoLink?: string | null
  canonicalVolumeLink?: string | null
  seriesInfo?: {
    volumeSeries?:
      | {
          seriesId?: string | null
          orderNumber?: number | null
        }[]
      | null
  } | null
}

export interface GbVolume {
  id: string
  volumeInfo?: GbVolumeInfo | null
}

export interface GbVolumesResponse {
  totalItems?: number | null
  items?: GbVolume[] | null
}
