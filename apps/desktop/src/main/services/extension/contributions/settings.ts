import { randomUUID } from 'node:crypto'
import log from 'electron-log/main'
import {
  readErrorCode,
  type ExtensionRuntimeHandle,
  type SettingsContributionRegistration,
  type SettingsFrameResult,
  type SettingsInteractionResult
} from '@kisaki/extension-api'
import type {
  ExtensionResolvedSettingsFrame,
  ExtensionSettingsContributionInfo,
  ExtensionSettingsFrameOpenRequest,
  ExtensionSettingsFrameRefreshRequest,
  ExtensionSettingsFrameReleaseRequest,
  ExtensionSettingsInteractionResponse,
  ExtensionSettingsInvokeRequest,
  ExtensionSettingsSession,
  ExtensionSettingsSubmitRequest
} from '@shared/extension'
import {
  getRuntimeContributionKey,
  requireContributionOwner,
  toContributionOwnerInfo,
  type ExtensionContributionHostOptions,
  type RuntimeContributionOwner
} from './types'

interface SettingsRegistration {
  owner: RuntimeContributionOwner
  contribution: SettingsContributionRegistration
}

export class ExtensionSettingsContributionHost {
  private readonly registrations = new Map<string, SettingsRegistration>()
  private readonly byPublicId = new Map<string, SettingsRegistration>()

  constructor(private readonly options: ExtensionContributionHostOptions) {}

  register(
    runtimeHandle: ExtensionRuntimeHandle,
    contribution: SettingsContributionRegistration
  ): void {
    const owner = requireContributionOwner(this.options, runtimeHandle)
    const key = getRuntimeContributionKey(runtimeHandle, contribution.id)
    const publicKey = getPublicContributionKey(owner.extension.id, contribution.id)

    if (this.byPublicId.has(publicKey)) {
      throw new Error(
        `Extension "${owner.extension.id}" already registered settings contribution "${contribution.id}".`
      )
    }

    const registration: SettingsRegistration = {
      owner,
      contribution
    }

    this.registrations.set(key, registration)
    this.byPublicId.set(publicKey, registration)
  }

  unregister(runtimeHandle: ExtensionRuntimeHandle, contributionId: string): void {
    const key = getRuntimeContributionKey(runtimeHandle, contributionId)
    const registration = this.registrations.get(key)
    if (!registration) {
      return
    }

    this.registrations.delete(key)
    this.byPublicId.delete(
      getPublicContributionKey(registration.owner.extension.id, contributionId)
    )
  }

  releaseRuntime(runtimeHandle: ExtensionRuntimeHandle): void {
    for (const [key, registration] of [...this.registrations]) {
      if (registration.owner.runtimeHandle === runtimeHandle) {
        this.registrations.delete(key)
        this.byPublicId.delete(
          getPublicContributionKey(registration.owner.extension.id, registration.contribution.id)
        )
      }
    }
  }

  releaseAll(): void {
    this.registrations.clear()
    this.byPublicId.clear()
  }

  getSnapshot(): readonly ExtensionSettingsContributionInfo[] {
    return [...this.registrations.values()]
      .map(toSettingsContributionInfo)
      .sort(
        (left, right) =>
          left.order - right.order || left.contributionId.localeCompare(right.contributionId)
      )
  }

  async openSession(
    extensionId: string,
    contributionId: string
  ): Promise<ExtensionSettingsSession> {
    const registration = this.requireRegistration(extensionId, contributionId)
    const sessionId = randomUUID()
    const frame = await this.options.requestHost(
      'settings.open',
      {
        runtimeHandle: registration.owner.runtimeHandle,
        contributionId: registration.contribution.id,
        sessionId
      },
      { timeoutMs: 15_000 }
    )

    return {
      sessionId,
      extensionId,
      contributionId,
      frame: toResolvedSettingsFrame(extensionId, contributionId, sessionId, frame)
    }
  }

  async openFrame(
    request: ExtensionSettingsFrameOpenRequest
  ): Promise<ExtensionResolvedSettingsFrame> {
    const registration = this.requireRegistration(request.extensionId, request.contributionId)
    const frame = await this.options.requestHost(
      'settings.frame.open',
      {
        runtimeHandle: registration.owner.runtimeHandle,
        contributionId: registration.contribution.id,
        sessionId: request.sessionId,
        target: request.target
      },
      { timeoutMs: 15_000 }
    )

    return toResolvedSettingsFrame(
      request.extensionId,
      request.contributionId,
      request.sessionId,
      frame
    )
  }

  async refreshFrame(
    request: ExtensionSettingsFrameRefreshRequest
  ): Promise<ExtensionResolvedSettingsFrame> {
    const registration = this.requireRegistration(request.extensionId, request.contributionId)
    const frame = await this.options.requestHost(
      'settings.frame.refresh',
      {
        runtimeHandle: registration.owner.runtimeHandle,
        contributionId: registration.contribution.id,
        sessionId: request.sessionId,
        frameId: request.frameId
      },
      { timeoutMs: 15_000 }
    )

    return toResolvedSettingsFrame(
      request.extensionId,
      request.contributionId,
      request.sessionId,
      frame
    )
  }

  async submit(
    request: ExtensionSettingsSubmitRequest
  ): Promise<ExtensionSettingsInteractionResponse> {
    const registration = this.findRegistration(request.extensionId, request.contributionId)
    if (!registration) {
      return {
        result: createSettingsError('Settings contribution is no longer active.', 'unavailable'),
        refreshedFrames: []
      }
    }

    try {
      const response = await this.options.requestHost(
        'settings.submit',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          contributionId: registration.contribution.id,
          sessionId: request.sessionId,
          frameId: request.frameId,
          values: request.values
        },
        { timeoutMs: 15_000 }
      )

      return { ...response, refreshedFrames: [] }
    } catch (error) {
      log.warn(
        `[ExtensionContributionRegistry] Settings submit "${request.extensionId}:${request.contributionId}:${request.frameId}" failed:`,
        error
      )
      return {
        result: createSettingsError(
          toErrorMessage(error, 'Settings submit failed.'),
          readErrorCode(error) ?? 'internal'
        ),
        refreshedFrames: []
      }
    }
  }

  async invoke(
    request: ExtensionSettingsInvokeRequest
  ): Promise<ExtensionSettingsInteractionResponse> {
    const registration = this.findRegistration(request.extensionId, request.contributionId)
    if (!registration) {
      return {
        result: createSettingsError('Settings contribution is no longer active.', 'unavailable'),
        refreshedFrames: []
      }
    }

    try {
      const response = await this.options.requestHost(
        'settings.invoke',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          contributionId: registration.contribution.id,
          sessionId: request.sessionId,
          frameId: request.frameId,
          callbackId: request.callbackId,
          value: request.value
        },
        { timeoutMs: 15_000 }
      )

      return { ...response, refreshedFrames: [] }
    } catch (error) {
      log.warn(
        `[ExtensionContributionRegistry] Settings callback "${request.extensionId}:${request.contributionId}:${request.frameId}" failed:`,
        error
      )
      return {
        result: createSettingsError(
          toErrorMessage(error, 'Settings callback failed.'),
          readErrorCode(error) ?? 'internal'
        ),
        refreshedFrames: []
      }
    }
  }

  async releaseFrame(request: ExtensionSettingsFrameReleaseRequest): Promise<void> {
    const registration = this.findRegistration(request.extensionId, request.contributionId)
    if (!registration) {
      return
    }

    try {
      await this.options.requestHost(
        'settings.frame.release',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          contributionId: registration.contribution.id,
          sessionId: request.sessionId,
          frameId: request.frameId
        },
        { timeoutMs: 5_000 }
      )
    } catch (error) {
      log.warn(
        `[ExtensionContributionRegistry] Failed to release settings frame "${request.extensionId}:${request.contributionId}:${request.sessionId}:${request.frameId}":`,
        error
      )
    }
  }

  async releaseSession(
    extensionId: string,
    contributionId: string,
    sessionId: string
  ): Promise<void> {
    const registration = this.findRegistration(extensionId, contributionId)
    if (!registration) {
      return
    }

    try {
      await this.options.requestHost(
        'settings.session.release',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          contributionId: registration.contribution.id,
          sessionId
        },
        { timeoutMs: 5_000 }
      )
    } catch (error) {
      log.warn(
        `[ExtensionContributionRegistry] Failed to release settings session "${extensionId}:${contributionId}:${sessionId}":`,
        error
      )
    }
  }

  private requireRegistration(extensionId: string, contributionId: string): SettingsRegistration {
    const registration = this.findRegistration(extensionId, contributionId)
    if (!registration) {
      throw new Error(
        `Settings contribution "${extensionId}:${contributionId}" is no longer active.`
      )
    }
    return registration
  }

  private findRegistration(
    extensionId: string,
    contributionId: string
  ): SettingsRegistration | undefined {
    return this.byPublicId.get(getPublicContributionKey(extensionId, contributionId))
  }
}

function toSettingsContributionInfo(
  registration: SettingsRegistration
): ExtensionSettingsContributionInfo {
  return {
    ...toContributionOwnerInfo(registration.owner),
    contributionId: registration.contribution.id,
    title: registration.contribution.title,
    description: registration.contribution.description,
    order: registration.contribution.order ?? 0,
    rootScreenId: registration.contribution.rootScreenId
  }
}

function toResolvedSettingsFrame(
  extensionId: string,
  contributionId: string,
  sessionId: string,
  frame: SettingsFrameResult
): ExtensionResolvedSettingsFrame {
  return {
    sessionId,
    extensionId,
    contributionId,
    frameId: frame.frameId,
    screenId: frame.screenId,
    params: frame.params,
    screen: frame.screen
  }
}

function createSettingsError(message: string, code?: string): SettingsInteractionResult {
  return {
    success: false,
    error: {
      code,
      message
    }
  }
}

function getPublicContributionKey(extensionId: string, contributionId: string): string {
  return `${extensionId}:${contributionId}`
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}
