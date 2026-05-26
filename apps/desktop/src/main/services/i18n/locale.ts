import i18next, { type i18n as I18nInstance } from 'i18next'
import { app } from 'electron'
import { createLogger } from '@main/log'
import type { DbService } from '@main/services/db'
import type { EventService } from '@main/services/event'
import { settings } from '@shared/db'
import type { EventUnsubscribe } from '@shared/events'
import type { AppLocale } from '@shared/locale'
import { APP_LOCALES, DEFAULT_LOCALE } from '@shared/locale'

import zhHans from './locales/zh-Hans.json'
import en from './locales/en.json'
import ja from './locales/ja.json'

const log = createLogger('Locale')

const i18n: I18nInstance = i18next.createInstance()

export class I18nLocaleManager {
  private unsubscribeLocaleChanged: EventUnsubscribe | null = null

  constructor(
    private readonly dbService: DbService,
    private readonly eventService: EventService
  ) {}

  async init(): Promise<AppLocale> {
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

    this.unsubscribeLocaleChanged = this.eventService.bus.on('app.locale.changed', ({ locale }) => {
      void this.applyPreference(locale)
        .then((targetLocale) => {
          log.info('Locale changed.', { targetLocale: targetLocale })
        })
        .catch((error) => {
          log.warn('Failed to apply locale change.', error)
        })
    })

    return initialLocale
  }

  dispose(): void {
    this.unsubscribeLocaleChanged?.()
    this.unsubscribeLocaleChanged = null
  }

  getSystem(): AppLocale {
    return mapSystemLocale(app.getLocale())
  }

  getCurrent(): AppLocale {
    return i18n.language as AppLocale
  }

  async setPreference(locale: AppLocale | null): Promise<void> {
    const targetLocale = await this.applyPreference(locale)

    this.dbService.client.update(settings).set({ locale }).run()
    this.eventService.bus.emit('app.locale.changed', { locale })

    log.info('Locale changed and persisted.', {
      value0: locale ?? 'system',
      targetLocale: targetLocale
    })
  }

  private detectInitialLocale(): AppLocale {
    try {
      const result = this.dbService.client.select({ locale: settings.locale }).from(settings).get()

      if (result?.locale && APP_LOCALES.includes(result.locale)) {
        return result.locale
      }
    } catch (error) {
      log.warn('Failed to read locale from settings.', error)
    }

    return this.getSystem()
  }

  private async applyPreference(locale: AppLocale | null): Promise<AppLocale> {
    const targetLocale = this.resolvePreference(locale)

    if (i18n.language !== targetLocale) {
      await i18n.changeLanguage(targetLocale)
    }

    return targetLocale
  }

  private resolvePreference(locale: AppLocale | null): AppLocale {
    if (locale === null) {
      return this.getSystem()
    }

    if (!APP_LOCALES.includes(locale)) {
      throw new Error('Unsupported locale.')
    }

    return locale
  }
}

function mapSystemLocale(systemLocale: string): AppLocale {
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
