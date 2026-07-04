import type { ExtensionApplyReleaseRequest, ExtensionInstallUpdatePolicy } from '@shared/extension'

export type ExtensionApplyReleaseApproval =
  | {
      kind: 'user-confirmed'
      planId: string
      planFingerprint: string
      trustSignerFingerprint: boolean
    }
  | {
      kind: 'trusted-automatic'
    }

export interface ExtensionRepositoryReleaseCommand {
  sourceKind: 'repository'
  extensionId: string
  releaseId?: string
  repositoryId?: string
  approval: ExtensionApplyReleaseApproval
  enabled?: boolean
  updatePolicy?: ExtensionInstallUpdatePolicy
}

export interface ExtensionLocalReleaseCommand {
  sourceKind: 'local-file'
  filePath: string
  approval: ExtensionApplyReleaseApproval
  enabled?: boolean
}

export type ExtensionApplyReleaseCommand =
  | ExtensionRepositoryReleaseCommand
  | ExtensionLocalReleaseCommand

export function createApplyReleaseCommandFromRequest(
  request: ExtensionApplyReleaseRequest
): ExtensionApplyReleaseCommand {
  const approval: ExtensionApplyReleaseApproval = {
    kind: 'user-confirmed',
    planId: request.planId,
    planFingerprint: request.planFingerprint,
    trustSignerFingerprint:
      request.sourceKind === 'repository' && request.trustSignerFingerprint === true
  }

  if (request.sourceKind === 'local-file') {
    return {
      sourceKind: request.sourceKind,
      filePath: request.filePath,
      approval,
      enabled: request.enabled
    }
  }

  return {
    sourceKind: request.sourceKind,
    extensionId: request.extensionId,
    releaseId: request.releaseId,
    repositoryId: request.repositoryId,
    approval,
    enabled: request.enabled,
    updatePolicy: request.updatePolicy
  }
}
