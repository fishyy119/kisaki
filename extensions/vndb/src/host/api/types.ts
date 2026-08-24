/**
 * VNDB Kana API response models.
 *
 * Based on the official docs at https://api.vndb.org/kana. Only the fields
 * this extension reads are modeled.
 */

export interface VndbQueryRequest {
  filters?: unknown
  fields?: string
  sort?: string
  reverse?: boolean
  results?: number
  page?: number
}

export interface VndbQueryResponse<T> {
  results: T[]
  more: boolean
  count?: number
}

export interface VndbExtlink {
  id?: string | number | null
  name?: string | null
  label?: string | null
  url?: string | null
}

export interface VndbImage {
  id?: string | null
  url?: string | null
  thumbnail?: string | null
}

export interface VndbTitle {
  lang?: string | null
  latin?: string | null
  title?: string | null
  main?: boolean | null
  official?: boolean | null
}

export type VndbScalar = string | number | null
/** VNDB reports gender as a scalar or as an `[apparent, actual]` pair. */
export type VndbGenderField = VndbScalar | VndbScalar[]

export interface VndbVnTagRelation {
  id: string
  rating?: number | null
  spoiler?: number | null
  lie?: boolean | null
}

export interface VndbVnStaffEntry {
  id: string
  role?: string | null
  note?: string | null
}

export interface VndbVnVaEntry {
  note?: string | null
  staff?: { id: string } | null
  character?: { id: string } | null
}

export interface VndbVnRelationEntry {
  id: string
  relation?: string | null
  relation_official?: boolean | null
}

export interface VndbVn {
  id: string
  title: string
  alttitle?: string | null
  titles?: VndbTitle[] | null
  released?: string | null
  description?: string | null
  devstatus?: VndbScalar
  length?: number | null
  length_minutes?: number | null
  languages?: string[] | null
  platforms?: string[] | null
  olang?: string | null
  image?: VndbImage | null
  screenshots?: VndbImage[] | null
  extlinks?: VndbExtlink[] | null
  tags?: VndbVnTagRelation[] | null
  staff?: VndbVnStaffEntry[] | null
  va?: VndbVnVaEntry[] | null
  relations?: VndbVnRelationEntry[] | null
  developers?: Array<{ id: string }> | null
}

export interface VndbTag {
  id: string
  name?: string | null
  category?: string | null
}

export interface VndbTrait {
  id: string
  name?: string | null
  group_name?: string | null
  sexual?: number | null
}

export interface VndbCharacterTraitRelation {
  id: string
  spoiler?: number | null
  lie?: boolean | null
  sexual?: number | null
}

export interface VndbCharacterVnRelation {
  id: string
  role?: string | null
  spoiler?: number | null
}

export interface VndbCharacter {
  id: string
  name: string
  original?: string | null
  description?: string | null
  sex?: VndbGenderField
  gender?: VndbGenderField
  /** `[month, day]`; VNDB never states a birth year. */
  birthday?: [number | null, number | null] | null
  blood_type?: string | null
  height?: number | null
  weight?: number | null
  bust?: number | null
  waist?: number | null
  hips?: number | null
  cup?: string | null
  image?: VndbImage | null
  traits?: VndbCharacterTraitRelation[] | null
  vns?: VndbCharacterVnRelation[] | null
}

export interface VndbStaffAlias {
  name?: string | null
  latin?: string | null
  ismain?: boolean | null
}

export interface VndbStaff {
  id: string
  name?: string | null
  original?: string | null
  description?: string | null
  gender?: VndbGenderField
  lang?: string | null
  aliases?: VndbStaffAlias[] | null
  extlinks?: VndbExtlink[] | null
}

export interface VndbProducer {
  id: string
  name?: string | null
  original?: string | null
  description?: string | null
  type?: string | null
  lang?: string | null
  extlinks?: VndbExtlink[] | null
}

export interface VndbReleaseProducer {
  id: string
  developer?: boolean | null
  publisher?: boolean | null
}

export interface VndbRelease {
  id: string
  producers?: VndbReleaseProducer[] | null
}

export interface VndbSchemaEnumEntry {
  id: string
  label: string
}

export interface VndbKanaSchema {
  enums?: {
    language?: VndbSchemaEnumEntry[]
    platform?: VndbSchemaEnumEntry[]
    staff_role?: VndbSchemaEnumEntry[]
  }
}
