import type { ChildProcess } from 'node:child_process'

/** Built-in extension output destination used by desktop workflows. */
export type BuiltinExtensionBuildTarget = 'dev' | 'resources'

/** Extension tooling package entry from the repository manifest. */
export interface ExtensionToolingPackage {
  readonly name: string
  readonly dir: string
}

/** Repository-owned manifest for the lockstep extension tooling package set. */
export interface ExtensionToolingManifest {
  readonly packages: readonly ExtensionToolingPackage[]
  readonly internalDependencies: Record<string, readonly string[]>
  readonly buildPackageGroups: readonly (readonly string[])[]
}

/** Package fields inspected to discover workspace tooling dependencies. */
export interface BuiltinExtensionPackageJson {
  readonly dependencies?: Record<string, string>
  readonly devDependencies?: Record<string, string>
  readonly optionalDependencies?: Record<string, string>
  readonly peerDependencies?: Record<string, string>
}

/** Shared filesystem and tooling paths for the built-in extension tool. */
export interface BuiltinExtensionToolContext {
  readonly desktopRoot: string
  readonly repoRoot: string
  readonly builtinExtensionsRoot: string
  readonly extensionCliEntry: string
  readonly extensionToolingManifest: ExtensionToolingManifest
  readonly extensionToolingPackagesByName: ReadonlyMap<string, ExtensionToolingPackage>
  readonly pnpmCommand: string
}

/** Running kisx host watcher with a readiness boundary. */
export interface BuiltinExtensionWatcher {
  readonly process: ChildProcess
  readonly ready: Promise<void>
}

/** Running kisx UI dev server with a readiness boundary. */
export interface BuiltinExtensionUiDevServer {
  readonly process: ChildProcess
  readonly ready: Promise<BuiltinExtensionUiDevServerReady>
}

/** Dev-server origin reported by a ready built-in extension webview. */
export interface BuiltinExtensionUiDevServerReady {
  readonly project: string
  readonly origin: string
}
