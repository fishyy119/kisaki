import type { Messages } from '../schema'
import { actions } from './actions'
import { activity } from './activity'
import { addEntry } from './add-entry'
import { anime } from './anime'
import { automation } from './automation'
import { app } from './app'
import { comic } from './comic'
import { deeplink } from './deeplink'
import { extension } from './extension'
import { feedback } from './feedback'
import { filter } from './filter'
import { game } from './game'
import { ingest } from './ingest'
import { library } from './library'
import { media } from './media'
import { merge } from './merge'
import { nav } from './nav'
import { novel } from './novel'
import { reader } from './reader'
import { scanner } from './scanner'
import { scraper } from './scraper'
import { settings } from './settings'
import { sorting } from './sorting'
import { states } from './states'
import { statistics } from './statistics'
import { task } from './task'
import { ui } from './ui'
import { updater } from './updater'
import { values } from './values'

export const zhHant = {
  actions,
  activity,
  addEntry,
  anime,
  automation,
  app,
  comic,
  deeplink,
  extension,
  feedback,
  filter,
  game,
  ingest,
  library,
  media,
  merge,
  nav,
  novel,
  reader,
  scanner,
  scraper,
  settings,
  sorting,
  states,
  statistics,
  task,
  ui,
  updater,
  values
} satisfies Messages
