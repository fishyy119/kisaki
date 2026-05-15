/**
 * Database Proxy
 *
 * Drizzle ORM instance that proxies queries through IPC.
 */

import { drizzle } from 'drizzle-orm/sqlite-proxy'
import { ipcManager } from '../ipc'
import * as schema from '@shared/db'
import { createLogger } from '@renderer/core/log'

const log = createLogger('Db')

export const db = drizzle(
  async (...args) => {
    const result = await ipcManager.invoke('db:execute', ...args)

    if (!result.success) {
      log.error('DB execution error:', result.error)
      throw new Error('Database query failed.')
    }

    return { rows: result.data ?? [] }
  },
  { schema }
)
