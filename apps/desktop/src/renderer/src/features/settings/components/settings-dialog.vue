<!--
  SettingsDialog
  Application preferences: independent switches, each valid on its own, so
  every control applies and persists the moment it changes (no draft, no save,
  no cancel). A failed write reverts the control and reports the failure.
  Three titled groups on one surface make this the multi-section settings
  recipe (SettingsSection with the rows surface).
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { eq } from 'drizzle-orm'
import { ipcManager, unwrapIpcVoid } from '@renderer/core/ipc'
import { db } from '@renderer/core/db'
import { notify } from '@renderer/core/notify'
import { setInterfaceScale, uiScale } from '@renderer/core/interface-scale'
import { useLiveQuery, useRenderState } from '@renderer/composables'
import { useI18n } from '@renderer/composables/use-i18n'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody
} from '@renderer/components/ui/dialog'
import { StateView } from '@renderer/components/ui/state-view'
import { Button } from '@renderer/components/ui/button'
import { Switch } from '@renderer/components/ui/switch'
import { Field, FieldContent, FieldGroup, FieldLabel } from '@renderer/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@renderer/components/ui/select'
import { SettingsSection } from '@renderer/components/ui/settings-section'
import { UiLocaleSelect } from '@renderer/components/ui/locale-select'
import { useThemeStore, type ThemeMode } from '@renderer/stores'
import { settings, type MainWindowCloseAction } from '@shared/db'
import type { UiLocale } from '@shared/i18n'
import { parseUiScale, UI_SCALE_VALUES } from '@shared/window'

const open = defineModel<boolean>('open', { required: true })

const { m, preference, setPreference } = useI18n()

const themeStore = useThemeStore()
const { themes, activeThemeId, mode } = storeToRefs(themeStore)

const THEME_MODES: readonly ThemeMode[] = ['light', 'dark', 'system']

const themeModeLabels = computed<Record<ThemeMode, string>>(() => ({
  light: m.value.nav.themeLight,
  dark: m.value.nav.themeDark,
  system: m.value.nav.themeSystem
}))

// =============================================================================
// Main-owned settings row (close action, updater) and the OS auto-launch flag
// =============================================================================

interface RowState {
  autoLaunch: boolean
  mainWindowCloseAction: MainWindowCloseAction
  updaterAutoCheck: boolean
  updaterAllowPrerelease: boolean
}

const { data, isLoading, error, reload } = useLiveQuery(
  async (): Promise<RowState> => {
    const [autoLaunchResult, currentSettings] = await Promise.all([
      ipcManager.invoke('native:get-auto-launch'),
      db.query.settings.findFirst()
    ])

    if (!autoLaunchResult.success) {
      throw new Error('Failed to read auto launch setting.')
    }

    if (!currentSettings) {
      throw new Error('Settings not found')
    }

    return {
      autoLaunch: autoLaunchResult.data,
      mainWindowCloseAction: currentSettings.mainWindowCloseAction,
      updaterAutoCheck: currentSettings.updaterAutoCheck,
      updaterAllowPrerelease: currentSettings.updaterAllowPrerelease
    }
  },
  { enabled: open }
)
const state = useRenderState(isLoading, error, data)

// Control values mirror their sources; a write that fails puts the source
// value back so the control never shows a state that did not stick.
const row = ref<RowState>({
  autoLaunch: false,
  mainWindowCloseAction: 'exit',
  updaterAutoCheck: true,
  updaterAllowPrerelease: false
})

watch(data, (loaded) => {
  if (loaded) row.value = { ...loaded }
})

function reportWriteFailure(e: unknown): void {
  notify.error(m.value.feedback.saveFailed, e instanceof Error ? e.message : String(e))
}

async function applyRow<K extends keyof RowState>(
  key: K,
  value: RowState[K],
  write: (value: RowState[K]) => Promise<void>
): Promise<void> {
  const previous = row.value[key]
  if (previous === value) return
  row.value[key] = value
  try {
    await write(value)
  } catch (e) {
    row.value[key] = previous
    reportWriteFailure(e)
  }
}

async function writeSettingsRow(patch: Partial<RowState>): Promise<void> {
  await db.update(settings).set(patch).where(eq(settings.id, 0)).run()
}

const autoLaunchModel = computed({
  get: () => row.value.autoLaunch,
  set: (value: boolean) =>
    applyRow('autoLaunch', value, async (next) => {
      unwrapIpcVoid(await ipcManager.invoke('native:set-auto-launch', next))
    })
})

const closeActionModel = computed({
  get: () => row.value.mainWindowCloseAction,
  set: (value: MainWindowCloseAction) =>
    applyRow('mainWindowCloseAction', value, async (next) => {
      await writeSettingsRow({ mainWindowCloseAction: next })
      ipcManager.send('window:set-main-window-close-action', next)
    })
})

const updaterAutoCheckModel = computed({
  get: () => row.value.updaterAutoCheck,
  set: (value: boolean) =>
    applyRow('updaterAutoCheck', value, async (next) => {
      await writeSettingsRow({ updaterAutoCheck: next })
      unwrapIpcVoid(await ipcManager.invoke('updater:reload-settings'))
    })
})

const updaterAllowPrereleaseModel = computed({
  get: () => row.value.updaterAllowPrerelease,
  set: (value: boolean) =>
    applyRow('updaterAllowPrerelease', value, async (next) => {
      await writeSettingsRow({ updaterAllowPrerelease: next })
      unwrapIpcVoid(await ipcManager.invoke('updater:reload-settings'))
    })
})

// =============================================================================
// Appearance and language: stores and main-owned preferences, already live
// =============================================================================

const themeModel = computed({
  get: () => activeThemeId.value,
  set: (themeId: string) => themeStore.setActiveTheme(themeId)
})

const themeModeModel = computed({
  get: () => mode.value,
  set: (value: ThemeMode) => themeStore.setMode(value)
})

// The select speaks strings; only scale steps get through. The value shown is
// the applied scale the main process pushed back, never a pending draft.
const uiScaleModel = computed({
  get: () => String(uiScale.value),
  set: (value: string) => {
    void setInterfaceScale(parseUiScale(Number(value))).catch(reportWriteFailure)
  }
})

const uiLocaleModel = computed({
  get: () => preference.value,
  set: (value: UiLocale | null) => {
    if (value === preference.value) return
    void setPreference(value).catch(reportWriteFailure)
  }
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent size="md">
      <DialogHeader>
        <DialogTitle>{{ m.settings.title }}</DialogTitle>
      </DialogHeader>

      <DialogBody v-if="state === 'loading'">
        <StateView
          state="loading"
          class="py-8"
        />
      </DialogBody>

      <DialogBody
        v-else-if="state === 'error'"
        class="space-y-3"
      >
        <p class="text-sm text-destructive wrap-break-word">
          {{ error }}
        </p>
        <div class="flex justify-end">
          <Button
            type="button"
            variant="outline"
            @click="reload"
          >
            {{ m.actions.retry }}
          </Button>
        </div>
      </DialogBody>

      <DialogBody
        v-else
        class="space-y-5 py-4"
      >
        <SettingsSection
          :title="m.settings.sections.appearance"
          surface="rows"
        >
          <FieldGroup>
            <Field orientation="horizontal">
              <FieldLabel>{{ m.settings.themeLabel }}</FieldLabel>
              <FieldContent>
                <Select v-model="themeModel">
                  <SelectTrigger class="w-48">
                    <span class="truncate">
                      {{ themes.find((t) => t.id === themeModel)?.name ?? themeModel }}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="t in themes"
                      :key="t.id"
                      :value="t.id"
                    >
                      {{ t.name }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>

            <Field orientation="horizontal">
              <FieldLabel>{{ m.settings.themeModeLabel }}</FieldLabel>
              <FieldContent>
                <Select v-model="themeModeModel">
                  <SelectTrigger class="w-48">
                    <span class="truncate">{{ themeModeLabels[themeModeModel] }}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="themeMode in THEME_MODES"
                      :key="themeMode"
                      :value="themeMode"
                    >
                      {{ themeModeLabels[themeMode] }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>

            <Field orientation="horizontal">
              <FieldLabel>{{ m.settings.interfaceScaleLabel }}</FieldLabel>
              <FieldContent>
                <Select v-model="uiScaleModel">
                  <SelectTrigger class="w-48">
                    <span class="truncate">
                      {{ m.settings.interfaceScaleValue({ scale: uiScale }) }}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="scale in UI_SCALE_VALUES"
                      :key="scale"
                      :value="String(scale)"
                    >
                      {{ m.settings.interfaceScaleValue({ scale }) }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>

            <Field orientation="horizontal">
              <FieldLabel>{{ m.settings.language.uiLanguageLabel }}</FieldLabel>
              <FieldContent>
                <UiLocaleSelect
                  v-model="uiLocaleModel"
                  trigger-class="w-48"
                />
              </FieldContent>
            </Field>
          </FieldGroup>
        </SettingsSection>

        <SettingsSection
          :title="m.settings.sections.window"
          surface="rows"
        >
          <FieldGroup>
            <Field orientation="horizontal">
              <FieldLabel>{{ m.settings.autoLaunchLabel }}</FieldLabel>
              <FieldContent>
                <Switch v-model="autoLaunchModel" />
              </FieldContent>
            </Field>

            <Field orientation="horizontal">
              <FieldLabel>{{ m.settings.closeActionLabel }}</FieldLabel>
              <FieldContent>
                <Select v-model="closeActionModel">
                  <SelectTrigger class="w-48">
                    <span class="truncate">
                      {{
                        closeActionModel === 'exit'
                          ? m.settings.closeActionExit
                          : m.settings.closeActionTray
                      }}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exit">{{ m.settings.closeActionExit }}</SelectItem>
                    <SelectItem value="tray">{{ m.settings.closeActionTray }}</SelectItem>
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>
          </FieldGroup>
        </SettingsSection>

        <SettingsSection
          :title="m.settings.sections.updates"
          surface="rows"
        >
          <FieldGroup>
            <Field orientation="horizontal">
              <FieldLabel>{{ m.settings.updaterAutoCheckLabel }}</FieldLabel>
              <FieldContent>
                <Switch v-model="updaterAutoCheckModel" />
              </FieldContent>
            </Field>

            <Field orientation="horizontal">
              <FieldLabel>{{ m.settings.updaterAllowPrereleaseLabel }}</FieldLabel>
              <FieldContent>
                <Switch v-model="updaterAllowPrereleaseModel" />
              </FieldContent>
            </Field>
          </FieldGroup>
        </SettingsSection>
      </DialogBody>
    </DialogContent>
  </Dialog>
</template>
