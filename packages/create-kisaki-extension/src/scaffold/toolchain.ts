/** Node.js major version used by generated package manifests and workflows. */
export const DEFAULT_NODE_VERSION = '24'

/** Node.js engine range declared by generated package manifests. */
export const DEFAULT_NODE_ENGINE_RANGE = `>=${DEFAULT_NODE_VERSION}.0.0`

/** Node.js type declarations used by generated TypeScript projects. */
export const DEFAULT_NODE_TYPES_VERSION = `^${DEFAULT_NODE_VERSION}.0.0`

/**
 * pnpm version used by generated package manifests and workflows.
 * Held at 11.10.0 until the 11.11.0 peer-resolution deadlock is fixed:
 * https://github.com/pnpm/pnpm/issues/12921
 */
export const DEFAULT_PNPM_VERSION = '11.10.0'

/** Exact package manager used by generated repositories. */
export const DEFAULT_PACKAGE_MANAGER = `pnpm@${DEFAULT_PNPM_VERSION}`
