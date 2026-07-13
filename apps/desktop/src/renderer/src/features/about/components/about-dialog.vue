<!--
  AboutDialog
  Displays app metadata using field layout and provides update entry from the version field.
-->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { notify } from '@renderer/core/notify'
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
    notify.error('读取版本失败', error instanceof Error ? error.message : String(error))
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
        <DialogTitle>关于 Kisaki</DialogTitle>
      </DialogHeader>

      <DialogBody class="space-y-5">
        <img
          :src="kisakiIcon"
          class="mx-auto size-12 border shadow-raised rounded-md"
          alt="Kisaki Icon"
        />

        <div
          class="rounded-md border border-border bg-muted/30 px-3 py-2 text-center text-xs text-muted-foreground"
        >
          <p>Kisaki 是一个多功能的媒体管理项目</p>
          <p>旨在提供一个统一的用户界面和数据库模型</p>
          <p>来记录、管理、构建、同步、展示您的媒体馆藏与回忆</p>
        </div>

        <FieldGroup>
          <Field orientation="horizontal">
            <FieldLabel>作者</FieldLabel>
            <FieldContent class="justify-self-start">
              <a
                href="https://github.com/ximu3/"
                target="_blank"
                class="text-sm text-blue-500 hover:underline"
              >
                ximu
              </a>
            </FieldContent>
          </Field>

          <Field orientation="horizontal">
            <FieldLabel>仓库</FieldLabel>
            <FieldContent class="justify-self-start">
              <a
                href="https://github.com/ximu3/kisaki/"
                target="_blank"
                class="text-sm text-blue-500 hover:underline"
              >
                Github Repository
              </a>
            </FieldContent>
          </Field>

          <Field orientation="horizontal">
            <FieldLabel>反馈</FieldLabel>
            <FieldContent class="justify-self-start">
              <a
                href="https://github.com/ximu3/kisaki/issues"
                target="_blank"
                class="text-sm text-blue-500 hover:underline"
              >
                Github Issues
              </a>
            </FieldContent>
          </Field>

          <Field orientation="horizontal">
            <FieldLabel>群组</FieldLabel>
            <FieldContent class="justify-self-start">
              <a
                href="https://t.me/kisaki3"
                target="_blank"
                class="text-sm text-blue-500 hover:underline"
              >
                Telegram 群组
              </a>
            </FieldContent>
          </Field>

          <Field orientation="horizontal">
            <FieldLabel>版本</FieldLabel>
            <FieldContent class="flex-row items-center gap-1.5 justify-self-start">
              <span class="text-sm">v{{ appVersion }}</span>
              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                title="检查更新"
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
          关闭
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <UpdaterDialog
    v-if="isUpdaterDialogOpen"
    v-model:open="isUpdaterDialogOpen"
  />
</template>
