import type {
  ExtensionInstallReleaseRequest,
  ExtensionInstallUpdatePolicy
} from '@shared/extension'

export type ExtensionInstallReleaseReason = 'manual' | 'update'

export type ExtensionInstallReleaseApproval =
  | {
      kind: 'user-confirmed'
      planId: string
      planFingerprint: string
      trustSignerFingerprint: boolean
    }
  | {
      kind: 'trusted-automatic'
    }

export interface ExtensionInstallReleaseCommand {
  operationId: string
  extensionId: string
  releaseId?: string
  repositoryId?: string
  reason: ExtensionInstallReleaseReason
  approval: ExtensionInstallReleaseApproval
  enabled?: boolean
  updatePolicy?: ExtensionInstallUpdatePolicy
}

export function createInstallReleaseCommandFromRequest(
  request: ExtensionInstallReleaseRequest
): ExtensionInstallReleaseCommand {
  return {
    operationId: request.operationId,
    extensionId: request.extensionId,
    releaseId: request.releaseId,
    repositoryId: request.repositoryId,
    reason: 'manual',
    approval: {
      kind: 'user-confirmed',
      planId: request.planId,
      planFingerprint: request.planFingerprint,
      trustSignerFingerprint: request.trustSignerFingerprint === true
    },
    enabled: request.enabled,
    updatePolicy: request.updatePolicy
  }
}
