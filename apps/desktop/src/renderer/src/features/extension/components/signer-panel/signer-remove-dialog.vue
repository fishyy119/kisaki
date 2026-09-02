<!--
Signer Remove Dialog confirms revoking one trusted signer.
Boundary: no IPC; emits confirmation to the parent panel.
-->
<script setup lang="ts">
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@renderer/components/ui/alert-dialog'
import { useI18n } from '@renderer/composables/use-i18n'
import type { ExtensionTrustedSignerInfo } from '@shared/extension'

interface Props {
  signer: ExtensionTrustedSignerInfo
  removing: boolean
}

interface Emits {
  (e: 'confirm'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const open = defineModel<boolean>('open', { required: true })

const { m } = useI18n()
</script>

<template>
  <AlertDialog v-model:open="open">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ m.extension.signer.removeDialog.title }}</AlertDialogTitle>
      </AlertDialogHeader>

      <AlertDialogDescription>
        {{ m.extension.signer.removeDialog.description({ id: props.signer.extensionId }) }}
      </AlertDialogDescription>

      <AlertDialogFooter>
        <AlertDialogCancel :disabled="props.removing">{{ m.actions.cancel }}</AlertDialogCancel>
        <AlertDialogAction
          :disabled="props.removing"
          @click.prevent="emit('confirm')"
        >
          {{
            props.removing
              ? m.extension.signer.removeDialog.revoking
              : m.extension.signer.removeDialog.revoke
          }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
