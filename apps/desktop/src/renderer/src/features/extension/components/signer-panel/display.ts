import type { ExtensionTrustedSignerInfo } from '@shared/extension'

export function shortSignerFingerprint(value: string): string {
  return `${value.slice(0, 12)}...${value.slice(-8)}`
}

export function formatSignerDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) {
    return value
  }

  return date.toLocaleString()
}

export function formatSignerOptionalValue(value: string | null): string {
  return value ?? '无'
}

export function getSignerRepositoryLabel(signer: ExtensionTrustedSignerInfo): string {
  return signer.trustedFromRepositoryUrl ?? signer.trustedFromRepositoryId ?? '本地确认'
}
