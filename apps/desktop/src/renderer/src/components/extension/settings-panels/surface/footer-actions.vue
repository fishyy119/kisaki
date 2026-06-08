<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
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
import type { ButtonVariants } from '@renderer/components/ui/button'
import type {
  ExtensionResolvedSettingsPanelButtonNode,
  ExtensionResolvedSettingsPanelFooterAction
} from '@shared/extension'
import type { ExtensionSettingsPanelSessionController, SettingsPanelSurfaceState } from '../session'

defineOptions({
  name: 'ExtensionSettingsPanelFooterActions'
})

const FOOTER_FIELD_ID = '__footer__'

const props = defineProps<{
  state: SettingsPanelSurfaceState<'root' | 'dialog'>
  controller: ExtensionSettingsPanelSessionController
}>()

const confirmAction = ref<ExtensionResolvedSettingsPanelFooterAction | null>(null)
const view = computed(() => props.state.view)
const visibleActions = computed(
  () => view.value.footerActions?.filter((action) => !action.hidden) ?? []
)
const startActions = computed(() =>
  visibleActions.value.filter((action) => action.placement === 'start')
)
const endActions = computed(() =>
  visibleActions.value.filter((action) => action.placement !== 'start')
)

function toButtonVariant(
  tone?: ExtensionResolvedSettingsPanelFooterAction['tone']
): ButtonVariants['variant'] {
  if (tone === 'danger') {
    return 'destructive'
  }

  return tone === 'primary' ? 'default' : 'outline'
}

function isActionDisabled(action: ExtensionResolvedSettingsPanelFooterAction): boolean {
  return (
    props.controller.busy.value ||
    !!action.disabled ||
    !action.callbackId ||
    props.controller.isCallbackBusy(action.callbackId)
  )
}

function invokeAction(action: ExtensionResolvedSettingsPanelFooterAction): void {
  if (isActionDisabled(action)) {
    return
  }

  void props.controller.invokeNode({
    surface: props.state,
    fieldId: FOOTER_FIELD_ID,
    node: toButtonNode(action)
  })
}

function confirmAndInvoke(): void {
  const action = confirmAction.value
  confirmAction.value = null
  if (action) {
    invokeAction(action)
  }
}

function toButtonNode(
  action: ExtensionResolvedSettingsPanelFooterAction
): ExtensionResolvedSettingsPanelButtonNode {
  return {
    ...action,
    kind: 'button'
  }
}

function closeSurface(): void {
  if (props.state.surface === 'root') {
    props.controller.closeRoot()
    return
  }

  void props.controller.closeDialog()
}
</script>

<template>
  <div class="flex min-w-0 flex-1 items-center justify-start gap-2">
    <template
      v-for="action in startActions"
      :key="action.id"
    >
      <AlertDialog v-if="action.confirm">
        <AlertDialogTrigger as-child>
          <Button
            type="button"
            :variant="toButtonVariant(action.tone)"
            :disabled="isActionDisabled(action)"
            @click="confirmAction = action"
          >
            <Icon
              v-if="action.icon"
              :icon="action.icon"
              class="size-4"
            />
            {{ action.label }}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{{ action.confirm.title }}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription v-if="action.confirm.description">
            {{ action.confirm.description }}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {{ action.confirm.cancelLabel ?? '取消' }}
            </AlertDialogCancel>
            <AlertDialogAction
              :disabled="isActionDisabled(action)"
              @click="confirmAndInvoke"
            >
              {{ action.confirm.confirmLabel ?? action.label }}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Button
        v-else
        type="button"
        :variant="toButtonVariant(action.tone)"
        :disabled="isActionDisabled(action)"
        @click="invokeAction(action)"
      >
        <Icon
          v-if="action.icon"
          :icon="action.icon"
          class="size-4"
        />
        {{ action.label }}
      </Button>
    </template>
  </div>

  <div class="flex min-w-0 items-center justify-end gap-2">
    <Button
      type="button"
      variant="outline"
      :disabled="props.controller.busy.value"
      @click="closeSurface"
    >
      关闭
    </Button>

    <template
      v-for="action in endActions"
      :key="action.id"
    >
      <AlertDialog v-if="action.confirm">
        <AlertDialogTrigger as-child>
          <Button
            type="button"
            :variant="toButtonVariant(action.tone)"
            :disabled="isActionDisabled(action)"
            @click="confirmAction = action"
          >
            <Icon
              v-if="action.icon"
              :icon="action.icon"
              class="size-4"
            />
            {{ action.label }}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{{ action.confirm.title }}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription v-if="action.confirm.description">
            {{ action.confirm.description }}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {{ action.confirm.cancelLabel ?? '取消' }}
            </AlertDialogCancel>
            <AlertDialogAction
              :disabled="isActionDisabled(action)"
              @click="confirmAndInvoke"
            >
              {{ action.confirm.confirmLabel ?? action.label }}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Button
        v-else
        type="button"
        :variant="toButtonVariant(action.tone)"
        :disabled="isActionDisabled(action)"
        @click="invokeAction(action)"
      >
        <Icon
          v-if="action.icon"
          :icon="action.icon"
          class="size-4"
        />
        {{ action.label }}
      </Button>
    </template>

    <Button
      type="button"
      :disabled="props.controller.busy.value"
      @click="props.controller.submit(props.state)"
    >
      {{ view.submitLabel ?? '保存' }}
    </Button>
  </div>
</template>
