import { createLogger } from '@main/log'
import type { NetworkService } from '@main/services/network'
import type { AppUpdaterChangelogBundle, AppUpdaterChangelogLocale } from '@shared/updater'
import { APP_UPDATER_CHANGELOG_LOCALES } from '@shared/updater'
import { valid as isValidSemver } from 'semver'

const log = createLogger('Updater')
const DEFAULT_CHANGELOG_BASE_URL =
  'https://raw.githubusercontent.com/ximu3/kisaki/main/changelog/desktop'

interface UpdaterChangelogProviderOptions {
  baseUrl?: string
}

export class UpdaterChangelogProvider {
  private readonly cache = new Map<string, AppUpdaterChangelogBundle>()
  private readonly inFlight = new Map<string, Promise<AppUpdaterChangelogBundle>>()
  private readonly baseUrl: string

  constructor(
    private readonly networkService: NetworkService,
    options: UpdaterChangelogProviderOptions = {}
  ) {
    this.baseUrl = this.normalizeBaseUrl(options.baseUrl ?? DEFAULT_CHANGELOG_BASE_URL)
  }

  async get(version: string): Promise<AppUpdaterChangelogBundle> {
    const normalizedVersion = this.normalizeVersion(version)
    if (!normalizedVersion) {
      throw new Error('Invalid update version.')
    }

    return this.getBundle(normalizedVersion)
  }

  private normalizeVersion(version: string): string | null {
    const input = version.trim()
    if (!input) return null

    const withoutPrefix = input.replace(/^v/i, '')
    return isValidSemver(withoutPrefix)
  }

  private async getBundle(version: string): Promise<AppUpdaterChangelogBundle> {
    const cached = this.cache.get(version)
    if (cached) return cached

    const inFlight = this.inFlight.get(version)
    if (inFlight) return inFlight

    const request = this.fetchBundle(version)
      .then((bundle) => {
        this.cache.set(version, bundle)
        return bundle
      })
      .finally(() => {
        this.inFlight.delete(version)
      })

    this.inFlight.set(version, request)
    return request
  }

  private async fetchBundle(version: string): Promise<AppUpdaterChangelogBundle> {
    const entries = await Promise.all(
      APP_UPDATER_CHANGELOG_LOCALES.map(async (locale) => {
        return this.fetchByLocale(version, locale)
      })
    )

    const markdownByLocale: Record<AppUpdaterChangelogLocale, string | null> = {
      'zh-Hans': null,
      en: null,
      ja: null
    }

    let availableCount = 0
    for (const entry of entries) {
      markdownByLocale[entry.locale] = entry.markdown
      if (entry.markdown) {
        availableCount += 1
      }
    }

    if (availableCount === 0) {
      throw new Error(`No changelog files are available for v${version}.`)
    }

    return {
      version,
      markdownByLocale
    }
  }

  private async fetchByLocale(
    version: string,
    locale: AppUpdaterChangelogLocale
  ): Promise<{ locale: AppUpdaterChangelogLocale; markdown: string | null }> {
    const url = this.buildUrl(version, locale)

    try {
      const response = await this.networkService.request.fetch(url, {
        retries: 1,
        timeout: 10000
      })
      if (!response.ok) {
        log.warn('Missing changelog.', {
          version,
          locale,
          responseStatus: response.status,
          responseStatusText: response.statusText
        })
        return { locale, markdown: null }
      }

      const markdown = (await response.text()).trim()
      if (!markdown) {
        log.warn('Empty changelog.', { version, locale })
        return { locale, markdown: null }
      }

      return { locale, markdown }
    } catch (error) {
      log.warn('Failed to fetch changelog.', error, { version, locale })
      return { locale, markdown: null }
    }
  }

  private buildUrl(version: string, locale: AppUpdaterChangelogLocale): string {
    return `${this.baseUrl}/v${version}/${locale}.md`
  }

  private normalizeBaseUrl(baseUrl: string): string {
    return baseUrl.trim().replace(/\/+$/, '')
  }
}
