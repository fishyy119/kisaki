import type { SettingsCallbackResult } from '@kisaki/extension-api'

export function createSettingsError(message: string, code?: string): SettingsCallbackResult {
  return {
    success: false,
    error: {
      code,
      message
    }
  }
}

export function getPublicContributionKey(extensionId: string, contributionId: string): string {
  return `${extensionId}:${contributionId}`
}

export function getSettingsSessionKey(
  extensionId: string,
  contributionId: string,
  sessionId: string
): string {
  return `${extensionId}:${contributionId}:${sessionId}`
}

export function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}
