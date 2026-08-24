/**
 * Bangumi files people and companies in one numbering space, told apart by
 * the entry's `type`: individuals are 1, while 2 (company) and 3 (group) are
 * the organizations behind a work. The person and company providers each keep
 * their own side of that split.
 */

import type { BangumiPersonType } from '../api/types'

export const BANGUMI_INDIVIDUAL_PERSON_TYPE = 1

export const BANGUMI_COMPANY_PERSON_TYPES: readonly BangumiPersonType[] = [2, 3]

export function isBangumiCompanyType(type: BangumiPersonType): boolean {
  return BANGUMI_COMPANY_PERSON_TYPES.includes(type)
}
