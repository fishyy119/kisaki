/**
 * YMGal API response models.
 *
 * Based on the official documentation at https://www.ymgal.games/developer.
 * Only the fields this extension reads are modeled.
 */

export interface YmgalApiResponse<T> {
  success: boolean
  code: number
  msg?: string | null
  data?: T | null
}

export interface YmgalPage<T> {
  result: T[]
  total: number
  hasNext: boolean
  pageNum: number
  pageSize: number
}

export interface YmgalTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  scope?: string
}

export type YmgalId = string | number

export interface YmgalExtensionName {
  name: string
  type?: string | null
  desc?: string | null
}

export interface YmgalMoreEntry {
  key: string
  value: string
}

export interface YmgalWebsite {
  title: string
  link: string
}

export interface YmgalArchiveBase {
  name: string
  chineseName?: string | null
  extensionName?: YmgalExtensionName[] | null
  introduction?: string | null
  state?: string | null
  mainImg?: string | null
  moreEntry?: YmgalMoreEntry[] | null
  type?: string | null
  freeze?: boolean | null
}

export interface YmgalCharacterRelation {
  cid: YmgalId
  cvId?: YmgalId | null
  characterPosition?: number | null
}

export interface YmgalStaff {
  sid?: YmgalId | null
  pid?: YmgalId | null
  jobName?: string | null
  job_name?: string | null
  desc?: string | null
  empDesc?: string | null
  empName?: string | null
  emp_name?: string | null
}

export interface YmgalGame extends YmgalArchiveBase {
  gid: YmgalId
  developerId?: YmgalId | null
  haveChinese?: boolean | null
  typeDesc?: string | null
  releaseDate?: string | null
  restricted?: boolean | null
  country?: string | null
  website?: YmgalWebsite[] | null
  characters?: YmgalCharacterRelation[] | null
  staff?: YmgalStaff[] | null
}

export interface YmgalOrganization extends YmgalArchiveBase {
  orgId: YmgalId
  country?: string | null
  birthday?: string | null
  website?: YmgalWebsite[] | null
}

export interface YmgalCharacter extends YmgalArchiveBase {
  cid: YmgalId
  gender?: number | string | null
  birthday?: string | null
}

export interface YmgalPerson extends YmgalArchiveBase {
  pid: YmgalId
  country?: string | null
  birthday?: string | null
  gender?: number | string | null
  website?: YmgalWebsite[] | null
}

export interface YmgalCharacterMapping {
  cid: YmgalId
  name: string
  chineseName?: string | null
  mainImg?: string | null
}

export interface YmgalPersonMapping {
  pid: YmgalId
  name: string
  chineseName?: string | null
  mainImg?: string | null
}

export interface YmgalGameArchiveData {
  game: YmgalGame
  cidMapping?: Record<string, YmgalCharacterMapping> | null
  pidMapping?: Record<string, YmgalPersonMapping> | null
}

export interface YmgalOrganizationArchiveData {
  org?: YmgalOrganization | null
}

export interface YmgalCharacterArchiveData {
  character?: YmgalCharacter | null
}

export interface YmgalPersonArchiveData {
  person?: YmgalPerson | null
}

export interface YmgalGameSearchListItem {
  id?: YmgalId | null
  gid?: YmgalId | null
  name?: string | null
  chineseName?: string | null
  mainImg?: string | null
  orgId?: YmgalId | null
  orgName?: string | null
  releaseDate?: string | null
  haveChinese?: boolean | null
}

export interface YmgalOrgGameItem {
  gid?: YmgalId | null
  developerId?: YmgalId | null
  name?: string | null
  chineseName?: string | null
  mainImg?: string | null
  releaseDate?: string | null
  orgName?: string | null
}
