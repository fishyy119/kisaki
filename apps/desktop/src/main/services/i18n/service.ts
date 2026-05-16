import { createLogger } from '@main/log'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import { I18nLocaleManager } from './locale'

const log = createLogger('Locale')

export class I18nService implements IService {
  readonly id = 'i18n'
  readonly deps = ['db', 'event'] as const satisfies readonly ServiceName[]

  locale!: I18nLocaleManager

  async init(container: ServiceInitContainer<this>): Promise<void> {
    this.locale = new I18nLocaleManager(container.get('db'), container.get('event'))

    const initialLocale = await this.locale.init()

    log.info('Initialized.', { initialLocale: initialLocale })
  }

  async dispose(): Promise<void> {
    this.locale.dispose()
  }
}
