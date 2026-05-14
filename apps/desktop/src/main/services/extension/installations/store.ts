import { asc, eq } from 'drizzle-orm'
import {
  extensionInstallations,
  type ExtensionInstallationRow,
  type ExtensionInstallReason,
  type ExtensionUpdatePolicy
} from '@shared/db'
import type { DbContext } from '../../db/types'
import type { ExtensionInstallationSource } from '@shared/extension/installation-source'

export interface CreateExtensionInstallationInput {
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

export interface UpdateExtensionInstallationInput {
  enabled?: boolean
  version?: string
  source?: ExtensionInstallationSource
  installReason?: ExtensionInstallReason
  updatePolicy?: ExtensionUpdatePolicy
  pinnedVersion?: string | null
  channel?: string
}

export class ExtensionInstallationStore {
  constructor(private readonly db: DbContext) {}

  list(): ExtensionInstallationRow[] {
    return this.db
      .select()
      .from(extensionInstallations)
      .orderBy(asc(extensionInstallations.id))
      .all()
  }

  get(extensionId: string): ExtensionInstallationRow | null {
    return (
      this.db
        .select()
        .from(extensionInstallations)
        .where(eq(extensionInstallations.id, extensionId))
        .get() ?? null
    )
  }

  require(extensionId: string): ExtensionInstallationRow {
    const row = this.get(extensionId)
    if (!row) {
      throw new Error(`Extension installation "${extensionId}" not found.`)
    }
    return row
  }

  create(input: CreateExtensionInstallationInput): ExtensionInstallationRow {
    const now = new Date()

    this.db
      .insert(extensionInstallations)
      .values({
        id: input.id,
        enabled: input.enabled ?? true,
        version: input.version,
        source: input.source,
        installReason: input.installReason ?? 'manual',
        updatePolicy: input.updatePolicy ?? 'manual',
        pinnedVersion: input.pinnedVersion ?? null,
        channel: input.channel ?? 'stable',
        installedAt: input.installedAt ?? now,
        updatedAt: now
      })
      .run()

    return this.require(input.id)
  }

  update(extensionId: string, patch: UpdateExtensionInstallationInput): ExtensionInstallationRow {
    this.db
      .update(extensionInstallations)
      .set({
        ...patch,
        updatedAt: new Date()
      })
      .where(eq(extensionInstallations.id, extensionId))
      .run()

    return this.require(extensionId)
  }

  restoreSnapshot(extensionId: string, snapshot: ExtensionInstallationRow | null): void {
    if (!snapshot) {
      this.remove(extensionId)
      return
    }

    this.db
      .insert(extensionInstallations)
      .values(snapshot)
      .onConflictDoUpdate({
        target: extensionInstallations.id,
        set: {
          enabled: snapshot.enabled,
          version: snapshot.version,
          source: snapshot.source,
          installReason: snapshot.installReason,
          updatePolicy: snapshot.updatePolicy,
          pinnedVersion: snapshot.pinnedVersion,
          channel: snapshot.channel,
          installedAt: snapshot.installedAt,
          updatedAt: snapshot.updatedAt
        }
      })
      .run()
  }

  setEnabled(extensionId: string, enabled: boolean): ExtensionInstallationRow {
    return this.update(extensionId, { enabled })
  }

  setUpdatePolicy(
    extensionId: string,
    updatePolicy: ExtensionUpdatePolicy,
    pinnedVersion: string | null = null
  ): ExtensionInstallationRow {
    return this.update(extensionId, { updatePolicy, pinnedVersion })
  }

  remove(extensionId: string): boolean {
    const result = this.db
      .delete(extensionInstallations)
      .where(eq(extensionInstallations.id, extensionId))
      .run()
    return result.changes > 0
  }
}
