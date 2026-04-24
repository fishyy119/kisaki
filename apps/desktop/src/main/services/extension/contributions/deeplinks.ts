import type {
  DeeplinkContributionRegistration,
  DeeplinkRequest,
  DeeplinkResponse,
  ExtensionRuntimeHandle
} from '@kisaki/extension-api'
import type { ExtensionDeeplinkContributionInfo } from '@shared/extension'
import {
  getRuntimeContributionKey,
  requireContributionOwner,
  toContributionOwnerInfo,
  type ExtensionContributionHostOptions,
  type RuntimeContributionOwner
} from './types'

interface DeeplinkRegistration {
  owner: RuntimeContributionOwner
  contribution: DeeplinkContributionRegistration
}

export class ExtensionDeeplinkContributionHost {
  private readonly registrations = new Map<string, DeeplinkRegistration>()

  constructor(private readonly options: ExtensionContributionHostOptions) {}

  register(
    runtimeHandle: ExtensionRuntimeHandle,
    contribution: DeeplinkContributionRegistration
  ): void {
    const owner = requireContributionOwner(this.options, runtimeHandle)
    this.registrations.set(getRuntimeContributionKey(runtimeHandle, contribution.id), {
      owner,
      contribution
    })
  }

  unregister(runtimeHandle: ExtensionRuntimeHandle, contributionId: string): void {
    this.registrations.delete(getRuntimeContributionKey(runtimeHandle, contributionId))
  }

  releaseRuntime(runtimeHandle: ExtensionRuntimeHandle): void {
    for (const [key, registration] of [...this.registrations]) {
      if (registration.owner.runtimeHandle === runtimeHandle) {
        this.registrations.delete(key)
      }
    }
  }

  releaseAll(): void {
    this.registrations.clear()
  }

  getSnapshot(): readonly ExtensionDeeplinkContributionInfo[] {
    return [...this.registrations.values()]
      .map((registration) => ({
        ...toContributionOwnerInfo(registration.owner),
        contribution: registration.contribution
      }))
      .sort((left, right) => left.contribution.route.localeCompare(right.contribution.route))
  }

  async handle(route: string, input: DeeplinkRequest): Promise<DeeplinkResponse | null> {
    const registration = [...this.registrations.values()].find(
      (entry) => entry.contribution.route === route
    )
    if (!registration) {
      return null
    }

    return this.options.requestHost(
      'deeplinks.handle',
      {
        runtimeHandle: registration.owner.runtimeHandle,
        contributionId: registration.contribution.id,
        input
      },
      { timeoutMs: 15_000 }
    )
  }
}
