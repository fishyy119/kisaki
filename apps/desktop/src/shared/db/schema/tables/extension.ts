import { index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import {
  baseColumns,
  extensionInstallationSource,
  extensionInstallReason,
  extensionRegistryManifestSnapshot,
  extensionRepositoryState,
  extensionSignerAlgorithm,
  extensionUpdatePolicy
} from '../../columns'

export const extensionRepositories = sqliteTable(
  'extension_repositories',
  {
    ...baseColumns,
    id: text('id').primaryKey(),
    url: text('url').notNull().unique(),
    name: text('name').notNull(),
    state: extensionRepositoryState('state').notNull().default('enabled'),
    priority: integer('priority').notNull().default(0),
    manifestSnapshot: extensionRegistryManifestSnapshot('manifest_snapshot'),
    lastRefreshAt: integer('last_refresh_at', { mode: 'timestamp_ms' }),
    lastSuccessAt: integer('last_success_at', { mode: 'timestamp_ms' }),
    lastError: text('last_error'),
    manifestDigest: text('manifest_digest'),
    etag: text('etag'),
    lastModified: text('last_modified')
  },
  (t) => [index('idx_extension_repositories_state_priority').on(t.state, t.priority)]
)

export type ExtensionRepositoryRow = InferSelectModel<typeof extensionRepositories>
export type NewExtensionRepositoryRow = InferInsertModel<typeof extensionRepositories>

export const extensionInstallations = sqliteTable(
  'extension_installations',
  {
    id: text('id').primaryKey(),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    version: text('version').notNull(),
    source: extensionInstallationSource('source').notNull(),
    installReason: extensionInstallReason('install_reason').notNull().default('manual'),
    updatePolicy: extensionUpdatePolicy('update_policy').notNull().default('manual'),
    pinnedVersion: text('pinned_version'),
    includePreviewUpdates: integer('include_preview_updates', { mode: 'boolean' })
      .notNull()
      .default(false),
    installedAt: integer('installed_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date())
  },
  (t) => [
    index('idx_extension_installations_enabled').on(t.enabled),
    index('idx_extension_installations_update_policy').on(t.updatePolicy)
  ]
)

export type ExtensionInstallationRow = InferSelectModel<typeof extensionInstallations>
export type NewExtensionInstallationRow = InferInsertModel<typeof extensionInstallations>

export const extensionSignerTrusts = sqliteTable(
  'extension_signer_trusts',
  {
    ...baseColumns,
    id: text('id').primaryKey(),
    extensionId: text('extension_id').notNull(),
    fingerprint: text('fingerprint').notNull(),
    algorithm: extensionSignerAlgorithm('algorithm').notNull().default('ed25519'),
    publicKey: text('public_key').notNull(),
    label: text('label'),
    trustedFromRepositoryId: text('trusted_from_repository_id'),
    trustedFromRepositoryUrl: text('trusted_from_repository_url'),
    trustedAt: integer('trusted_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date())
  },
  (t) => [
    unique('unique_extension_signer_trust_scope').on(t.extensionId, t.fingerprint),
    index('idx_extension_signer_trusts_extension_id').on(t.extensionId),
    index('idx_extension_signer_trusts_fingerprint').on(t.fingerprint)
  ]
)

export type ExtensionSignerTrustRow = InferSelectModel<typeof extensionSignerTrusts>
export type NewExtensionSignerTrustRow = InferInsertModel<typeof extensionSignerTrusts>
