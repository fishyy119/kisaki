export { scaffoldRepository, scaffoldWorkspaceExtension } from './generator'
export {
  type ExtensionScaffoldConfig,
  type RepositoryScaffoldConfig,
  type ScaffoldRepositoryOptions,
  type ScaffoldWorkspaceExtensionOptions
} from './model'
export {
  matchesExtensionIdFormat,
  matchesPackageNameFormat,
  matchesRepositoryNameFormat,
  matchesRegistryIdFormat,
  toExtensionId,
  toPackageName,
  toReadableName,
  toRegistryId
} from './names'
export {
  commitGitChanges,
  commitGitPaths,
  initializeGitRepository,
  matchesGitRepository,
  readGitUserName
} from './git'
export { installDependencies } from './package-manager'
export {
  DEFAULT_NODE_ENGINE_RANGE,
  DEFAULT_NODE_TYPES_VERSION,
  DEFAULT_NODE_VERSION,
  DEFAULT_PACKAGE_MANAGER,
  DEFAULT_PNPM_VERSION
} from './toolchain'
export { readExtensionWorkspace, type ExtensionWorkspace } from './workspace'
