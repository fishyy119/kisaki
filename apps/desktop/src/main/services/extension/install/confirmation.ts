import type { ExtensionReleasePlan } from '@shared/extension'
import type { ExtensionApplyReleaseApproval } from './types'

export interface ExtensionReleasePlanConfirmationInput {
  planId: string
  planFingerprint: string
  trustSignerFingerprint?: boolean
}

export function assertReleasePlanConfirmed(
  plan: ExtensionReleasePlan,
  confirmation: ExtensionReleasePlanConfirmationInput
): void {
  if (confirmation.planId !== plan.id || confirmation.planFingerprint !== plan.fingerprint) {
    throw new Error('Extension release plan has changed. Please review the latest plan.')
  }

  if (
    confirmation.trustSignerFingerprint &&
    (!plan.signer.fingerprint || plan.signer.status === 'unsigned')
  ) {
    throw new Error('Cannot trust an unsigned extension release plan.')
  }
}

export function assertReleasePlanApproved(
  plan: ExtensionReleasePlan,
  approval: ExtensionApplyReleaseApproval
): void {
  if (approval.kind === 'trusted-automatic') {
    if (plan.signer.status !== 'trusted' || !plan.signer.trusted) {
      throw new Error('Automatic extension update requires a trusted signer.')
    }
    return
  }

  assertReleasePlanConfirmed(plan, approval)
}
