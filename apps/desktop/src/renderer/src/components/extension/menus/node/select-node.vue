<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Spinner } from '@renderer/components/ui/spinner'
import type { ExtensionMenuSessionController } from '../menu-session'
import type { ExtensionResolvedMenuGroup, ExtensionResolvedMenuSelectNode } from '@shared/extension'
import type { MenuComponents } from '@renderer/types'

const props = defineProps<{
  node: ExtensionResolvedMenuSelectNode
  group: ExtensionResolvedMenuGroup
  nodePath: readonly string[]
  components: MenuComponents
  session: ExtensionMenuSessionController
}>()

const invoking = computed(() => props.session.isInvoking(props.group, props.nodePath))
const disabled = computed(() => props.node.disabled === true || invoking.value)
</script>

<template>
  <component :is="props.components.Sub">
    <component
      :is="props.components.SubTrigger"
      :disabled="disabled"
    >
      <Spinner
        v-if="invoking"
        class="size-3.5"
      />
      <Icon
        v-else-if="props.node.icon"
        :icon="props.node.icon"
        class="size-4"
      />
      {{ props.node.label }}
    </component>
    <component
      :is="props.components.SubContent"
      class="min-w-[160px]"
    >
      <component
        :is="props.components.RadioGroup"
        :model-value="props.node.value"
      >
        <component
          :is="props.components.RadioItem"
          v-for="option in props.node.options"
          :key="option.value"
          :value="option.value"
          :disabled="option.disabled || props.node.disabled"
          @select="props.session.invokeNode(props.group, props.node, props.nodePath, option.value)"
        >
          {{ option.label }}
        </component>
      </component>
    </component>
  </component>
</template>
