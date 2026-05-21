/**
 * Hard RPC timeouts are reserved for extension host lifecycle and cleanup
 * boundaries. User-facing contribution callbacks rely on cancellation and
 * session invalidation instead of fixed deadlines.
 */
export const EXTENSION_HOST_HANDSHAKE_TIMEOUT_MS = 10_000
export const EXTENSION_HOST_LIFECYCLE_TIMEOUT_MS = 15_000
export const EXTENSION_HOST_SHUTDOWN_TIMEOUT_MS = 10_000
export const EXTENSION_CONTRIBUTION_SYNC_TIMEOUT_MS = 10_000
export const EXTENSION_CLEANUP_TIMEOUT_MS = 5_000
