import type { IpcError, IpcSuccess, IpcVoidResult } from '@shared/ipc'

export async function wrapIpc<T>(
  operation: () => T | Promise<T>
): Promise<IpcSuccess<T> | IpcError> {
  try {
    return { success: true, data: await operation() }
  } catch (error) {
    return { success: false, error: toIpcErrorMessage(error) }
  }
}

export async function wrapIpcVoid(
  operation: () => unknown | Promise<unknown>
): Promise<IpcVoidResult> {
  try {
    await operation()
    return { success: true }
  } catch (error) {
    return { success: false, error: toIpcErrorMessage(error) }
  }
}

export function toIpcErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
