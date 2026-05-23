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
</script>

<template>
  <AlertDialog v-model:open="open">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>撤销签名信任？</AlertDialogTitle>
      </AlertDialogHeader>

      <AlertDialogDescription>
        确定要撤销「{{ props.signer.extensionId }}」的签名信任吗？新版本使用该指纹时将需要重新确认。
      </AlertDialogDescription>

      <AlertDialogFooter>
        <AlertDialogCancel :disabled="props.removing">取消</AlertDialogCancel>
        <AlertDialogAction
          :disabled="props.removing"
          @click.prevent="emit('confirm')"
        >
          {{ props.removing ? '撤销中' : '撤销' }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
