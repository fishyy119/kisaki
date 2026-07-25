/**
 * Renderer i18n controller.
 *
 * Mirrors the UI locale state owned by the main process: fetches the effective
 * locale during bootstrap, follows cross-process locale-change events, and
 * exposes reactive message catalogs and Intl formatters.
 */

import { computed, shallowRef, type ComputedRef, type ShallowRef } from 'vue'
import {
  createFormatters,
  getMessages,
  FALLBACK_UI_LOCALE,
  type I18nFormatters,
  type Messages,
  type UiLocale,
  type UiLocaleState
} from '@shared/i18n'
import { ipcManager, unwrapIpcData, unwrapIpcVoid } from '@renderer/core/ipc'
import { eventManager } from '@renderer/core/event'
import { createLogger } from '@renderer/core/log'

const log = createLogger('I18n')

const localeRef = shallowRef<UiLocale>(FALLBACK_UI_LOCALE)
const preferenceRef = shallowRef<UiLocale | null>(null)

/** Effective UI locale (reactive, read-only). */
export const uiLocale: Readonly<ShallowRef<UiLocale>> = localeRef

/** Persisted preference; null means follow the system language (reactive, read-only). */
export const uiLocalePreference: Readonly<ShallowRef<UiLocale | null>> = preferenceRef

/** Message catalog for the effective locale (reactive). */
export const messages: ComputedRef<Messages> = computed(() => getMessages(localeRef.value))

/** Intl formatters for the effective locale (reactive). */
export const formatters: ComputedRef<I18nFormatters> = computed(() =>
  createFormatters(localeRef.value)
)

/**
 * Fetch the UI locale state from the main process and subscribe to changes.
 * Must complete before the app mounts so first paint renders in the right language.
 */
export async function initI18n(): Promise<void> {
  const state = unwrapIpcData(await ipcManager.invoke('i18n:get-state'))
  applyState(state)

  eventManager.on('app.ui-locale.changed', (state) => {
    applyState(state)
    log.info('UI locale changed.', { effective: state.effective })
  })
}

/** Ask the main process to persist a new UI language preference (null = follow system). */
export async function setUiLocalePreference(preference: UiLocale | null): Promise<void> {
  unwrapIpcVoid(await ipcManager.invoke('i18n:set-preference', preference))
}

function applyState(state: UiLocaleState): void {
  preferenceRef.value = state.preference
  localeRef.value = state.effective
  document.documentElement.lang = state.effective
}
