import type { ExtensionInstallPlan } from '@shared/extension'
import type { ExtensionInstallReleaseApproval } from './types'

export interface ExtensionInstallPlanConfirmationInput {
  planId: string
  planFingerprint: string
  trustSignerFingerprint?: boolean
}

export function assertInstallPlanConfirmed(
  plan: ExtensionInstallPlan,
  confirmation: ExtensionInstallPlanConfirmationInput
): void {
  if (confirmation.planId !== plan.id || confirmation.planFingerprint !== plan.fingerprint) {
    throw new Error('Extension install plan has changed. Please review the latest plan.')
  }

  if (
    confirmation.trustSignerFingerprint &&
    (!plan.signer.fingerprint || plan.signer.status === 'unsigned')
  ) {
    throw new Error('Cannot trust an unsigned extension install plan.')
  }
}

export function assertInstallPlanApproved(
  plan: ExtensionInstallPlan,
  approval: ExtensionInstallReleaseApproval
): void {
  if (approval.kind === 'trusted-automatic') {
    if (plan.signer.status !== 'trusted' || !plan.signer.trusted) {
      throw new Error('Automatic extension update requires a trusted signer.')
    }
    return
  }

  assertInstallPlanConfirmed(plan, approval)
}
