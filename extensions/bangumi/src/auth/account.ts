import type { ExtensionStorage } from '@kisaki3/extension-sdk'
import type { BangumiClient } from '../api/client'
import type { BangumiMe } from '../api/types'
import { BANGUMI_STORAGE_KEYS } from '../shared/ids'
import type { OAuthRelayTokenStatus } from './relay-client'
import type { TokenService } from './token-service'
import { omitUndefined } from '../shared/object'

export interface BangumiAccountSnapshotV1 {
  version: 1
  id: number
  username: string
  nickname: string
  avatarUrl?: string
  updatedAt: number
}

export interface BangumiAccountVerification {
  account: BangumiAccountSnapshotV1
  tokenStatus: OAuthRelayTokenStatus
}

export class AccountService {
  constructor(
    private readonly storage: ExtensionStorage,
    private readonly client: BangumiClient,
    private readonly tokenService: TokenService
  ) {}

  async getAccountSnapshot(): Promise<BangumiAccountSnapshotV1 | undefined> {
    const raw = await this.storage.get(BANGUMI_STORAGE_KEYS.account)
    return normalizeAccountSnapshot(raw)
  }

  async refreshAccount(signal?: AbortSignal): Promise<BangumiAccountSnapshotV1> {
    const me = await this.client.getMe({ signal })
    const snapshot = toAccountSnapshot(me)
    await this.storage.set(BANGUMI_STORAGE_KEYS.account, snapshot)
    return snapshot
  }

  async verifyAccount(signal?: AbortSignal): Promise<BangumiAccountVerification> {
    const [tokenStatus, account] = await Promise.all([
      this.tokenService.verifyCurrentToken(signal),
      this.refreshAccount(signal)
    ])

    return { account, tokenStatus }
  }

  async logout(): Promise<void> {
    await Promise.all([
      this.tokenService.clear(),
      this.storage.delete(BANGUMI_STORAGE_KEYS.account)
    ])
  }
}

function toAccountSnapshot(me: BangumiMe): BangumiAccountSnapshotV1 {
  return omitUndefined({
    version: 1,
    id: me.id,
    username: me.username,
    nickname: me.nickname || me.username,
    avatarUrl: me.avatar?.large ?? me.avatar?.medium ?? me.avatar?.small,
    updatedAt: Date.now()
  })
}

function normalizeAccountSnapshot(value: unknown): BangumiAccountSnapshotV1 | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }

  const record = value as Record<string, unknown>
  if (record.version !== 1) {
    return undefined
  }

  const id = typeof record.id === 'number' && Number.isFinite(record.id) ? Math.trunc(record.id) : 0
  const username = typeof record.username === 'string' ? record.username.trim() : ''
  const nickname = typeof record.nickname === 'string' ? record.nickname.trim() : ''
  const avatarUrl = typeof record.avatarUrl === 'string' ? record.avatarUrl.trim() : undefined
  const updatedAt =
    typeof record.updatedAt === 'number' && Number.isFinite(record.updatedAt)
      ? Math.trunc(record.updatedAt)
      : 0

  if (id <= 0 || !username || !nickname || updatedAt <= 0) {
    return undefined
  }

  return {
    version: 1,
    id,
    username,
    nickname,
    ...(avatarUrl ? { avatarUrl } : {}),
    updatedAt
  }
}
