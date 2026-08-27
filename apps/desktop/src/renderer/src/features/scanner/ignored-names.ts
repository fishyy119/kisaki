/**
 * Scanner ignore-list writes shared by the form, test, and issues dialogs.
 *
 * The list lives in settings as extracted entity names; matching is
 * case-insensitive at scan time, so names are stored as entered.
 */

import { eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { settings } from '@shared/db'

export type AddIgnoredNameResult = 'added' | 'exists' | 'empty'

export async function addScannerIgnoredName(name: string): Promise<AddIgnoredNameResult> {
  const trimmed = name.trim()
  if (!trimmed) return 'empty'

  const current = await db.query.settings.findFirst()
  const ignoredNames = current?.scannerIgnoredNames ?? []
  if (ignoredNames.includes(trimmed)) return 'exists'

  await db
    .update(settings)
    .set({ scannerIgnoredNames: [...ignoredNames, trimmed] })
    .where(eq(settings.id, 0))
  return 'added'
}
