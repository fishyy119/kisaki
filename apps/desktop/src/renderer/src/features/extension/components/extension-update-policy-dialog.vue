<!--
Extension Update Policy Dialog edits one installed extension update configuration.
Boundary: calls set-update-policy IPC and leaves catalog refresh to the parent.
-->
<script setup lang="ts">
import { ref, watch } from 'vue'
import { Button } from '@renderer/components/ui/button'
import { Spinner } from '@renderer/components/ui/spinner'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { Switch } from '@renderer/components/ui/switch'
import { Field, FieldContent, FieldGroup, FieldLabel } from '@renderer/components/ui/field'
import { notify } from '@renderer/core/notify'
import { ipcManager, unwrapIpcVoid } from '@renderer/core/ipc'
import type { ExtensionInstalledPackageInfo, ExtensionInstallUpdatePolicy } from '@shared/extension'

interface Props {
  extension: ExtensionInstalledPackageInfo
}

interface Emits {
  (e: 'updated'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const open = defineModel<boolean>('open', { required: true })
const saving = ref(false)
const updatePolicy = ref<ExtensionInstallUpdatePolicy>(currentPolicy())
const includePreviewUpdates = ref(currentIncludePreviewUpdates())

const POLICY_OPTIONS: {
  value: ExtensionInstallUpdatePolicy
  label: string
}[] = [
  { value: 'manual', label: '手动' },
  { value: 'auto', label: '自动' },
  { value: 'pinned', label: '锁定' }
]

watch(open, (value) => {
  if (value) {
    updatePolicy.value = currentPolicy()
    includePreviewUpdates.value = currentIncludePreviewUpdates()
  }
})

async function handleSave() {
  saving.value = true
  try {
    unwrapIpcVoid(
      await ipcManager.invoke('extension:set-update-policy', {
        extensionId: props.extension.id,
        updatePolicy: updatePolicy.value,
        pinnedVersion:
          updatePolicy.value === 'pinned'
            ? (props.extension.version ?? props.extension.pinnedVersion ?? null)
            : null,
        includePreviewUpdates: includePreviewUpdates.value
      })
    )
    notify.success('更新配置已保存')
    open.value = false
    emit('updated')
  } catch (error) {
    notify.error('保存更新配置失败', error instanceof Error ? error.message : String(error))
  } finally {
    saving.value = false
  }
}

function currentPolicy(): ExtensionInstallUpdatePolicy {
  return props.extension.updatePolicy ?? 'manual'
}

function currentIncludePreviewUpdates(): boolean {
  return props.extension.includePreviewUpdates ?? false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>更新配置</DialogTitle>
        <DialogDescription>{{ props.extension.name }}</DialogDescription>
      </DialogHeader>

      <DialogBody>
        <FieldGroup>
          <Field orientation="horizontal">
            <FieldLabel>更新策略</FieldLabel>
            <FieldContent>
              <Select v-model="updatePolicy">
                <SelectTrigger class="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="option in POLICY_OPTIONS"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FieldContent>
          </Field>

          <Field orientation="horizontal">
            <FieldLabel>接收预览版更新</FieldLabel>
            <FieldContent>
              <Switch v-model="includePreviewUpdates" />
            </FieldContent>
          </Field>
        </FieldGroup>
      </DialogBody>

      <DialogFooter>
        <Button
          variant="outline"
          :disabled="saving"
          @click="open = false"
        >
          取消
        </Button>
        <Button
          :disabled="saving"
          @click="handleSave"
        >
          <Spinner
            v-if="saving"
            class="size-4"
          />
          保存
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
