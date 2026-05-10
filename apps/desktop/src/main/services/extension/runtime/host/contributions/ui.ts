import {
  createUiError,
  readErrorCode,
  readErrorDetails,
  validateUiCallbackResult,
  type SerializableRecord,
  type UiCallbackResult
} from '@kisaki/extension-api'
import { formatValidationIssues } from './utils'

export async function invokeUiCallback(
  extensionId: string,
  label: string,
  callback: () => Promise<UiCallbackResult> | UiCallbackResult
): Promise<UiCallbackResult> {
  try {
    const result = await callback()
    const issues = validateUiCallbackResult(result)

    if (issues.length > 0) {
      console.warn(
        `[ExtensionHost][${extensionId}] ${label} returned an invalid UiCallbackResult:\n${formatValidationIssues(
          issues
        )}`
      )
      return createUiError('Extension UI callback returned an invalid result.', {
        code: 'validation_failure',
        details: {
          issues: issues.map((issue) => ({
            path: issue.path,
            message: issue.message
          }))
        }
      })
    }

    return result
  } catch (error) {
    console.warn(`[ExtensionHost][${extensionId}] ${label} failed:`, error)
    return createUiError(error instanceof Error ? error.message : 'Extension UI callback failed.', {
      code: readErrorCode(error) ?? 'internal',
      details: readErrorDetails(error) as SerializableRecord | undefined
    })
  }
}
