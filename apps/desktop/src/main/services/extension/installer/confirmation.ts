import type {
  ExtensionInstallFromFileRequest,
  ExtensionInstallPlan,
  ExtensionInstallReleaseRequest,
  ExtensionUpdateRequest
} from '@shared/extension'

type ExtensionInstallPlanConfirmationInput = Pick<
  ExtensionInstallReleaseRequest | ExtensionInstallFromFileRequest | ExtensionUpdateRequest,
  'planId' | 'planFingerprint'
> & {
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
