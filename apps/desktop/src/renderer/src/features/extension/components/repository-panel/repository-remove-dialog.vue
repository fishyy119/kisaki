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
import { useI18n } from '@renderer/composables/use-i18n'
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

const { m } = useI18n()
</script>

<template>
  <AlertDialog v-model:open="open">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>
          {{ m.extension.repository.removeDialog.title({ name: props.repository.name }) }}
        </AlertDialogTitle>
      </AlertDialogHeader>

      <AlertDialogDescription>
        {{ m.extension.repository.removeDialog.description }}
      </AlertDialogDescription>

      <AlertDialogFooter>
        <AlertDialogCancel :disabled="props.removing">{{ m.common.cancel }}</AlertDialogCancel>
        <AlertDialogAction
          :disabled="props.removing"
          @click.prevent="emit('confirm')"
        >
          {{ props.removing ? m.extension.repository.removeDialog.deleting : m.common.delete }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
