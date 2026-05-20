<script setup lang="ts">
import { computed } from 'vue'
import { Field, FieldContent } from '@renderer/components/ui/field'
import { ipcManager, unwrapIpcVoid } from '@renderer/core/ipc'
import { notify } from '@renderer/core/notify'
import { cn } from '@renderer/utils'
import SwitchNode from '../node/switch-node.vue'
import CheckboxNode from '../node/checkbox-node.vue'
import SelectNode from '../node/select-node.vue'
import RadioGroupNode from '../node/radio-group-node.vue'
import MultiSelectNode from '../node/multi-select-node.vue'
import TextInputNode from '../node/text-input-node.vue'
import TextareaNode from '../node/textarea-node.vue'
import NumberInputNode from '../node/number-input-node.vue'
import StringListNode from '../node/string-list-node.vue'
import RecordListNode from '../node/record-list-node.vue'
import ButtonNode from '../node/button-node.vue'
import TextNode from '../node/text-node.vue'
import NoticeNode from '../node/notice-node.vue'
import StatusNode from '../node/status-node.vue'
import TableNode from '../node/table-node.vue'
import ComparisonListNode from '../node/comparison-list-node.vue'
import LinkNode from '../node/link-node.vue'
import ImageNode from '../node/image-node.vue'
import DividerNode from '../node/divider-node.vue'
import type { ExtensionSettingsPanelSessionController, SettingsPanelSurfaceState } from '../session'
import type {
  ExtensionResolvedSettingsPanelField,
  ExtensionResolvedSettingsPanelNode,
  ExtensionSettingsPanelSurface
} from '@shared/extension'

defineOptions({
  name: 'ExtensionSettingsPanelField'
})

const props = defineProps<{
  field: ExtensionResolvedSettingsPanelField
  state: SettingsPanelSurfaceState<ExtensionSettingsPanelSurface>
  controller: ExtensionSettingsPanelSessionController
}>()

const visibleNodes = computed(() => props.field.content.filter((node) => !node.hidden))
const orientation = computed(() => props.field.orientation ?? 'horizontal')
const fieldClass = computed(() =>
  cn(
    props.field.span === 'full' && 'col-span-full',
    typeof props.field.span === 'number' && `col-span-${props.field.span}`
  )
)
const contentClass = computed(() =>
  cn(
    'gap-2',
    props.field.contentLayout === 'inline' && 'flex w-full flex-row flex-wrap items-center',
    props.field.contentLayout === 'grid' && 'grid',
    props.field.contentLayout === 'grid' &&
      props.field.contentColumns === 2 &&
      'grid-cols-1 sm:grid-cols-2',
    props.field.contentLayout === 'grid' &&
      props.field.contentColumns === 3 &&
      'grid-cols-1 sm:grid-cols-3',
    (!props.field.contentLayout || props.field.contentLayout === 'stack') && 'flex flex-col'
  )
)

function nodeWrapperClass(node: ExtensionResolvedSettingsPanelNode): string {
  return cn(
    'min-w-0',
    node.grow && 'min-w-48 flex-1',
    node.width === 'auto' && 'w-auto',
    node.width === 'sm' && 'w-32 max-w-full',
    node.width === 'md' && 'w-56 max-w-full',
    node.width === 'lg' && 'w-80 max-w-full',
    node.width === 'full' && 'w-full',
    !node.grow && !node.width && props.field.contentLayout !== 'inline' && 'w-full'
  )
}

async function openLink(link: { href: string }): Promise<void> {
  try {
    unwrapIpcVoid(await ipcManager.invoke('native:open-external', link.href))
  } catch (error) {
    notify.error('打开链接失败', error instanceof Error ? error.message : String(error))
  }
}
</script>

<template>
  <Field
    v-if="!props.field.hidden"
    :orientation="orientation"
    :label="props.field.label"
    :description="props.field.description"
    :help="props.field.help"
    :link="props.field.link"
    :class="fieldClass"
    @link-click="openLink"
  >
    <FieldContent :class="contentClass">
      <div
        v-for="node in visibleNodes"
        :key="node.id"
        :class="nodeWrapperClass(node)"
      >
        <SwitchNode
          v-if="node.kind === 'switch'"
          :node="node"
          :field-id="props.field.id"
          :field-disabled="props.field.disabled"
          :state="props.state"
          :controller="props.controller"
        />
        <CheckboxNode
          v-else-if="node.kind === 'checkbox'"
          :node="node"
          :field-id="props.field.id"
          :field-disabled="props.field.disabled"
          :state="props.state"
          :controller="props.controller"
        />
        <SelectNode
          v-else-if="node.kind === 'select'"
          :node="node"
          :field-id="props.field.id"
          :field-disabled="props.field.disabled"
          :state="props.state"
          :controller="props.controller"
        />
        <RadioGroupNode
          v-else-if="node.kind === 'radioGroup'"
          :node="node"
          :field-id="props.field.id"
          :field-disabled="props.field.disabled"
          :state="props.state"
          :controller="props.controller"
        />
        <MultiSelectNode
          v-else-if="node.kind === 'multiSelect'"
          :node="node"
          :field-id="props.field.id"
          :field-disabled="props.field.disabled"
          :state="props.state"
          :controller="props.controller"
        />
        <TextInputNode
          v-else-if="node.kind === 'textInput'"
          :node="node"
          :field-id="props.field.id"
          :field-disabled="props.field.disabled"
          :state="props.state"
          :controller="props.controller"
        />
        <TextareaNode
          v-else-if="node.kind === 'textarea'"
          :node="node"
          :field-id="props.field.id"
          :field-disabled="props.field.disabled"
          :state="props.state"
          :controller="props.controller"
        />
        <NumberInputNode
          v-else-if="node.kind === 'numberInput'"
          :node="node"
          :field-id="props.field.id"
          :field-disabled="props.field.disabled"
          :state="props.state"
          :controller="props.controller"
        />
        <StringListNode
          v-else-if="node.kind === 'stringList'"
          :node="node"
          :field-id="props.field.id"
          :field-disabled="props.field.disabled"
          :state="props.state"
          :controller="props.controller"
        />
        <RecordListNode
          v-else-if="node.kind === 'recordList'"
          :node="node"
          :field-id="props.field.id"
          :field-disabled="props.field.disabled"
          :state="props.state"
          :controller="props.controller"
        />
        <ButtonNode
          v-else-if="node.kind === 'button'"
          :node="node"
          :field-id="props.field.id"
          :field-disabled="props.field.disabled"
          :state="props.state"
          :controller="props.controller"
        />
        <TextNode
          v-else-if="node.kind === 'text'"
          :node="node"
        />
        <NoticeNode
          v-else-if="node.kind === 'notice'"
          :node="node"
        />
        <StatusNode
          v-else-if="node.kind === 'status'"
          :node="node"
        />
        <TableNode
          v-else-if="node.kind === 'table'"
          :node="node"
        />
        <ComparisonListNode
          v-else-if="node.kind === 'comparisonList'"
          :node="node"
        />
        <LinkNode
          v-else-if="node.kind === 'link'"
          :node="node"
        />
        <ImageNode
          v-else-if="node.kind === 'image'"
          :node="node"
        />
        <DividerNode
          v-else-if="node.kind === 'divider'"
          :node="node"
        />
      </div>
    </FieldContent>
  </Field>
</template>
