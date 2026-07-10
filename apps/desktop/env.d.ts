/**
 * Build-time env constants statically injected into the main bundle.
 * Keep in sync with the buildEnvKeys list in tools/bundler/targets.ts.
 */
interface ImportMetaEnv {
  readonly VITE_YMGAL_API_CLIENT_ID: string | undefined
  readonly VITE_YMGAL_API_CLIENT_SECRET: string | undefined
  readonly VITE_IGDB_API_CLIENT_ID: string | undefined
  readonly VITE_IGDB_API_CLIENT_SECRET: string | undefined
  readonly VITE_VNDB_API_TOKEN: string | undefined
  readonly VITE_KISAKI_CHANGELOG_BASE_URL: string | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
