/**
 * Unit session machinery of a reader window shell: which unit is open, the
 * token-guarded open orchestration, readable-unit stepping, the navigation
 * list, and the window title. Both media shells run on this; what opening a
 * unit actually loads stays with each shell's engines.
 */

import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { ReaderBootstrap, ReaderUnit } from '@shared/reader'
import type { ReaderNavUnit } from '@renderer/components/reader/chrome/types'
import { createLogger } from '@renderer/core/log'
import { reportUnitOpened } from '@renderer/core/reader/bridge'

const log = createLogger('Reader')

export interface ReadingUnitCallbacks {
  /** Drops the previous unit's engine state; runs before anything loads. */
  reset: (unit: ReaderUnit) => void
  /** Loads the unit's content; `isCurrent` guards late async writes. */
  open: (unit: ReaderUnit, isCurrent: () => boolean) => Promise<void>
}

export interface ReadingUnits {
  currentUnitId: Ref<string>
  unit: ComputedRef<ReaderUnit | null>
  nextUnit: ComputedRef<ReaderUnit | null>
  previousUnit: ComputedRef<ReaderUnit | null>
  navUnits: ComputedRef<ReaderNavUnit[]>
  /** True while the open unit's content is loading. */
  opening: Ref<boolean>
  /** True when the open unit's content failed to load. */
  openError: Ref<boolean>
  openUnit: (unitId: string) => Promise<void>
  openNextUnit: () => void
  openPreviousUnit: () => void
}

export function useReadingUnits(
  bootstrap: () => ReaderBootstrap,
  callbacks: ReadingUnitCallbacks
): ReadingUnits {
  const currentUnitId = ref('')
  const opening = ref(false)
  const openError = ref(false)

  /** Invalidation token: a unit still resolving must not adopt the window. */
  let openToken = 0

  const units = computed(() => bootstrap().units)
  const unit = computed(() => units.value.find((entry) => entry.id === currentUnitId.value) ?? null)
  const unitIndex = computed(() =>
    units.value.findIndex((entry) => entry.id === currentUnitId.value)
  )
  const nextUnit = computed(() => findReadable(1))
  const previousUnit = computed(() => findReadable(-1))

  const navUnits = computed<ReaderNavUnit[]>(() =>
    units.value.map((entry) => ({
      id: entry.id,
      label: entry.label,
      read: entry.read,
      readable: Boolean(entry.fileId)
    }))
  )

  // A read request for an entry already open re-aims this window through a
  // new bootstrap; the reported unit keeps the reading session in step.
  watch(
    () => bootstrap(),
    (next) => {
      void openUnit(next.startUnitId)
    },
    { immediate: true }
  )

  function findReadable(step: number): ReaderUnit | null {
    for (
      let index = unitIndex.value + step;
      index >= 0 && index < units.value.length;
      index += step
    ) {
      const candidate = units.value[index]!
      if (candidate.fileId) return candidate
    }
    return null
  }

  async function openUnit(unitId: string): Promise<void> {
    const target = units.value.find((entry) => entry.id === unitId)
    if (!target) return

    const token = ++openToken
    const isCurrent = (): boolean => token === openToken

    currentUnitId.value = unitId
    openError.value = false
    callbacks.reset(target)
    reportUnitOpened(unitId)
    updateWindowTitle(target)

    if (!target.fileId) {
      opening.value = false
      return
    }

    opening.value = true
    try {
      await callbacks.open(target, isCurrent)
    } catch (error) {
      if (isCurrent()) {
        openError.value = true
        log.error('Failed to open the reading unit.', error)
      }
    } finally {
      if (isCurrent()) opening.value = false
    }
  }

  function openNextUnit(): void {
    if (nextUnit.value) void openUnit(nextUnit.value.id)
  }

  function openPreviousUnit(): void {
    if (previousUnit.value) void openUnit(previousUnit.value.id)
  }

  function updateWindowTitle(target: ReaderUnit): void {
    const { title } = bootstrap()
    document.title = target.label ? `${title} · ${target.label}` : title
  }

  return {
    currentUnitId,
    unit,
    nextUnit,
    previousUnit,
    navUnits,
    opening,
    openError,
    openUnit,
    openNextUnit,
    openPreviousUnit
  }
}
