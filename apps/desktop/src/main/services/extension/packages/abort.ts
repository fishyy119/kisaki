export function assertPackageSignalNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const error = new Error('Extension package task was cancelled.')
    error.name = 'AbortError'
    throw error
  }
}
