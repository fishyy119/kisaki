/**
 * mpv user configuration directory.
 *
 * Playback runs against an app-owned config dir under userData instead of the
 * system-wide mpv config: users customize rendering, shaders, scripts, and key
 * bindings for Kisaki without touching their standalone mpv setup, and the
 * managed process never inherits surprises from one. Options Kisaki passes on
 * the command line always take precedence over this directory.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { createLogger } from '@main/log'

const log = createLogger('Video')

const CONFIG_DIR_NAME = 'mpv'

const CONFIG_TEMPLATE = `# mpv configuration for playback started by Kisaki.
#
# Everything mpv supports works here: track language preferences (alang,
# slang), video output and shader options, user scripts in scripts/, key
# bindings in input.conf, fonts in fonts/. This directory is fully isolated
# from any system-wide mpv configuration.
#
# Kisaki passes a few options on the command line, which always override this
# file: input-ipc-server, idle, keep-open, save-position-on-quit,
# write-filename-in-watch-later-config, sub-auto, start.
#
# Resume positions and watched state are tracked by Kisaki itself, so
# watch-later style options have no effect on what the library records.
`

/**
 * Resolves the app-owned mpv config directory, creating it and seeding the
 * annotated mpv.conf template on first use. An existing mpv.conf is never
 * touched.
 */
export function ensureMpvConfigDir(): string {
  const configDir = join(app.getPath('userData'), CONFIG_DIR_NAME)
  mkdirSync(configDir, { recursive: true })

  const configFile = join(configDir, 'mpv.conf')
  if (!existsSync(configFile)) {
    writeFileSync(configFile, CONFIG_TEMPLATE, 'utf8')
    log.info('Seeded mpv config template.', { configDir: CONFIG_DIR_NAME })
  }

  return configDir
}
