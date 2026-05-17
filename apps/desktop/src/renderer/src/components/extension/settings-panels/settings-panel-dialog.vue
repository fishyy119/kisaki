<script setup lang="ts">
import { computed, toRef } from 'vue'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Spinner } from '@renderer/components/ui/spinner'
import RootSurface from './surface/root-surface.vue'
import DialogSurface from './surface/dialog-surface.vue'
import { useExtensionSettingsPanelSession } from './session'
import type { ExtensionSettingsPanelRegistrationInfo } from '@shared/extension'

defineOptions({
  name: 'ExtensionSettingsPanelDialog'
})

const props = defineProps<{
  contribution: ExtensionSettingsPanelRegistrationInfo
  available?: boolean
  registrationRevision?: number
}>()

const open = defineModel<boolean>('open', { required: true })
const contributionRef = toRef(props, 'contribution')
const available = computed(() => props.available ?? true)
const registrationRevision = computed(() => props.registrationRevision ?? 0)
const session = useExtensionSettingsPanelSession(contributionRef, open, {
  available,
  registrationRevision
})
const root = computed(() => session.root.value)
const activeDialog = computed(() => session.activeDialog.value)
const sizeClass = computed(() => getSizeClass(root.value?.view.size))

const openModel = computed({
  get: () => open.value,
  set: (value: boolean) => {
    if (!value && (!session.busy.value || !session.session.value)) {
      open.value = false
    }
  }
})

function getSizeClass(size?: string): string {
  switch (size) {
    case 'sm':
      return 'max-w-md'
    case 'lg':
      return 'max-w-2xl'
    case 'xl':
      return 'max-w-4xl'
    case 'md':
    default:
      return 'max-w-xl'
  }
}
</script>

<template>
  <Dialog v-model:open="openModel">
    <DialogContent
      class="max-h-[84vh] flex flex-col"
      :class="sizeClass"
    >
      <DialogHeader>
        <DialogTitle>{{ root?.view.title ?? props.contribution.title }}</DialogTitle>
      </DialogHeader>

      <DialogBody
        v-if="session.opening.value && !root"
        class="flex items-center justify-center py-10"
      >
        <Spinner class="size-7" />
      </DialogBody>

      <template v-else-if="session.error.value">
        <DialogBody class="space-y-3">
          <p class="text-sm text-destructive">{{ session.error.value }}</p>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            @click="open = false"
          >
            关闭
          </Button>
          <Button
            type="button"
            @click="session.retry"
          >
            重试
          </Button>
        </DialogFooter>
      </template>

      <RootSurface
        v-else-if="root"
        :state="root"
        :controller="session"
      />
    </DialogContent>
  </Dialog>

  <DialogSurface
    v-if="activeDialog"
    :state="activeDialog"
    :controller="session"
  />
</template>
