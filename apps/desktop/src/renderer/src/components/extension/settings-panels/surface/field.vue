<script setup lang="ts">
import { computed } from 'vue'
import { Field, FieldContent, FieldDescription, FieldLabel } from '@renderer/components/ui/field'
import { cn } from '@renderer/utils'
import SwitchNode from '../node/switch-node.vue'
import CheckboxNode from '../node/checkbox-node.vue'
import SelectNode from '../node/select-node.vue'
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
import ImageNode from '../node/image-node.vue'
import DividerNode from '../node/divider-node.vue'
import type { ExtensionSettingsPanelSessionController, SettingsPanelSurfaceState } from '../session'
import type {
  ExtensionResolvedSettingsPanelField,
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
    props.field.contentLayout === 'inline' && 'flex flex-row flex-wrap items-center',
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
</script>

<template>
  <Field
    v-if="!props.field.hidden"
    :orientation="orientation"
    :class="fieldClass"
  >
    <div
      v-if="props.field.label || props.field.description"
      class="space-y-1"
    >
      <FieldLabel v-if="props.field.label">{{ props.field.label }}</FieldLabel>
      <FieldDescription v-if="props.field.description">
        {{ props.field.description }}
      </FieldDescription>
    </div>

    <FieldContent :class="contentClass">
      <template
        v-for="node in visibleNodes"
        :key="node.id"
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
        <ImageNode
          v-else-if="node.kind === 'image'"
          :node="node"
        />
        <DividerNode
          v-else-if="node.kind === 'divider'"
          :node="node"
        />
      </template>
    </FieldContent>
  </Field>
</template>
