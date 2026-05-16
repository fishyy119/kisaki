/**
 * I18n Service
 *
 * Manages internationalization for the main process.
 */

import i18next, { type i18n as I18nInstance } from 'i18next'
import { app } from 'electron'
import { createLogger } from '@main/log'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import type { EventService } from '@main/services/event'
import type { DbService } from '@main/services/db'
import { settings } from '@shared/db'
import type { AppLocale } from '@shared/locale'
import { APP_LOCALES, DEFAULT_LOCALE } from '@shared/locale'

// Import translation resources
import zhHans from './locales/zh-Hans.json'
import en from './locales/en.json'
import ja from './locales/ja.json'

const log = createLogger('Locale')

/** i18next instance for main process */
export const i18n: I18nInstance = i18next.createInstance()

export class I18nService implements IService {
  readonly id = 'i18n'
  readonly deps = ['db', 'event'] as const satisfies readonly ServiceName[]

  private eventService!: EventService
  private dbService!: DbService

  async init(container: ServiceInitContainer<this>): Promise<void> {
    this.dbService = container.get('db')
    this.eventService = container.get('event')

    const initialLocale = this.detectInitialLocale()

    await i18n.init({
      lng: initialLocale,
      fallbackLng: DEFAULT_LOCALE,
      supportedLngs: APP_LOCALES,
      resources: {
        'zh-Hans': { translation: zhHans },
        en: { translation: en },
        ja: { translation: ja }
      },
      interpolation: {
        escapeValue: false
      }
    })

    // Listen for locale changes from renderer
    this.eventService.bus.on(
      'app:locale-changed',
      async ({ locale }: { locale: AppLocale | null }) => {
        const targetLocale = locale ?? this.getSystemLocale()
        if (APP_LOCALES.includes(targetLocale)) {
          await i18n.changeLanguage(targetLocale)
          log.info('Locale changed.', { targetLocale: targetLocale })
        }
      }
    )

    log.info('Initialized.', { initialLocale: initialLocale })
  }

  /**
   * Map system locale to AppLocale
   */
  private mapSystemLocale(systemLocale: string): AppLocale {
    const locale = systemLocale.toLowerCase()

    if (locale.startsWith('zh')) {
      return 'zh-Hans'
    }
    if (locale.startsWith('ja')) {
      return 'ja'
    }
    if (locale.startsWith('en')) {
      return 'en'
    }

    return DEFAULT_LOCALE
  }

  /**
   * Get system locale mapped to AppLocale
   */
  getSystemLocale(): AppLocale {
    return this.mapSystemLocale(app.getLocale())
  }

  /**
   * Detect initial locale from settings or system (sync for better-sqlite3)
   */
  private detectInitialLocale(): AppLocale {
    try {
      const result = this.dbService.client.select({ locale: settings.locale }).from(settings).get()

      if (result?.locale && APP_LOCALES.includes(result.locale)) {
        return result.locale
      }
    } catch (error) {
      log.warn('Failed to read locale from settings:', error)
    }

    // Fallback to system locale
    return this.getSystemLocale()
  }

  /**
   * Get current locale
   */
  getLocale(): AppLocale {
    return i18n.language as AppLocale
  }

  /**
   * Change locale and persist to settings
   * @param locale - AppLocale to set, or null to follow system
   */
  async setLocale(locale: AppLocale | null): Promise<void> {
    if (locale !== null && !APP_LOCALES.includes(locale)) {
      throw new Error(`Unsupported locale: ${locale}`)
    }

    const targetLocale = locale ?? this.getSystemLocale()
    await i18n.changeLanguage(targetLocale)

    // Persist to database (null means follow system) - sync for better-sqlite3
    this.dbService.client.update(settings).set({ locale }).run()

    // Notify other processes
    this.eventService.bus.emit('app:locale-changed', { locale })

    log.info('Locale changed and persisted.', {
      value0: locale ?? 'system',
      targetLocale: targetLocale
    })
  }
}
