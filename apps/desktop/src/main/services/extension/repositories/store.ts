import { asc, eq } from 'drizzle-orm'
import type { ExtensionRegistryManifest } from '@kisaki3/extension-registry'
import {
  extensionRepositories,
  type ExtensionRepositoryRow,
  type ExtensionRepositoryState
} from '@shared/db'
import type { DbContext } from '@main/services/db'
import { assertRegistryManifestUrlPolicy, type ExtensionRegistryUrlPolicy } from './url-policy'

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/

export interface CreateExtensionRepositoryInput {
  id: string
  url: string
  name: string
  state?: ExtensionRepositoryState
  priority?: number
}

export interface UpdateExtensionRepositoryInput {
  url?: string
  name?: string
  state?: ExtensionRepositoryState
  priority?: number
}

export interface ExtensionRepositoryRefreshSuccessInput {
  manifestSnapshot: ExtensionRegistryManifest
  manifestDigest: string
  etag?: string | null
  lastModified?: string | null
  refreshedAt?: Date
}

export interface ExtensionRepositoryRefreshFailureInput {
  error: string
  refreshedAt?: Date
}

export interface ExtensionRepositoryRefreshNotModifiedInput {
  etag?: string | null
  lastModified?: string | null
  refreshedAt?: Date
}

export class ExtensionRepositoryStore {
  private readonly urlPolicy: ExtensionRegistryUrlPolicy

  constructor(
    private readonly db: DbContext,
    urlPolicy: Partial<ExtensionRegistryUrlPolicy> = {}
  ) {
    this.urlPolicy = {
      allowInsecureLocalUrls: urlPolicy.allowInsecureLocalUrls ?? false
    }
  }

  list(): ExtensionRepositoryRow[] {
    return this.db
      .select()
      .from(extensionRepositories)
      .orderBy(asc(extensionRepositories.priority), asc(extensionRepositories.id))
      .all()
  }

  listEnabled(): ExtensionRepositoryRow[] {
    return this.db
      .select()
      .from(extensionRepositories)
      .where(eq(extensionRepositories.state, 'enabled'))
      .orderBy(asc(extensionRepositories.priority), asc(extensionRepositories.id))
      .all()
  }

  get(id: string): ExtensionRepositoryRow | null {
    return (
      this.db.select().from(extensionRepositories).where(eq(extensionRepositories.id, id)).get() ??
      null
    )
  }

  getByUrl(url: string): ExtensionRepositoryRow | null {
    return (
      this.db
        .select()
        .from(extensionRepositories)
        .where(eq(extensionRepositories.url, url))
        .get() ?? null
    )
  }

  require(id: string): ExtensionRepositoryRow {
    const row = this.get(id)
    if (!row) {
      throw new Error(`Extension repository "${id}" not found.`)
    }
    return row
  }

  create(input: CreateExtensionRepositoryInput): ExtensionRepositoryRow {
    this.db
      .insert(extensionRepositories)
      .values({
        id: input.id,
        url: input.url,
        name: input.name,
        state: input.state ?? 'enabled',
        priority: input.priority ?? this.nextPriority()
      })
      .run()

    return this.require(input.id)
  }

  update(id: string, patch: UpdateExtensionRepositoryInput): ExtensionRepositoryRow {
    this.db
      .update(extensionRepositories)
      .set({
        ...patch,
        ...(patch.url
          ? {
              manifestSnapshot: null,
              manifestDigest: null,
              etag: null,
              lastModified: null,
              lastSuccessAt: null
            }
          : {}),
        updatedAt: new Date()
      })
      .where(eq(extensionRepositories.id, id))
      .run()

    return this.require(id)
  }

  reorder(id: string, targetIndex: number): ExtensionRepositoryRow {
    const rows = this.list()
    const currentIndex = rows.findIndex((row) => row.id === id)
    if (currentIndex < 0) {
      throw new Error(`Extension repository "${id}" not found.`)
    }

    const nextIndex = Math.max(0, Math.min(targetIndex, rows.length - 1))
    const [moved] = rows.splice(currentIndex, 1)
    rows.splice(nextIndex, 0, moved!)
    this.writePriorityOrder(rows)

    return this.require(id)
  }

  normalizePriorities(): void {
    this.writePriorityOrder(this.list())
  }

  recordRefreshSuccess(
    id: string,
    input: ExtensionRepositoryRefreshSuccessInput
  ): ExtensionRepositoryRow {
    assertValidRefreshSuccessInput(input, this.urlPolicy)

    const refreshedAt = input.refreshedAt ?? new Date()

    this.db
      .update(extensionRepositories)
      .set({
        manifestSnapshot: input.manifestSnapshot,
        manifestDigest: input.manifestDigest,
        etag: input.etag ?? null,
        lastModified: input.lastModified ?? null,
        lastRefreshAt: refreshedAt,
        lastSuccessAt: refreshedAt,
        lastError: null,
        updatedAt: refreshedAt
      })
      .where(eq(extensionRepositories.id, id))
      .run()

    return this.require(id)
  }

  recordRefreshFailure(
    id: string,
    input: ExtensionRepositoryRefreshFailureInput
  ): ExtensionRepositoryRow {
    const refreshedAt = input.refreshedAt ?? new Date()

    this.db
      .update(extensionRepositories)
      .set({
        lastRefreshAt: refreshedAt,
        lastError: input.error,
        updatedAt: refreshedAt
      })
      .where(eq(extensionRepositories.id, id))
      .run()

    return this.require(id)
  }

  /**
   * Drops a persisted snapshot that no longer parses under the current registry
   * schema. Clears the HTTP cache validators so the next refresh performs a full
   * refetch instead of being stranded by a 304 response.
   */
  discardInvalidManifestSnapshot(id: string, input: { error: string }): ExtensionRepositoryRow {
    const updatedAt = new Date()

    this.db
      .update(extensionRepositories)
      .set({
        manifestSnapshot: null,
        manifestDigest: null,
        etag: null,
        lastModified: null,
        lastSuccessAt: null,
        lastError: input.error,
        updatedAt
      })
      .where(eq(extensionRepositories.id, id))
      .run()

    return this.require(id)
  }

  recordRefreshNotModified(
    id: string,
    input: ExtensionRepositoryRefreshNotModifiedInput = {}
  ): ExtensionRepositoryRow {
    const refreshedAt = input.refreshedAt ?? new Date()

    this.db
      .update(extensionRepositories)
      .set({
        etag: input.etag ?? undefined,
        lastModified: input.lastModified ?? undefined,
        lastRefreshAt: refreshedAt,
        lastError: null,
        updatedAt: refreshedAt
      })
      .where(eq(extensionRepositories.id, id))
      .run()

    return this.require(id)
  }

  remove(id: string): boolean {
    const result = this.db
      .delete(extensionRepositories)
      .where(eq(extensionRepositories.id, id))
      .run()
    return result.changes > 0
  }

  nextPriority(): number {
    const rows = this.db.select().from(extensionRepositories).all()
    const highest = rows.reduce((value, row) => Math.max(value, row.priority), -1)
    return highest + 1
  }

  private writePriorityOrder(rows: readonly ExtensionRepositoryRow[]): void {
    const updatedAt = new Date()
    for (const [priority, row] of rows.entries()) {
      if (row.priority === priority) {
        continue
      }

      this.db
        .update(extensionRepositories)
        .set({
          priority,
          updatedAt
        })
        .where(eq(extensionRepositories.id, row.id))
        .run()
    }
  }
}

function assertValidRefreshSuccessInput(
  input: ExtensionRepositoryRefreshSuccessInput,
  urlPolicy: ExtensionRegistryUrlPolicy
): void {
  if (!SHA256_HEX_PATTERN.test(input.manifestDigest)) {
    throw new Error('Extension repository manifest digest must be a lowercase sha256 hex digest.')
  }

  assertRegistryManifestUrlPolicy(
    input.manifestSnapshot,
    urlPolicy,
    'Extension repository manifest snapshot'
  )
}
