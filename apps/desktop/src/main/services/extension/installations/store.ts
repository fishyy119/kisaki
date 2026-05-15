import { asc, eq } from 'drizzle-orm'
import {
  extensionInstallations,
  type ExtensionInstallationRow,
  type ExtensionInstallReason,
  type ExtensionUpdatePolicy
} from '@shared/db'
import type { DbContext } from '../../db/types'
import type { ExtensionInstallationSource } from '@shared/extension/installation-source'

export interface CreateOrUpdateExtensionInstallationInput {
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

  create(input: CreateOrUpdateExtensionInstallationInput): ExtensionInstallationRow {
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

  createOrUpdate(input: CreateOrUpdateExtensionInstallationInput): ExtensionInstallationRow {
    const existing = this.get(input.id)
    if (!existing) {
      return this.create(input)
    }

    return this.update(input.id, {
      enabled: input.enabled,
      version: input.version,
      source: input.source,
      installReason: input.installReason,
      updatePolicy: input.updatePolicy,
      pinnedVersion: input.pinnedVersion,
      channel: input.channel
    })
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
