import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type * as schema from '@shared/db'
import type { ExtensionPackageArchiveStore } from '../archive'
import type { ExtensionPackageLayout } from '../layout'
import type { PackageTransactionContext } from './context'
import { recoverPackageTransactions } from './recovery'
import { replaceActivePackage } from './replace'
import type {
  ExtensionPackageRecoveryResult,
  ExtensionPackageTransactionHandle,
  ReplaceActiveExtensionPackageInput,
  UninstallExtensionPackageInput
} from './types'
import { uninstallPackage } from './uninstall'

export class ExtensionPackageTransactionCoordinator {
  private readonly context: PackageTransactionContext

  constructor(
    layout: ExtensionPackageLayout,
    db: BetterSQLite3Database<typeof schema>,
    archiveStore: ExtensionPackageArchiveStore
  ) {
    this.context = { layout, db, archiveStore }
  }

  replaceActivePackage(
    input: ReplaceActiveExtensionPackageInput
  ): Promise<ExtensionPackageTransactionHandle> {
    return replaceActivePackage(this.context, input)
  }

  uninstallPackage(
    input: UninstallExtensionPackageInput
  ): Promise<ExtensionPackageTransactionHandle> {
    return uninstallPackage(this.context, input)
  }

  recover(): Promise<ExtensionPackageRecoveryResult> {
    return recoverPackageTransactions(this.context)
  }
}
