import type { BundledBinary } from '../../src/shared/binaries'

/** One pinned release asset holding a bundled executable. */
export interface MediaBinarySource {
  readonly binary: BundledBinary
  /** Immutable release asset URL; its content never changes after publishing. */
  readonly url: string
  /** SHA-256 of the downloaded archive, verified before extraction. */
  readonly sha256: string
  /** Path of the executable inside the archive. */
  readonly archiveEntry: string
}

/**
 * Pinned download sources keyed by `<platform>-<arch>`.
 *
 * Only immutable assets (date/commit-tagged releases) may be pinned here so the
 * checksum stays valid; rolling tags such as BtbN's `latest` are not allowed.
 * To bump a tool, replace `url`, `archiveEntry`, and `sha256` together: download
 * the new asset and hash it with `shasum -a 256` / `Get-FileHash`.
 *
 * Platforms without pins stage binaries manually via `media-binaries stage`.
 */
export const MEDIA_BINARY_SOURCES: Readonly<Partial<Record<string, readonly MediaBinarySource[]>>> =
  {
    'win32-x64': [
      {
        binary: 'mpv',
        url: 'https://github.com/zhongfly/mpv-winbuild/releases/download/2026-08-11-f4d13e1c2c/mpv-x86_64-20260811-git-f4d13e1c2c.7z',
        sha256: '778c584ab8c4c2e6f26c6e4497bde852175ee70f0a3d60fc2a3e6cd3c55f742c',
        archiveEntry: 'mpv.exe'
      },
      {
        binary: 'ffprobe',
        url: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2026-08-11-13-11/ffmpeg-n8.1.2-34-g9b6c8969e0-win64-gpl-8.1.zip',
        sha256: '05eedc113542be39af5d0f78f0b1093bafb89c98cecf25b77e8644670293107f',
        archiveEntry: 'ffmpeg-n8.1.2-34-g9b6c8969e0-win64-gpl-8.1/bin/ffprobe.exe'
      }
    ]
  }
