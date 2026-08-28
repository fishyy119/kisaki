import type { ExtensionSecrets } from '@kisaki3/extension-sdk'
import { NEODB_SECRET_KEYS } from '../utils/ids'

/**
 * A completed sign-in: the dynamically registered client credentials and the
 * non-expiring access token, all bound to one instance.
 */
export interface NeodbAuthSessionV1 {
  version: 1
  instanceUrl: string
  clientId: string
  clientSecret: string
  accessToken: string
}

/** A sign-in that is waiting for its browser callback or pasted code. */
export interface NeodbPendingLoginV1 {
  version: 1
  instanceUrl: string
  clientId: string
  clientSecret: string
  state: string
  /** Redirect the authorization code is bound to (deeplink or out-of-band). */
  redirectUri: string
  /** Whether the code arrives by hand instead of through the deeplink. */
  manual: boolean
  createdAt: number
  expiresAt: number
}

export class SessionStore {
  constructor(private readonly secrets: ExtensionSecrets) {}

  async getSession(): Promise<NeodbAuthSessionV1 | undefined> {
    return normalizeSession(await this.secrets.get(NEODB_SECRET_KEYS.session))
  }

  async setSession(session: NeodbAuthSessionV1): Promise<void> {
    await this.secrets.set(NEODB_SECRET_KEYS.session, session)
  }

  async getPendingLogin(): Promise<NeodbPendingLoginV1 | undefined> {
    return normalizePendingLogin(await this.secrets.get(NEODB_SECRET_KEYS.pendingLogin))
  }

  async setPendingLogin(pending: NeodbPendingLoginV1): Promise<void> {
    await this.secrets.set(NEODB_SECRET_KEYS.pendingLogin, pending)
  }

  async deletePendingLogin(): Promise<void> {
    await this.secrets.delete(NEODB_SECRET_KEYS.pendingLogin)
  }

  async clearAll(): Promise<void> {
    await Promise.all([this.secrets.delete(NEODB_SECRET_KEYS.session), this.deletePendingLogin()])
  }
}

function normalizeSession(value: unknown): NeodbAuthSessionV1 | undefined {
  if (!isRecord(value) || value.version !== 1) {
    return undefined
  }

  const instanceUrl = readString(value.instanceUrl)
  const clientId = readString(value.clientId)
  const clientSecret = readString(value.clientSecret)
  const accessToken = readString(value.accessToken)
  if (!instanceUrl || !clientId || !clientSecret || !accessToken) {
    return undefined
  }

  return { version: 1, instanceUrl, clientId, clientSecret, accessToken }
}

function normalizePendingLogin(value: unknown): NeodbPendingLoginV1 | undefined {
  if (!isRecord(value) || value.version !== 1) {
    return undefined
  }

  const instanceUrl = readString(value.instanceUrl)
  const clientId = readString(value.clientId)
  const clientSecret = readString(value.clientSecret)
  const state = readString(value.state)
  const redirectUri = readString(value.redirectUri)
  const createdAt = readNumber(value.createdAt)
  const expiresAt = readNumber(value.expiresAt)
  if (
    !instanceUrl ||
    !clientId ||
    !clientSecret ||
    !state ||
    !redirectUri ||
    createdAt === undefined ||
    expiresAt === undefined
  ) {
    return undefined
  }

  return {
    version: 1,
    instanceUrl,
    clientId,
    clientSecret,
    state,
    redirectUri,
    manual: value.manual === true,
    createdAt,
    expiresAt
  }
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
