/**
 * Bundled native tool layout.
 *
 * Playback and probing rely on third-party executables that ship as unpacked
 * resources. The layout is shared so the packaging tool stages binaries exactly
 * where the runtime resolver looks for them.
 */

export const BUNDLED_BINARY_NAMES = ['mpv', 'ffprobe'] as const

export type BundledBinary = (typeof BUNDLED_BINARY_NAMES)[number]

/** Resource-relative root that holds one directory per platform-arch pair. */
export const BUNDLED_BINARY_RESOURCE_DIR = 'bin'

export function getBundledBinaryPlatformDir(platform: string, arch: string): string {
  return `${platform}-${arch}`
}

export function toBundledExecutableName(name: BundledBinary, platform: string): string {
  return platform === 'win32' ? `${name}.exe` : name
}
