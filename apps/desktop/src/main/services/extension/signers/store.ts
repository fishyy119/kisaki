import { and, asc, eq } from 'drizzle-orm'
import { isExtensionIdentifier } from '@kisaki/extension-api'
import { createExtensionRegistrySignerFingerprint } from '@kisaki/extension-registry/node'
import {
  extensionSignerTrusts,
  type ExtensionSignerAlgorithm,
  type ExtensionSignerTrustRow
} from '@shared/db'
import type { DbContext } from '../../db/types'

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

export interface TrustExtensionSignerInput {
  id?: string
  extensionId: string
  fingerprint: string
  algorithm?: ExtensionSignerAlgorithm
  publicKey: string
  label?: string | null
  trustedFromRepositoryId?: string | null
  trustedFromRepositoryUrl?: string | null
  trustedAt?: Date
}

export class ExtensionSignerTrustStore {
  constructor(private readonly db: DbContext) {}

  list(): ExtensionSignerTrustRow[] {
    return this.db
      .select()
      .from(extensionSignerTrusts)
      .orderBy(asc(extensionSignerTrusts.extensionId), asc(extensionSignerTrusts.fingerprint))
      .all()
  }

  listByExtension(extensionId: string): ExtensionSignerTrustRow[] {
    return this.db
      .select()
      .from(extensionSignerTrusts)
      .where(eq(extensionSignerTrusts.extensionId, extensionId))
      .orderBy(asc(extensionSignerTrusts.fingerprint))
      .all()
  }

  get(id: string): ExtensionSignerTrustRow | null {
    return (
      this.db.select().from(extensionSignerTrusts).where(eq(extensionSignerTrusts.id, id)).get() ??
      null
    )
  }

  getByScope(extensionId: string, fingerprint: string): ExtensionSignerTrustRow | null {
    return (
      this.db
        .select()
        .from(extensionSignerTrusts)
        .where(
          and(
            eq(extensionSignerTrusts.extensionId, extensionId),
            eq(extensionSignerTrusts.fingerprint, fingerprint)
          )
        )
        .get() ?? null
    )
  }

  isTrusted(extensionId: string, fingerprint: string): boolean {
    return this.getByScope(extensionId, fingerprint) !== null
  }

  trust(input: TrustExtensionSignerInput): ExtensionSignerTrustRow {
    assertValidTrustInput(input)

    const now = new Date()
    const id = input.id ?? createExtensionSignerTrustId(input.extensionId, input.fingerprint)

    this.db
      .insert(extensionSignerTrusts)
      .values({
        id,
        extensionId: input.extensionId,
        fingerprint: input.fingerprint,
        algorithm: input.algorithm ?? 'ed25519',
        publicKey: input.publicKey,
        label: input.label ?? null,
        trustedFromRepositoryId: input.trustedFromRepositoryId ?? null,
        trustedFromRepositoryUrl: input.trustedFromRepositoryUrl ?? null,
        trustedAt: input.trustedAt ?? now
      })
      .onConflictDoUpdate({
        target: [extensionSignerTrusts.extensionId, extensionSignerTrusts.fingerprint],
        set: {
          publicKey: input.publicKey,
          label: input.label ?? null,
          trustedFromRepositoryId: input.trustedFromRepositoryId ?? null,
          trustedFromRepositoryUrl: input.trustedFromRepositoryUrl ?? null,
          updatedAt: now
        }
      })
      .run()

    const row = this.getByScope(input.extensionId, input.fingerprint)
    if (!row) {
      throw new Error(`Extension signer trust "${id}" was not persisted.`)
    }
    return row
  }

  remove(id: string): boolean {
    const result = this.db
      .delete(extensionSignerTrusts)
      .where(eq(extensionSignerTrusts.id, id))
      .run()
    return result.changes > 0
  }

  removeByScope(extensionId: string, fingerprint: string): boolean {
    const result = this.db
      .delete(extensionSignerTrusts)
      .where(
        and(
          eq(extensionSignerTrusts.extensionId, extensionId),
          eq(extensionSignerTrusts.fingerprint, fingerprint)
        )
      )
      .run()
    return result.changes > 0
  }
}

export function createExtensionSignerTrustId(extensionId: string, fingerprint: string): string {
  return `${extensionId}:${fingerprint}`
}

function assertValidTrustInput(input: TrustExtensionSignerInput): void {
  if (!isExtensionIdentifier(input.extensionId)) {
    throw new Error('Extension signer trust extension id is invalid.')
  }

  if (!SHA256_HEX_PATTERN.test(input.fingerprint)) {
    throw new Error('Extension signer trust fingerprint must be a lowercase sha256 hex digest.')
  }

  if (input.algorithm !== undefined && input.algorithm !== 'ed25519') {
    throw new Error('Extension signer trust algorithm must be ed25519.')
  }

  if (!isNonEmptyBase64(input.publicKey)) {
    throw new Error('Extension signer trust public key must be a non-empty base64 string.')
  }

  const expectedFingerprint = createExtensionRegistrySignerFingerprint(input.publicKey)
  if (expectedFingerprint !== input.fingerprint) {
    throw new Error('Extension signer trust fingerprint does not match the public key.')
  }
}

function isNonEmptyBase64(value: string): boolean {
  return value.length > 0 && BASE64_PATTERN.test(value)
}
