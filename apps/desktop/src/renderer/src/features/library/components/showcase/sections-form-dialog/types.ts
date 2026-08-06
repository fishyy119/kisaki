import type { ShowcaseSection } from '@shared/db'

/** Editable working copy of a showcase section inside the sections form dialog. */
export type ShowcaseSectionFormItem = Omit<ShowcaseSection, 'createdAt' | 'updatedAt'> & {
  isNew?: boolean
}
