/**
 * Clipboard writes with user feedback.
 *
 * Copy actions are fire-and-forget from the user's point of view, so the
 * outcome is reported here once — a success toast, or an error toast with the
 * failure logged — and callers stay one line.
 */

import { messages } from './i18n'
import { createLogger } from './log'
import { notify } from './notify'

const log = createLogger('Clipboard')

export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    notify.success(messages.value.feedback.copied)
  } catch (error) {
    log.warn('Clipboard write failed.', error)
    notify.error(messages.value.feedback.copyFailed)
  }
}
