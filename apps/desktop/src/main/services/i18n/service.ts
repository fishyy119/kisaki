/**
 * I18n Service
 *
 * Sole owner of the UI language preference. Reads the persisted preference,
 * negotiates the effective locale against system languages, exposes the
 * current message catalog and formatters to main-process consumers, and
 * broadcasts changes across processes.
 */

import { app } from 'electron'
import { createLogger } from '@main/log'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import type { DbService } from '@main/services/db'
import type { IpcService } from '@main/services/ipc'
import { settings } from '@shared/db'
import {
  createFormatters,
  getMessages,
  parseUiLocale,
  resolveUiLocale,
  FALLBACK_UI_LOCALE,
  type I18nFormatters,
  type Messages,
  type UiLocale,
  type UiLocaleState
} from '@shared/i18n'
import { createI18nHooks } from './hooks'
import { registerI18nIpc } from './ipc'

const log = createLogger('I18n')

export class I18nService implements IService {
  readonly id = 'i18n'
  readonly deps = ['db', 'ipc'] as const satisfies readonly ServiceName[]
  readonly hooks = createI18nHooks()

  private db!: DbService
  private ipc!: IpcService
  private preference: UiLocale | null = null
  private effective: UiLocale = FALLBACK_UI_LOCALE
  private cachedFormatters: I18nFormatters | null = null
  private cachedFormattersLocale: UiLocale | null = null

  async init(container: ServiceInitContainer<this>): Promise<void> {
    this.db = container.get('db')
    this.ipc = container.get('ipc')

    this.preference = this.readPreference()
    this.effective = this.resolveEffective(this.preference)

    registerI18nIpc(this, this.ipc)
    log.info('Initialized.', {
      preference: this.preference ?? 'system',
      effective: this.effective
    })
  }

  async dispose(): Promise<void> {}

  /** Effective UI locale currently in effect. */
  get locale(): UiLocale {
    return this.effective
  }

  /** Message catalog for the effective locale. */
  get messages(): Messages {
    return getMessages(this.effective)
  }

  /** Intl formatters for the effective locale. */
  get formatters(): I18nFormatters {
    if (!this.cachedFormatters || this.cachedFormattersLocale !== this.effective) {
      this.cachedFormatters = createFormatters(this.effective)
      this.cachedFormattersLocale = this.effective
    }
    return this.cachedFormatters
  }

  getState(): UiLocaleState {
    return { preference: this.preference, effective: this.effective }
  }

  /** Persist a UI language preference (null = follow system) and broadcast the change. */
  setPreference(value: UiLocale | null): void {
    const preference = value === null ? null : parseUiLocale(value)
    if (value !== null && preference === null) {
      throw new Error('Unsupported UI locale.')
    }

    this.preference = preference
    this.effective = this.resolveEffective(preference)
    this.db.client.update(settings).set({ uiLocale: preference }).run()
    const state = this.getState()
    this.hooks.uiLocaleChanged.dispatch(state)
    this.ipc.send('i18n:state-changed', state)

    log.info('UI locale preference updated.', {
      preference: preference ?? 'system',
      effective: this.effective
    })
  }

  private readPreference(): UiLocale | null {
    try {
      const row = this.db.client.select({ uiLocale: settings.uiLocale }).from(settings).get()
      return row?.uiLocale ?? null
    } catch (error) {
      log.warn('Failed to read UI locale preference from settings.', error)
      return null
    }
  }

  private resolveEffective(preference: UiLocale | null): UiLocale {
    return preference ?? resolveUiLocale(app.getPreferredSystemLanguages())
  }
}
