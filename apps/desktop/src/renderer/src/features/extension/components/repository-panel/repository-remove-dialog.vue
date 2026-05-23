<!--
Repository Remove Dialog confirms deleting one extension repository.
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
import type { ExtensionRepositoryInfo } from '@shared/extension'

interface Props {
  repository: ExtensionRepositoryInfo
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
        <AlertDialogTitle>删除 {{ props.repository.name }}？</AlertDialogTitle>
      </AlertDialogHeader>

      <AlertDialogDescription>
        确定要删除该仓库吗？删除后将不再从该仓库获取扩展目录，已安装的扩展不会被卸载。
      </AlertDialogDescription>

      <AlertDialogFooter>
        <AlertDialogCancel :disabled="props.removing">取消</AlertDialogCancel>
        <AlertDialogAction
          :disabled="props.removing"
          @click.prevent="emit('confirm')"
        >
          {{ props.removing ? '删除中' : '删除' }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
