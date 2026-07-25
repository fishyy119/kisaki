import type { ExtensionTrustedSignerInfo } from '@shared/extension'
import { formatters, messages } from '@renderer/core/i18n'

export function shortSignerFingerprint(value: string): string {
  return `${value.slice(0, 12)}...${value.slice(-8)}`
}

export function formatSignerDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) {
    return value
  }

  return formatters.value.dateTime(date)
}

export function formatSignerOptionalValue(value: string | null): string {
  return value ?? messages.value.extension.signer.none
}

export function getSignerRepositoryLabel(signer: ExtensionTrustedSignerInfo): string {
  return (
    signer.trustedFromRepositoryUrl ??
    signer.trustedFromRepositoryId ??
    messages.value.extension.signer.localConfirmation
  )
}
