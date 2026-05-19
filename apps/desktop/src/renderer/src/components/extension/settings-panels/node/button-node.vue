<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import { PopoverTrigger } from '@renderer/components/ui/popover'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@renderer/components/ui/alert-dialog'
import type { ExtensionSettingsPanelSessionController, SettingsPanelSurfaceState } from '../session'
import type {
  ExtensionResolvedSettingsPanelButtonNode,
  ExtensionSettingsPanelSurface
} from '@shared/extension'

const props = defineProps<{
  node: ExtensionResolvedSettingsPanelButtonNode
  fieldId: string
  fieldDisabled?: boolean
  state: SettingsPanelSurfaceState<ExtensionSettingsPanelSurface>
  controller: ExtensionSettingsPanelSessionController
}>()

const variant = computed(() => {
  if (props.node.tone === 'danger') {
    return 'destructive'
  }

  return props.node.tone === 'primary' ? 'default' : 'outline'
})
const disabled = computed(
  () =>
    props.fieldDisabled ||
    props.node.disabled ||
    !props.node.callbackId ||
    props.controller.isCallbackBusy(props.node.callbackId)
)
const nodeKey = computed(() =>
  props.controller.getNodeKey(props.state, props.fieldId, props.node.id)
)
const anchoredPopover = computed(() => {
  if (props.state.surface === 'root') {
    return props.controller.activeRootPopover.value
  }

  if (props.state.surface === 'dialog') {
    return props.controller.activeDialogPopover.value
  }

  return null
})
const isPopoverTrigger = computed(() => anchoredPopover.value?.view.anchorNodeKey === nodeKey.value)

function invoke(): void {
  if (isPopoverTrigger.value) {
    return
  }

  void props.controller.invokeNode({
    surface: props.state,
    fieldId: props.fieldId,
    node: props.node
  })
}
</script>

<template>
  <AlertDialog v-if="props.node.confirm">
    <AlertDialogTrigger as-child>
      <Button
        type="button"
        :variant="variant"
        size="sm"
        :disabled="disabled"
      >
        <Icon
          v-if="props.node.icon"
          :icon="props.node.icon"
          class="size-4"
        />
        {{ props.node.label }}
      </Button>
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ props.node.confirm.title }}</AlertDialogTitle>
        <AlertDialogDescription v-if="props.node.confirm.description">
          {{ props.node.confirm.description }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>
          {{ props.node.confirm.cancelLabel ?? '取消' }}
        </AlertDialogCancel>
        <AlertDialogAction
          :disabled="disabled"
          @click="invoke"
        >
          {{ props.node.confirm.confirmLabel ?? props.node.label }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <PopoverTrigger
    v-else-if="isPopoverTrigger"
    as-child
  >
    <Button
      type="button"
      :variant="variant"
      size="sm"
      :disabled="disabled"
      @click="invoke"
    >
      <Icon
        v-if="props.node.icon"
        :icon="props.node.icon"
        class="size-4"
      />
      {{ props.node.label }}
    </Button>
  </PopoverTrigger>

  <Button
    v-else
    type="button"
    :variant="variant"
    size="sm"
    :disabled="disabled"
    @click="invoke"
  >
    <Icon
      v-if="props.node.icon"
      :icon="props.node.icon"
      class="size-4"
    />
    {{ props.node.label }}
  </Button>
</template>
