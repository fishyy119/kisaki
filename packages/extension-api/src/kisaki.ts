import type { EventsCapability } from './capabilities/events'
import type { LibraryCapability } from './capabilities/library'
import type { NetworkCapability } from './capabilities/network'
import type { NotifyCapability } from './capabilities/notify'
import type { RuntimeCapability } from './capabilities/runtime'

export interface KisakiApi {
  readonly library: LibraryCapability
  readonly network: NetworkCapability
  readonly notify: NotifyCapability
  readonly events: EventsCapability
  readonly runtime: RuntimeCapability
}
