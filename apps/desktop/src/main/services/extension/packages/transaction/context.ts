import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type * as schema from '@shared/db'
import type { ExtensionPackageArchiveStore } from '../archive'
import type { ExtensionPackageLayout } from '../layout'

export interface PackageTransactionContext {
  layout: ExtensionPackageLayout
  db: BetterSQLite3Database<typeof schema>
  archiveStore: ExtensionPackageArchiveStore
}
