import type { IgdbClient } from '../api/client'
import type { IgdbSettingsV1 } from '../config/schema'

/** What every IGDB scraper provider is built on: the API and live settings. */
export interface IgdbRuntime {
  readonly client: IgdbClient
  getSettings(): Promise<IgdbSettingsV1>
}
