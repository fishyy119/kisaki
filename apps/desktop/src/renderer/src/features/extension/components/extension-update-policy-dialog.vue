<!--
Extension Update Policy Dialog edits one installed extension update policy.
Boundary: calls set-update-policy IPC and leaves catalog refresh to the parent.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
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

const POLICY_OPTIONS: {
  value: ExtensionInstallUpdatePolicy
  label: string
  description: string
}[] = [
  { value: 'manual', label: '手动', description: '仅在确认后更新' },
  { value: 'notify', label: '通知', description: '检查更新时提醒' },
  { value: 'auto', label: '自动', description: '使用已信任签名更新' },
  { value: 'pinned', label: '固定', description: '停留在当前版本' }
]

const selectedPolicy = computed(
  () => POLICY_OPTIONS.find((option) => option.value === updatePolicy.value) ?? POLICY_OPTIONS[0]
)
const pinnedVersion = computed(() => props.extension.pinnedVersion ?? props.extension.version)
const channelLabel = computed(() => props.extension.channel ?? 'stable')

watch(open, (value) => {
  if (value) {
    updatePolicy.value = currentPolicy()
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
            : null
      })
    )
    notify.success('更新策略已保存')
    open.value = false
    emit('updated')
  } catch (error) {
    notify.error('保存更新策略失败', error instanceof Error ? error.message : String(error))
  } finally {
    saving.value = false
  }
}

function currentPolicy(): ExtensionInstallUpdatePolicy {
  return props.extension.updatePolicy ?? 'manual'
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>更新策略</DialogTitle>
        <DialogDescription>{{ props.extension.name }} · {{ channelLabel }}</DialogDescription>
      </DialogHeader>

      <DialogBody>
        <div class="space-y-3">
          <label class="space-y-1.5 text-sm">
            <span class="text-xs font-medium text-muted-foreground">策略</span>
            <Select v-model="updatePolicy">
              <SelectTrigger class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="option in POLICY_OPTIONS"
                  :key="option.value"
                  :value="option.value"
                >
                  <div class="flex flex-col">
                    <span>{{ option.label }}</span>
                    <span class="text-xs text-muted-foreground">{{ option.description }}</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </label>

          <div class="rounded-md border border-border p-3 text-xs text-muted-foreground space-y-2">
            <div class="flex items-center gap-2">
              <Icon
                icon="icon-[mdi--source-branch]"
                class="size-4"
              />
              <span>频道：{{ channelLabel }}</span>
            </div>
            <div class="flex items-center gap-2">
              <Icon
                icon="icon-[mdi--update]"
                class="size-4"
              />
              <span>当前：{{ selectedPolicy.label }}</span>
            </div>
            <div
              v-if="updatePolicy === 'pinned' && pinnedVersion"
              class="flex items-center gap-2"
            >
              <Icon
                icon="icon-[mdi--pin-outline]"
                class="size-4"
              />
              <span>固定：v{{ pinnedVersion }}</span>
            </div>
          </div>
        </div>
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
