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
export { DEFAULT_NODE_ENGINE_RANGE, DEFAULT_PACKAGE_MANAGER } from './toolchain'
export { readExtensionWorkspace, type ExtensionWorkspace } from './workspace'
