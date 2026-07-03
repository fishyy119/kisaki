/** Node.js major version used by generated package manifests and workflows. */
export const DEFAULT_NODE_VERSION = '24'

/** Node.js engine range declared by generated package manifests. */
export const DEFAULT_NODE_ENGINE_RANGE = `>=${DEFAULT_NODE_VERSION}.0.0`

/** Node.js type declarations used by generated TypeScript projects. */
export const DEFAULT_NODE_TYPES_VERSION = `^${DEFAULT_NODE_VERSION}.0.0`

/** pnpm version used by generated package manifests and workflows. */
export const DEFAULT_PNPM_VERSION = '11.2.2'

/** Exact package manager used by generated repositories. */
export const DEFAULT_PACKAGE_MANAGER = `pnpm@${DEFAULT_PNPM_VERSION}`
