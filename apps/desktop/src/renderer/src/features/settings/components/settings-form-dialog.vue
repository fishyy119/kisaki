<!--
  SettingsDialog
  Application settings dialog.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { eq } from 'drizzle-orm'
import { ipcManager } from '@renderer/core/ipc'
import { db } from '@renderer/core/db'
import { notify } from '@renderer/core/notify'
import { useAsyncData, useRenderState } from '@renderer/composables'
import { useI18n } from '@renderer/composables/use-i18n'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { StateView } from '@renderer/components/ui/state-view'
import { Button } from '@renderer/components/ui/button'
import { Switch } from '@renderer/components/ui/switch'
import { Field, FieldContent, FieldGroup, FieldLabel } from '@renderer/components/ui/field'
import { Form } from '@renderer/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@renderer/components/ui/select'
import { UiLocaleSelect } from '@renderer/components/ui/locale-select'
import { useThemeStore } from '@renderer/stores'
import { settings, type MainWindowCloseAction } from '@shared/db'
import type { UiLocale } from '@shared/i18n'

const open = defineModel<boolean>('open', { required: true })

const { m, preference, setPreference } = useI18n()

const themeStore = useThemeStore()
const { themes, activeThemeId } = storeToRefs(themeStore)

const isSaving = ref(false)
type SettingsFormData = {
  autoLaunch: boolean
  activeThemeId: string
  uiLocalePreference: UiLocale | null
  mainWindowCloseAction: MainWindowCloseAction
  updaterAutoCheck: boolean
  updaterAllowPrerelease: boolean
}

const formData = ref<SettingsFormData>({
  autoLaunch: false,
  activeThemeId: activeThemeId.value,
  uiLocalePreference: preference.value,
  mainWindowCloseAction: 'exit',
  updaterAutoCheck: true,
  updaterAllowPrerelease: false
})

const openModel = computed({
  get: () => open.value,
  set: (v) => {
    if (!isSaving.value) open.value = v
  }
})

const { data, isLoading, error, refetch } = useAsyncData(
  async () => {
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

watch(open, (isOpen) => {
  if (!isOpen) return
  formData.value.activeThemeId = activeThemeId.value
  formData.value.uiLocalePreference = preference.value
})

watch(data, (d) => {
  if (!d) return
  formData.value.autoLaunch = d.autoLaunch
  formData.value.mainWindowCloseAction = d.mainWindowCloseAction
  formData.value.updaterAutoCheck = d.updaterAutoCheck
  formData.value.updaterAllowPrerelease = d.updaterAllowPrerelease
})

watch(
  () => formData.value.activeThemeId,
  (themeId) => {
    if (themeId === activeThemeId.value) return
    themeStore.setActiveTheme(themeId)
  }
)

// Language applies immediately, matching theme behavior.
watch(
  () => formData.value.uiLocalePreference,
  async (uiLocalePreference) => {
    if (uiLocalePreference === preference.value) return
    try {
      await setPreference(uiLocalePreference)
    } catch (e) {
      notify.error(m.value.feedback.saveFailed, e instanceof Error ? e.message : String(e))
    }
  }
)

async function handleSubmit() {
  isSaving.value = true
  try {
    const result = await ipcManager.invoke('native:set-auto-launch', formData.value.autoLaunch)
    if (!result.success) {
      throw new Error('Failed to update auto launch setting.')
    }

    await db
      .update(settings)
      .set({
        mainWindowCloseAction: formData.value.mainWindowCloseAction,
        updaterAutoCheck: formData.value.updaterAutoCheck,
        updaterAllowPrerelease: formData.value.updaterAllowPrerelease
      })
      .where(eq(settings.id, 0))
      .run()

    const updaterResult = await ipcManager.invoke('updater:reload-settings')
    if (!updaterResult.success) {
      throw new Error('Failed to reload updater settings.')
    }

    ipcManager.send('window:set-main-window-close-action', formData.value.mainWindowCloseAction)

    notify.success(m.value.feedback.saved)
    open.value = false
  } catch (e) {
    notify.error(m.value.feedback.saveFailed, e instanceof Error ? e.message : String(e))
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="openModel">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ m.settings.title }}</DialogTitle>
      </DialogHeader>

      <template v-if="state === 'loading'">
        <DialogBody>
          <StateView
            state="loading"
            class="py-8"
          />
        </DialogBody>
      </template>

      <template v-else-if="state === 'error'">
        <DialogBody class="space-y-3">
          <p class="text-sm text-destructive">
            {{ error }}
          </p>
          <div class="flex justify-end">
            <Button
              type="button"
              variant="outline"
              @click="refetch"
            >
              {{ m.actions.retry }}
            </Button>
          </div>
        </DialogBody>
      </template>

      <template v-else>
        <Form @submit="handleSubmit">
          <DialogBody>
            <FieldGroup>
              <Field orientation="horizontal">
                <FieldLabel>{{ m.settings.language.uiLanguageLabel }}</FieldLabel>
                <FieldContent>
                  <UiLocaleSelect
                    v-model="formData.uiLocalePreference"
                    trigger-class="w-56"
                  />
                </FieldContent>
              </Field>

              <Field orientation="horizontal">
                <FieldLabel>{{ m.settings.themeLabel }}</FieldLabel>
                <FieldContent>
                  <Select v-model="formData.activeThemeId">
                    <SelectTrigger class="w-56">
                      <span class="truncate">
                        {{
                          themes.find((t) => t.id === formData.activeThemeId)?.name ??
                          formData.activeThemeId
                        }}
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
                <FieldLabel>{{ m.settings.autoLaunchLabel }}</FieldLabel>
                <FieldContent>
                  <Switch v-model="formData.autoLaunch" />
                </FieldContent>
              </Field>

              <Field orientation="horizontal">
                <FieldLabel>{{ m.settings.closeActionLabel }}</FieldLabel>
                <FieldContent>
                  <Select v-model="formData.mainWindowCloseAction">
                    <SelectTrigger class="w-56">
                      <span class="truncate">
                        {{
                          formData.mainWindowCloseAction === 'exit'
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

              <Field orientation="horizontal">
                <FieldLabel>{{ m.settings.updaterAutoCheckLabel }}</FieldLabel>
                <FieldContent>
                  <Switch v-model="formData.updaterAutoCheck" />
                </FieldContent>
              </Field>

              <Field orientation="horizontal">
                <FieldLabel>{{ m.settings.updaterAllowPrereleaseLabel }}</FieldLabel>
                <FieldContent>
                  <Switch v-model="formData.updaterAllowPrerelease" />
                </FieldContent>
              </Field>
            </FieldGroup>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              :disabled="isSaving"
              @click="open = false"
            >
              {{ m.actions.cancel }}
            </Button>
            <Button
              type="submit"
              :disabled="isSaving"
            >
              {{ m.actions.save }}
            </Button>
          </DialogFooter>
        </Form>
      </template>
    </DialogContent>
  </Dialog>
</template>
