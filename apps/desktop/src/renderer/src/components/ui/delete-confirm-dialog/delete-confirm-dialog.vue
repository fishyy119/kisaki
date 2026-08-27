<!-- Delete Confirm Dialog component -->
<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel
} from '@renderer/components/ui/alert-dialog'
import { StateView } from '@renderer/components/ui/state-view'
import { useI18n } from '@renderer/composables/use-i18n'

interface Props {
  entityLabel: string
  entityName?: string
  /**
   * Mode of the dialog:
   * - 'delete': Permanent deletion from database (default)
   * - 'remove': Removal from form/list (not permanent)
   */
  mode?: 'delete' | 'remove'
  /**
   * Whether the dialog is loading data.
   * When true, shows a spinner instead of content.
   */
  loading?: boolean
  /** Extra line describing what the deletion will affect. */
  consequence?: string
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'delete',
  loading: false,
  consequence: undefined
})

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  confirm: []
}>()

const isDeleting = ref(false)

const { m } = useI18n()

// Computed text based on mode
const titleText = computed(() => {
  if (props.mode === 'remove') {
    return m.value.ui.deleteConfirm.removeTitle({ label: props.entityLabel })
  }
  return m.value.ui.deleteConfirm.deleteTitle({ label: props.entityLabel })
})

const descriptionText = computed(() => {
  if (props.mode === 'remove') {
    if (props.entityName) {
      return m.value.ui.deleteConfirm.removeNamedDescription({ name: props.entityName })
    }
    return m.value.ui.deleteConfirm.removeDescription({ label: props.entityLabel })
  }
  if (props.entityName) {
    return m.value.ui.deleteConfirm.deleteNamedDescription({
      name: props.entityName,
      label: props.entityLabel
    })
  }
  return m.value.ui.deleteConfirm.deleteDescription({ label: props.entityLabel })
})

const actionText = computed(() => {
  if (props.mode === 'remove') {
    return isDeleting.value ? m.value.ui.deleteConfirm.removing : m.value.common.remove
  }
  return isDeleting.value ? m.value.ui.deleteConfirm.deleting : m.value.common.delete
})

async function handleConfirm() {
  isDeleting.value = true
  try {
    emit('confirm')
    // Wait for next tick to ensure event handler completes before closing
    // This prevents v-if from destroying the component before @confirm is processed
    await nextTick()
    open.value = false
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <AlertDialog v-model:open="open">
    <AlertDialogContent>
      <!-- Loading state -->
      <StateView
        v-if="props.loading"
        state="loading"
        class="py-8"
      />

      <!-- Normal content -->
      <template v-else>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ titleText }}</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription>
          <div class="space-y-4">
            <p>{{ descriptionText }}</p>
            <p
              v-if="props.consequence"
              class="text-warning"
            >
              {{ props.consequence }}
            </p>
            <slot />
          </div>
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="isDeleting">{{ m.common.cancel }}</AlertDialogCancel>
          <AlertDialogAction
            :disabled="isDeleting"
            @click="handleConfirm"
          >
            {{ actionText }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </template>
    </AlertDialogContent>
  </AlertDialog>
</template>
