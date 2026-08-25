/**
 * Public surface of the extension service.
 *
 * Submodules (installer, packages, repositories, installations, signers,
 * runtime) are reached through the service namespaces; nothing outside the
 * service constructs them directly.
 */

export { ExtensionService } from './service'
