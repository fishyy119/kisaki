<!-- Dialog wrapper for Bangumi preview output. -->
<script setup lang="ts">
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@kisaki3/extension-ui-vue'
import type { BangumiPreviewGroupDto } from '../../../shared/settings'
import JobPreviewGroups from './job-preview-groups.vue'

interface Props {
  title: string
  description?: string
  groups: readonly BangumiPreviewGroupDto[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  error: [message: string]
}>()
const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-3xl">
      <DialogHeader>
        <DialogTitle>{{ props.title }}</DialogTitle>
        <DialogDescription v-if="props.description">
          {{ props.description }}
        </DialogDescription>
      </DialogHeader>
      <DialogBody class="max-h-[62vh] overflow-y-auto">
        <JobPreviewGroups
          :groups="props.groups"
          @error="(message) => emit('error', message)"
        />
      </DialogBody>
      <DialogFooter>
        <Button
          variant="outline"
          size="sm"
          type="button"
          @click="open = false"
        >
          关闭
        </Button>
        <slot name="footer" />
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
