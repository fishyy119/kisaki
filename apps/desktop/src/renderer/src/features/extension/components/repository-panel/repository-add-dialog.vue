<!--
Repository Add Dialog collects repository manifest metadata.
Boundary: owns transient form state and emits a submit request to the parent panel.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Spinner } from '@renderer/components/ui/spinner'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import type { RepositoryAddRequest } from './types'

interface Props {
  submitting: boolean
}

interface Emits {
  (e: 'submit', request: RepositoryAddRequest): void
}

interface FormData {
  url: string
  name: string
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const open = defineModel<boolean>('open', { required: true })

const formData = ref<FormData>({
  url: '',
  name: ''
})

const canSubmit = computed(() => formData.value.url.trim().length > 0 && !props.submitting)

watch(open, (value) => {
  if (!value) {
    resetForm()
  }
})

function handleSubmit() {
  const url = formData.value.url.trim()
  if (!url || props.submitting) {
    return
  }

  const name = formData.value.name.trim()
  emit('submit', {
    url,
    name: name || undefined
  })
}

function resetForm() {
  formData.value = { url: '', name: '' }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>添加扩展仓库</DialogTitle>
      </DialogHeader>
      <DialogBody class="space-y-3">
        <div class="space-y-1.5">
          <label class="text-xs text-muted-foreground">仓库清单 URL</label>
          <Input
            v-model="formData.url"
            placeholder="https://example.com/extensions/manifest.json"
            @keydown.enter="handleSubmit"
          />
        </div>
        <div class="space-y-1.5">
          <label class="text-xs text-muted-foreground">显示名称</label>
          <Input
            v-model="formData.name"
            placeholder="留空使用仓库清单名称"
            @keydown.enter="handleSubmit"
          />
        </div>
      </DialogBody>
      <DialogFooter>
        <Button
          variant="outline"
          :disabled="props.submitting"
          @click="open = false"
        >
          取消
        </Button>
        <Button
          :disabled="!canSubmit"
          @click="handleSubmit"
        >
          <Spinner
            v-if="props.submitting"
            class="size-4"
          />
          添加
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
