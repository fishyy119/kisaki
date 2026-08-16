import type { Messages } from '../schema'
import { activity } from './activity'
import { adder } from './adder'
import { anime } from './anime'
import { automation } from './automation'
import { app } from './app'
import { common } from './common'
import { extension } from './extension'
import { filter } from './filter'
import { game } from './game'
import { ingest } from './ingest'
import { library } from './library'
import { media } from './media'
import { merge } from './merge'
import { movie } from './movie'
import { nav } from './nav'
import { scanner } from './scanner'
import { scraper } from './scraper'
import { settings } from './settings'
import { statistics } from './statistics'
import { task } from './task'
import { tv } from './tv'
import { ui } from './ui'
import { updater } from './updater'

export const ja = {
  activity,
  adder,
  anime,
  automation,
  app,
  common,
  extension,
  filter,
  game,
  ingest,
  library,
  media,
  merge,
  movie,
  nav,
  scanner,
  scraper,
  settings,
  statistics,
  task,
  tv,
  ui,
  updater
} satisfies Messages
