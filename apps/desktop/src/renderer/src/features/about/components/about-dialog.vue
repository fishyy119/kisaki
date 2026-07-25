<!--
  AboutDialog
  Displays app metadata using field layout and provides update entry from the version field.
-->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { notify } from '@renderer/core/notify'
import { useI18n } from '@renderer/composables/use-i18n'
import { ipcManager } from '@renderer/core/ipc'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { Field, FieldContent, FieldGroup, FieldLabel } from '@renderer/components/ui/field'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { UpdaterDialog } from '@renderer/features/updater'
import kisakiIcon from '@assets/icon-128.png'

const open = defineModel<boolean>('open', { required: true })

const { m } = useI18n()

const appVersion = ref('...')
const isUpdaterDialogOpen = ref(false)

onMounted(async () => {
  try {
    const result = await ipcManager.invoke('app:get-version')
    if (result.success) {
      appVersion.value = result.data
    } else {
      appVersion.value = 'unknown'
    }
  } catch (error) {
    appVersion.value = 'unknown'
    notify.error(
      m.value.app.about.readVersionFailed,
      error instanceof Error ? error.message : String(error)
    )
  }
})

function handleOpenUpdaterDialog() {
  isUpdaterDialogOpen.value = true
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>{{ m.app.about.title }}</DialogTitle>
      </DialogHeader>

      <DialogBody class="space-y-5">
        <img
          :src="kisakiIcon"
          class="mx-auto size-12 border shadow-raised rounded-md"
          alt="Kisaki"
        />

        <div
          class="rounded-md border border-border bg-muted/30 px-3 py-2 text-center text-xs text-muted-foreground"
        >
          <p>{{ m.app.about.tagline1 }}</p>
          <p>{{ m.app.about.tagline2 }}</p>
          <p>{{ m.app.about.tagline3 }}</p>
        </div>

        <FieldGroup>
          <Field orientation="horizontal">
            <FieldLabel>{{ m.app.about.authorLabel }}</FieldLabel>
            <FieldContent class="justify-self-start">
              <a
                href="https://github.com/ximu3/"
                target="_blank"
                class="text-sm text-blue-500 hover:underline"
              >
                {{ m.app.about.authorName }}
              </a>
            </FieldContent>
          </Field>

          <Field orientation="horizontal">
            <FieldLabel>{{ m.app.about.repoLabel }}</FieldLabel>
            <FieldContent class="justify-self-start">
              <a
                href="https://github.com/ximu3/kisaki/"
                target="_blank"
                class="text-sm text-blue-500 hover:underline"
              >
                {{ m.app.about.repoLink }}
              </a>
            </FieldContent>
          </Field>

          <Field orientation="horizontal">
            <FieldLabel>{{ m.app.about.feedbackLabel }}</FieldLabel>
            <FieldContent class="justify-self-start">
              <a
                href="https://github.com/ximu3/kisaki/issues"
                target="_blank"
                class="text-sm text-blue-500 hover:underline"
              >
                {{ m.app.about.feedbackLink }}
              </a>
            </FieldContent>
          </Field>

          <Field orientation="horizontal">
            <FieldLabel>{{ m.app.about.communityLabel }}</FieldLabel>
            <FieldContent class="justify-self-start">
              <a
                href="https://t.me/kisaki3"
                target="_blank"
                class="text-sm text-blue-500 hover:underline"
              >
                {{ m.app.about.telegramGroup }}
              </a>
            </FieldContent>
          </Field>

          <Field orientation="horizontal">
            <FieldLabel>{{ m.app.about.versionLabel }}</FieldLabel>
            <FieldContent class="flex-row items-center gap-1.5 justify-self-start">
              <span class="text-sm">v{{ appVersion }}</span>
              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                :title="m.app.about.checkUpdates"
                @click="handleOpenUpdaterDialog"
              >
                <Icon
                  icon="icon-[mdi--reload]"
                  class="size-3.5"
                />
              </Button>
            </FieldContent>
          </Field>
        </FieldGroup>
      </DialogBody>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          @click="open = false"
        >
          {{ m.common.close }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <UpdaterDialog
    v-if="isUpdaterDialogOpen"
    v-model:open="isUpdaterDialogOpen"
  />
</template>
