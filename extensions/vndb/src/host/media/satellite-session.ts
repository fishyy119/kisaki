/**
 * Session shape shared by the satellite providers.
 *
 * A character, staff member, or producer is one entry read, and every slot is
 * a projection of it, so the read is memoized once per session and each slot
 * picks its field. The `images` slot name differs per media type (`photos` vs
 * `logos`), so the caller names it.
 */

import type { ScraperSessionResult } from '@kisaki3/extension-sdk'
import type { VndbSatelliteFacts } from './satellites'

export interface SatelliteSessionOptions<TSlot extends string, TInfo> {
  loadFacts(): Promise<VndbSatelliteFacts<TInfo>>
  /** Slot carrying this media type's image collection. */
  imageSlot: TSlot
}

export interface SatelliteSession<TSlot extends string, TResultMap extends object> {
  get(slots: readonly TSlot[]): Promise<ScraperSessionResult<TResultMap>>
}

export function createSatelliteSession<TSlot extends string, TInfo, TResultMap extends object>(
  options: SatelliteSessionOptions<TSlot, TInfo>
): SatelliteSession<TSlot, TResultMap> {
  let task: Promise<VndbSatelliteFacts<TInfo>> | undefined
  const loadFacts = (): Promise<VndbSatelliteFacts<TInfo>> => (task ??= options.loadFacts())

  return {
    get: async (slots) => {
      const facts = await loadFacts()
      const output: Record<string, unknown> = {}

      for (const slot of slots) {
        const payload = readSlot(slot, facts, options.imageSlot)
        if (payload !== undefined) {
          output[slot] = payload
        }
      }

      return {
        identity: facts.identity,
        slots: output as ScraperSessionResult<TResultMap>['slots']
      }
    }
  }
}

/**
 * Slots this source cannot answer are omitted, so the host keeps whatever
 * another provider supplied instead of clearing it.
 */
function readSlot<TSlot extends string, TInfo>(
  slot: TSlot,
  facts: VndbSatelliteFacts<TInfo>,
  imageSlot: TSlot
): unknown {
  if (slot === imageSlot) {
    return facts.images
  }

  switch (slot) {
    case 'info':
      return facts.info
    case 'tags':
      return facts.tags
    default:
      return undefined
  }
}
