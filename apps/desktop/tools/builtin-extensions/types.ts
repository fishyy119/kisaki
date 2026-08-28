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
  readonly extensionToolingManifest: ExtensionToolingManifest
  readonly extensionToolingPackagesByName: ReadonlyMap<string, ExtensionToolingPackage>
  readonly pnpmCommand: string
}
