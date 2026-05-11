import { asc, eq } from 'drizzle-orm'
import {
  parseExtensionRegistryManifest,
  type ExtensionRegistryManifest
} from '@kisaki/extension-api'
import {
  extensionRepositories,
  type ExtensionRepositoryRow,
  type ExtensionRepositoryState
} from '@shared/db'
import type { DbContext } from '../../db/types'

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/

export interface CreateExtensionRepositoryInput {
  id: string
  url: string
  name: string
  state?: ExtensionRepositoryState
  builtIn?: boolean
  priority?: number
}

export interface UpdateExtensionRepositoryInput {
  url?: string
  name?: string
  state?: ExtensionRepositoryState
  builtIn?: boolean
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
  constructor(private readonly db: DbContext) {}

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
        builtIn: input.builtIn ?? false,
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

  recordRefreshSuccess(
    id: string,
    input: ExtensionRepositoryRefreshSuccessInput
  ): ExtensionRepositoryRow {
    assertValidRefreshSuccessInput(input)

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
}

function assertValidRefreshSuccessInput(input: ExtensionRepositoryRefreshSuccessInput): void {
  if (!SHA256_HEX_PATTERN.test(input.manifestDigest)) {
    throw new Error('Extension repository manifest digest must be a lowercase sha256 hex digest.')
  }

  const result = parseExtensionRegistryManifest(input.manifestSnapshot, {
    allowInsecureLocalUrls: true
  })
  if (!result.manifest) {
    const details = result.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ')
    throw new Error(
      `Extension repository manifest snapshot is invalid.${details ? ` ${details}` : ''}`
    )
  }
}
