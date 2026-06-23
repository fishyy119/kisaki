export { scaffoldRepository, scaffoldWorkspaceExtension } from './generator'
export {
  type ExtensionScaffoldConfig,
  type ScaffoldRepositoryOptions,
  type ScaffoldWorkspaceExtensionOptions
} from './model'
export {
  matchesPackageNameFormat,
  matchesProjectNameFormat,
  toDisplayName,
  toExtensionId,
  toPackageName
} from './names'
export {
  commitGitChanges,
  commitGitPaths,
  initializeGitRepository,
  matchesGitRepository,
  readGitUserName
} from './git'
export { installDependencies } from './package-manager'
export { DEFAULT_NODE_VERSION, DEFAULT_PACKAGE_MANAGER } from './toolchain'
export { validateExtensionWorkspace } from './workspace'
