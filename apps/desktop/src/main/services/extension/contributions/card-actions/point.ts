import type { CardActionRegistrationInfo, ExtensionRuntimeHandle } from '@kisaki3/extension-api'
import type {
  ExtensionCardActionRegistrationInfo,
  ExtensionCardActionRunRequest
} from '@shared/extension'
import {
  getRuntimeContributionKey,
  requireContributionOwner,
  toContributionOwnerInfo,
  type ExtensionContributionReleaseDiagnostic,
  type ExtensionContributionDomainOptions,
  type RuntimeContributionOwner
} from '../types'

interface CardActionRegistration {
  owner: RuntimeContributionOwner
  action: CardActionRegistrationInfo
}

export class ExtensionCardActionContributionPoint {
  private readonly registrations = new Map<string, CardActionRegistration>()
  private readonly byPublicId = new Map<string, CardActionRegistration>()

  constructor(private readonly options: ExtensionContributionDomainOptions) {}

  register(runtimeHandle: ExtensionRuntimeHandle, action: CardActionRegistrationInfo): void {
    const owner = requireContributionOwner(this.options, runtimeHandle)
    const publicKey = getPublicCardActionKey(owner.extension.id, action.id)
    if (this.byPublicId.has(publicKey)) {
      throw new Error(
        `Extension "${owner.extension.id}" already registered card action "${action.id}".`
      )
    }

    const registration: CardActionRegistration = { owner, action }
    this.registrations.set(getRuntimeContributionKey(runtimeHandle, action.id), registration)
    this.byPublicId.set(publicKey, registration)
  }

  unregister(runtimeHandle: ExtensionRuntimeHandle, contributionId: string): void {
    const key = getRuntimeContributionKey(runtimeHandle, contributionId)
    const registration = this.registrations.get(key)
    if (!registration) {
      return
    }

    this.registrations.delete(key)
    this.byPublicId.delete(getPublicCardActionKey(registration.owner.extension.id, contributionId))
  }

  releaseRuntime(runtimeHandle: ExtensionRuntimeHandle): void {
    for (const [key, registration] of [...this.registrations]) {
      if (registration.owner.runtimeHandle === runtimeHandle) {
        this.registrations.delete(key)
        this.byPublicId.delete(
          getPublicCardActionKey(registration.owner.extension.id, registration.action.id)
        )
      }
    }
  }

  releaseAll(): void {
    this.registrations.clear()
    this.byPublicId.clear()
  }

  async run(request: ExtensionCardActionRunRequest): Promise<void> {
    const registration = this.byPublicId.get(
      getPublicCardActionKey(request.extensionId, request.contributionId)
    )
    if (!registration) {
      throw new Error(
        `Card action "${request.contributionId}" is not registered for "${request.extensionId}".`
      )
    }

    await this.options.requestHost('contributions.cardActions.run', {
      runtimeHandle: registration.owner.runtimeHandle,
      contributionId: request.contributionId
    })
  }

  getSnapshot(): readonly ExtensionCardActionRegistrationInfo[] {
    return [...this.registrations.values()]
      .map((registration) => ({
        ...toContributionOwnerInfo(registration.owner),
        contributionId: registration.action.id,
        label: registration.action.label,
        ...(registration.action.description === undefined
          ? {}
          : { description: registration.action.description }),
        order: registration.action.order ?? 0
      }))
      .sort(
        (left, right) =>
          left.order - right.order || left.contributionId.localeCompare(right.contributionId)
      )
  }

  getReleaseDiagnostics(extensionId: string): readonly ExtensionContributionReleaseDiagnostic[] {
    return [...this.registrations.values()]
      .filter((registration) => registration.owner.extension.id === extensionId)
      .map((registration) => ({
        domain: 'cardActions',
        detail: registration.action.id
      }))
  }
}

function getPublicCardActionKey(extensionId: string, contributionId: string): string {
  return `${extensionId}:${contributionId}`
}
