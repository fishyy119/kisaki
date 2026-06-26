/** Shared command option parsing helpers for the scaffold CLI commands. */

/** Splits a comma-separated string into a trimmed, non-empty list. */
export function parseList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

/** Commander reducer that accumulates repeated or comma-separated list options. */
export function collectList(value: string, previous: string[] | undefined): string[] {
  return [...(previous ?? []), ...parseList(value)]
}

/**
 * Normalizes the repeated `--webview-addon` flags collected by Commander into
 * the `webviewAddons` field expected by scaffold actions. Returns the input
 * unchanged when no addon flags were provided so callers keep exact-optional
 * field semantics.
 */
export function normalizeWebviewAddons<T extends { webviewAddon?: string[] }>(
  options: T
): Omit<T, 'webviewAddon'> & { webviewAddons?: string[] } {
  const { webviewAddon, ...rest } = options
  return webviewAddon ? { ...rest, webviewAddons: webviewAddon } : rest
}
