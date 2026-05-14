import type { ExtensionInstallReason, ExtensionUpdatePolicy } from '@shared/db'
import type { ExtensionInstallationSource } from '@shared/extension/installation-source'
import type { TrustExtensionSignerInput } from '../../signers'

export interface ExtensionPackageInstallationWrite {
  id: string
  enabled?: boolean
  version: string
  source: ExtensionInstallationSource
  installReason?: ExtensionInstallReason
  updatePolicy?: ExtensionUpdatePolicy
  pinnedVersion?: string | null
  channel?: string
  installedAt?: Date
}

export interface ReplaceActiveExtensionPackageInput {
  operationId: string
  extensionId: string
  stagedPackageDir: string
  installation: ExtensionPackageInstallationWrite
  signerTrusts?: readonly TrustExtensionSignerInput[]
  cleanupPaths?: readonly string[]
}

export interface UninstallExtensionPackageInput {
  operationId: string
  extensionId: string
  cleanupPaths?: readonly string[]
}

export interface ExtensionPackageTransactionHandle {
  extensionId: string
  packagePath: string
  backupPath: string | null
  trashPath: string | null
  commit(): Promise<void>
  rollback(): Promise<void>
}

export interface ExtensionPackageRecoveryResult {
  actions: readonly ExtensionPackageRecoveryAction[]
  issues: readonly string[]
}

export type ExtensionPackageRecoveryAction =
  | { type: 'pruned-download'; path: string }
  | { type: 'pruned-staging'; path: string }
  | { type: 'pruned-quarantine'; path: string }
  | { type: 'pruned-archive'; path: string }
  | { type: 'restored-backup'; extensionId: string; path: string }
  | { type: 'restored-trash'; extensionId: string; path: string }
  | { type: 'removed-backup'; path: string }
  | { type: 'removed-trash'; path: string }
  | {
      type: 'quarantined-untracked-package'
      extensionId: string | null
      path: string
      quarantinePath: string
    }
