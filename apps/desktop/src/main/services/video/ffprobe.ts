/**
 * ffprobe binding.
 *
 * Reads container facts with ffprobe's JSON output. The probe output comes from
 * an arbitrary user file, so every field is read leniently and an unusable value
 * degrades to null rather than failing the whole probe.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { resolveBundledBinary } from '@main/binaries'
import { createLogger } from '@main/log'
import type { AudioTrack, SubtitleTrack, VideoFileInfo, VideoTrack } from '@shared/video'

const log = createLogger('Video')

const execFileAsync = promisify(execFile)

/** ffprobe on a large remote-mounted file can be slow; fail instead of hanging. */
const PROBE_TIMEOUT_MS = 30000
const PROBE_MAX_BUFFER_BYTES = 8 * 1024 * 1024

interface FfprobeStream {
  index?: number
  codec_type?: string
  codec_name?: string
  width?: number
  height?: number
  channels?: number
  bits_per_raw_sample?: string
  pix_fmt?: string
  avg_frame_rate?: string
  r_frame_rate?: string
  disposition?: Record<string, number>
  tags?: Record<string, string>
}

interface FfprobeOutput {
  format?: { duration?: string; format_name?: string }
  streams?: FfprobeStream[]
}

/**
 * Probes a playable file, returning null when no probing engine is installed or
 * the file cannot be read as media.
 */
export async function probeVideoFile(path: string): Promise<VideoFileInfo | null> {
  const enginePath = resolveBundledBinary('ffprobe')
  if (!enginePath) {
    log.warn('Cannot probe media file: no probing engine is available.')
    return null
  }

  let raw: string
  try {
    const result = await execFileAsync(
      enginePath,
      ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', path],
      { timeout: PROBE_TIMEOUT_MS, maxBuffer: PROBE_MAX_BUFFER_BYTES, windowsHide: true }
    )
    raw = result.stdout
  } catch (error) {
    log.warn('Media probe failed.', { message: error instanceof Error ? error.message : 'unknown' })
    return null
  }

  let output: FfprobeOutput
  try {
    output = JSON.parse(raw) as FfprobeOutput
  } catch {
    log.warn('Media probe returned unreadable output.')
    return null
  }

  const streams = output.streams ?? []
  return {
    durationMs: toDurationMs(output.format?.duration),
    container: output.format?.format_name ?? null,
    video: toVideoTrack(streams.find((stream) => stream.codec_type === 'video')),
    audioTracks: streams.filter((stream) => stream.codec_type === 'audio').map(toAudioTrack),
    subtitleTracks: streams
      .filter((stream) => stream.codec_type === 'subtitle')
      .map(toSubtitleTrack)
  }
}

function toDurationMs(duration: string | undefined): number | null {
  const seconds = Number(duration)
  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : null
}

function toVideoTrack(stream: FfprobeStream | undefined): VideoTrack | null {
  if (!stream) {
    return null
  }

  return {
    index: stream.index ?? 0,
    codec: stream.codec_name ?? null,
    bitDepth: toBitDepth(stream),
    width: stream.width ?? null,
    height: stream.height ?? null,
    frameRate: toFrameRate(stream.avg_frame_rate ?? stream.r_frame_rate)
  }
}

function toAudioTrack(stream: FfprobeStream): AudioTrack {
  return {
    index: stream.index ?? 0,
    codec: stream.codec_name ?? null,
    language: stream.tags?.['language'] ?? null,
    title: stream.tags?.['title'] ?? null,
    channels: stream.channels ?? null,
    isDefault: stream.disposition?.['default'] === 1
  }
}

function toSubtitleTrack(stream: FfprobeStream): SubtitleTrack {
  return {
    index: stream.index ?? 0,
    codec: stream.codec_name ?? null,
    language: stream.tags?.['language'] ?? null,
    title: stream.tags?.['title'] ?? null,
    isDefault: stream.disposition?.['default'] === 1,
    isForced: stream.disposition?.['forced'] === 1
  }
}

/**
 * Bit depth is only reported directly by some encoders, so it falls back to the
 * pixel format name, which spells the depth out for the high-bit-depth formats.
 */
function toBitDepth(stream: FfprobeStream): number | null {
  const declared = Number(stream.bits_per_raw_sample)
  if (Number.isInteger(declared) && declared > 0) {
    return declared
  }

  const match = /p(\d{1,2})(le|be)$/.exec(stream.pix_fmt ?? '')
  return match?.[1] ? Number(match[1]) : null
}

/** ffprobe reports frame rates as a `numerator/denominator` string. */
function toFrameRate(value: string | undefined): number | null {
  const [numerator, denominator] = (value ?? '').split('/').map(Number)
  if (!numerator || !denominator || !Number.isFinite(numerator / denominator)) {
    return null
  }

  return Math.round((numerator / denominator) * 1000) / 1000
}
