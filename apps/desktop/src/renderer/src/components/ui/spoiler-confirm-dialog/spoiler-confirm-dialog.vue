<!-- Spoiler Confirm Dialog component -->
<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
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
import { Spinner } from '@renderer/components/ui/spinner'
import { useI18n } from '@renderer/composables/use-i18n'

interface Props {
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
})

const { m } = useI18n()

const titleText = computed(() => props.title ?? m.value.ui.spoiler.title)
const descriptionText = computed(() => props.description ?? m.value.ui.spoiler.description)
const confirmTextDisplay = computed(() => props.confirmText ?? m.value.common.confirm)
const cancelTextDisplay = computed(() => props.cancelText ?? m.value.common.cancel)

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  confirm: []
}>()

const isConfirming = ref(false)

async function handleConfirm() {
  isConfirming.value = true
  try {
    emit('confirm')
    await nextTick()
    open.value = false
  } finally {
    isConfirming.value = false
  }
}
</script>

<template>
  <AlertDialog v-model:open="open">
    <AlertDialogContent>
      <div
        v-if="props.loading"
        class="flex items-center justify-center py-8"
      >
        <Spinner class="size-8" />
      </div>

      <template v-else>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ titleText }}</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription>
          <div class="space-y-4">
            <p>{{ descriptionText }}</p>
            <slot />
          </div>
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="isConfirming">{{ cancelTextDisplay }}</AlertDialogCancel>
          <AlertDialogAction
            :disabled="isConfirming"
            @click="handleConfirm"
          >
            {{ confirmTextDisplay }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </template>
    </AlertDialogContent>
  </AlertDialog>
</template>
