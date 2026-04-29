<!--
ExtensionSettingsNode renders one resolved settings node, recursively for sections.
Boundary: emits draft updates, callback intents, and dialog navigation targets.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@renderer/components/ui/button'
import { Checkbox } from '@renderer/components/ui/checkbox'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel
} from '@renderer/components/ui/field'
import { Input } from '@renderer/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@renderer/components/ui/select'
import { Switch } from '@renderer/components/ui/switch'
import { Textarea } from '@renderer/components/ui/textarea'
import { cn } from '@renderer/utils'
import { getSettingsNodeCallbackId, type SettingsDraft } from '@renderer/core/extensions'
import type {
  SerializableValue,
  SettingsDialogTarget,
  SettingsResolvedNode
} from '@kisaki/extension-api'

defineOptions({
  name: 'ExtensionSettingsNode'
})

interface Props {
  node: SettingsResolvedNode
  draft: SettingsDraft
  busyCallbacks: ReadonlySet<string>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'value-change': [nodeId: string, value: SerializableValue]
  invoke: [node: SettingsResolvedNode, value?: SerializableValue]
  open: [target: SettingsDialogTarget]
}>()

const callbackId = computed(() => getSettingsNodeCallbackId(props.node))
const modelValue = computed(() => props.draft[props.node.id])
const booleanModel = computed({
  get: () => modelValue.value === true,
  set: (value: boolean) => {
    emit('value-change', props.node.id, value)
    invokeImmediate(value)
  }
})
const stringModel = computed({
  get: () => (typeof modelValue.value === 'string' ? modelValue.value : ''),
  set: (value: string | number) => {
    emit('value-change', props.node.id, String(value))
  }
})
const numberModel = computed<string | number>({
  get: () => (typeof modelValue.value === 'number' ? modelValue.value : ''),
  set: (value: string | number) => {
    if (value === '') {
      emit('value-change', props.node.id, null)
      return
    }

    const numericValue = typeof value === 'number' ? value : Number(value)
    emit('value-change', props.node.id, Number.isFinite(numericValue) ? numericValue : null)
  }
})
const selectedLabel = computed(() => {
  if (props.node.kind !== 'select') {
    return ''
  }

  const value = stringModel.value
  return (
    props.node.options.find((option) => option.value === value)?.label ??
    props.node.placeholder ??
    value
  )
})
const buttonVariant = computed(() => {
  if (props.node.kind !== 'button') {
    return 'outline'
  }

  if (props.node.tone === 'danger') {
    return 'destructive'
  }

  return props.node.tone === 'primary' ? 'default' : 'outline'
})
const busy = computed(() => (callbackId.value ? props.busyCallbacks.has(callbackId.value) : false))

function invokeImmediate(value: SerializableValue): void {
  if (callbackId.value) {
    emit('invoke', props.node, value)
  }
}

function handleSelectUpdate(value: unknown): void {
  const nextValue = typeof value === 'string' ? value : ''
  emit('value-change', props.node.id, nextValue)
  invokeImmediate(nextValue)
}

function handleTextCommit(): void {
  if (callbackId.value) {
    emit('invoke', props.node, stringModel.value)
  }
}

function handleNumberCommit(): void {
  if (callbackId.value && typeof modelValue.value === 'number') {
    emit('invoke', props.node, modelValue.value)
  }
}

function handleButtonClick(): void {
  if (callbackId.value) {
    emit('invoke', props.node)
  }
}
</script>

<template>
  <template v-if="!props.node.hidden">
    <section
      v-if="props.node.kind === 'section'"
      class="space-y-3"
    >
      <div v-if="props.node.title || props.node.description">
        <h3
          v-if="props.node.title"
          class="text-sm font-medium"
        >
          {{ props.node.title }}
        </h3>
        <p
          v-if="props.node.description"
          class="text-xs text-muted-foreground mt-1"
        >
          {{ props.node.description }}
        </p>
      </div>

      <FieldGroup>
        <ExtensionSettingsNode
          v-for="child in props.node.children.filter((item) => !item.hidden)"
          :key="child.id"
          :node="child"
          :draft="props.draft"
          :busy-callbacks="props.busyCallbacks"
          @value-change="(nodeId, value) => emit('value-change', nodeId, value)"
          @invoke="(node, value) => emit('invoke', node, value)"
          @open="emit('open', $event)"
        />
      </FieldGroup>
    </section>

    <p
      v-else-if="props.node.kind === 'text'"
      :class="
        cn(
          'text-sm',
          props.node.tone === 'muted' && 'text-muted-foreground',
          props.node.tone === 'danger' && 'text-destructive'
        )
      "
    >
      {{ props.node.text }}
    </p>

    <Field
      v-else-if="props.node.kind === 'switch'"
      orientation="horizontal"
    >
      <FieldLabel v-if="props.node.label">{{ props.node.label }}</FieldLabel>
      <FieldDescription v-if="props.node.description">{{
        props.node.description
      }}</FieldDescription>
      <FieldContent>
        <Switch
          v-model="booleanModel"
          :disabled="props.node.disabled || busy"
        />
      </FieldContent>
    </Field>

    <Field
      v-else-if="props.node.kind === 'checkbox'"
      orientation="horizontal"
    >
      <FieldLabel v-if="props.node.label">{{ props.node.label }}</FieldLabel>
      <FieldDescription v-if="props.node.description">{{
        props.node.description
      }}</FieldDescription>
      <FieldContent>
        <Checkbox
          v-model="booleanModel"
          :disabled="props.node.disabled || busy"
        />
      </FieldContent>
    </Field>

    <Field
      v-else-if="props.node.kind === 'select'"
      orientation="horizontal"
    >
      <FieldLabel v-if="props.node.label">{{ props.node.label }}</FieldLabel>
      <FieldDescription v-if="props.node.description">{{
        props.node.description
      }}</FieldDescription>
      <FieldContent>
        <Select
          :model-value="stringModel"
          :disabled="props.node.disabled || busy"
          @update:model-value="handleSelectUpdate"
        >
          <SelectTrigger class="w-56 max-w-full">
            <span class="truncate">{{ selectedLabel }}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="option in props.node.options"
              :key="option.value"
              :value="option.value"
              :description="option.description"
              :disabled="option.disabled"
            >
              {{ option.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </FieldContent>
    </Field>

    <Field
      v-else-if="props.node.kind === 'textInput'"
      orientation="vertical"
    >
      <FieldLabel v-if="props.node.label">{{ props.node.label }}</FieldLabel>
      <FieldDescription v-if="props.node.description">{{
        props.node.description
      }}</FieldDescription>
      <FieldContent>
        <Input
          v-model="stringModel"
          class="w-full"
          :type="props.node.inputMode === 'password' ? 'password' : 'text'"
          :placeholder="props.node.placeholder"
          :disabled="props.node.disabled || busy"
          @blur="handleTextCommit"
        />
      </FieldContent>
    </Field>

    <Field
      v-else-if="props.node.kind === 'textarea'"
      orientation="vertical"
    >
      <FieldLabel v-if="props.node.label">{{ props.node.label }}</FieldLabel>
      <FieldDescription v-if="props.node.description">{{
        props.node.description
      }}</FieldDescription>
      <FieldContent>
        <Textarea
          v-model="stringModel"
          class="w-full"
          :placeholder="props.node.placeholder"
          :rows="props.node.rows ?? 3"
          :disabled="props.node.disabled || busy"
          @blur="handleTextCommit"
        />
      </FieldContent>
    </Field>

    <Field
      v-else-if="props.node.kind === 'numberInput'"
      orientation="vertical"
    >
      <FieldLabel v-if="props.node.label">{{ props.node.label }}</FieldLabel>
      <FieldDescription v-if="props.node.description">{{
        props.node.description
      }}</FieldDescription>
      <FieldContent>
        <Input
          v-model="numberModel"
          class="w-40 max-w-full"
          type="number"
          :placeholder="props.node.placeholder"
          :disabled="props.node.disabled || busy"
          @blur="handleNumberCommit"
        />
      </FieldContent>
    </Field>

    <Field
      v-else-if="props.node.kind === 'button'"
      orientation="horizontal"
    >
      <FieldLabel v-if="props.node.label">{{ props.node.label }}</FieldLabel>
      <FieldDescription v-if="props.node.description">{{
        props.node.description
      }}</FieldDescription>
      <FieldContent>
        <Button
          type="button"
          :variant="buttonVariant"
          size="sm"
          :disabled="props.node.disabled || busy || !callbackId"
          @click="handleButtonClick"
        >
          {{ props.node.text ?? props.node.label ?? '执行' }}
        </Button>
      </FieldContent>
    </Field>

    <Field
      v-else-if="props.node.kind === 'dialog'"
      orientation="horizontal"
    >
      <FieldLabel v-if="props.node.label">{{ props.node.label }}</FieldLabel>
      <FieldDescription v-if="props.node.description">{{
        props.node.description
      }}</FieldDescription>
      <FieldContent>
        <Button
          type="button"
          variant="outline"
          size="sm"
          :disabled="props.node.disabled"
          @click="emit('open', props.node.target)"
        >
          打开
        </Button>
      </FieldContent>
    </Field>

    <div
      v-else-if="props.node.kind === 'notice'"
      :class="
        cn(
          'rounded-md border px-3 py-2 text-sm',
          props.node.tone === 'info' && 'border-primary/30 bg-primary/10 text-foreground',
          props.node.tone === 'success' && 'border-success/30 bg-success/10 text-foreground',
          props.node.tone === 'warning' && 'border-warning/30 bg-warning/10 text-foreground',
          props.node.tone === 'error' && 'border-destructive/30 bg-destructive/10 text-foreground'
        )
      "
    >
      {{ props.node.text }}
    </div>

    <div
      v-else-if="props.node.kind === 'status'"
      class="flex items-center justify-between gap-3 text-sm"
    >
      <span class="text-muted-foreground">{{ props.node.label }}</span>
      <span
        :class="
          cn(
            'font-medium',
            props.node.tone === 'success' && 'text-success',
            props.node.tone === 'warning' && 'text-warning',
            props.node.tone === 'danger' && 'text-destructive'
          )
        "
      >
        {{ props.node.value }}
      </span>
    </div>

    <div
      v-else-if="props.node.kind === 'divider'"
      class="h-px bg-border"
    />
  </template>
</template>
