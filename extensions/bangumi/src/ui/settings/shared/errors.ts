import type { ExtensionErrorShape } from '@kisaki/extension-sdk'
import { BangumiExtensionError } from '../../../shared/errors'

export function toSettingsError(error: unknown): ExtensionErrorShape {
  if (error instanceof BangumiExtensionError) {
    return {
      code: error.code,
      message: error.message
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return {
      code: 'bangumi_error',
      message: error.message.trim()
    }
  }

  return {
    code: 'bangumi_error',
    message: 'Bangumi 操作失败，请稍后重试。'
  }
}
