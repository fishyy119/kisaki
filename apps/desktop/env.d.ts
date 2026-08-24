/**
 * Build-time env constants statically injected into the main bundle.
 * Keep in sync with the buildEnvKeys list in tools/bundler/targets.ts.
 */
interface ImportMetaEnv {
  readonly VITE_KISAKI_CHANGELOG_BASE_URL: string | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
