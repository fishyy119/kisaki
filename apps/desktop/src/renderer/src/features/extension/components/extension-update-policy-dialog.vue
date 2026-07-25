<!--
Extension Update Policy Dialog edits one installed extension update configuration.
Boundary: calls set-update-policy IPC and leaves catalog refresh to the parent.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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
import { resolveExtensionText } from '@renderer/core/extensions'
import { ipcManager, unwrapIpcVoid } from '@renderer/core/ipc'
import { useI18n } from '@renderer/composables/use-i18n'
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
const { m } = useI18n()
const saving = ref(false)
const updatePolicy = ref<ExtensionInstallUpdatePolicy>(currentPolicy())
const includePreviewUpdates = ref(currentIncludePreviewUpdates())

const POLICY_OPTIONS = computed<
  {
    value: ExtensionInstallUpdatePolicy
    label: string
  }[]
>(() => [
  { value: 'manual', label: m.value.extension.policy.manual },
  { value: 'auto', label: m.value.extension.policy.auto },
  { value: 'pinned', label: m.value.extension.policy.pinned }
])

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
    notify.success(m.value.extension.updatePolicyDialog.saved)
    open.value = false
    emit('updated')
  } catch (error) {
    notify.error(
      m.value.extension.updatePolicyDialog.saveFailed,
      error instanceof Error ? error.message : String(error)
    )
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
        <DialogTitle>{{ m.extension.updatePolicyDialog.title }}</DialogTitle>
        <DialogDescription>{{ resolveExtensionText(props.extension.name) }}</DialogDescription>
      </DialogHeader>

      <DialogBody>
        <FieldGroup>
          <Field orientation="horizontal">
            <FieldLabel>{{ m.extension.updatePolicyDialog.policyLabel }}</FieldLabel>
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
            <FieldLabel>{{ m.extension.updatePolicyDialog.receivePrerelease }}</FieldLabel>
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
          {{ m.common.cancel }}
        </Button>
        <Button
          :disabled="saving"
          @click="handleSave"
        >
          <Spinner
            v-if="saving"
            class="size-4"
          />
          {{ m.common.save }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
