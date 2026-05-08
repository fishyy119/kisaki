<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Spinner } from '@renderer/components/ui/spinner'
import type { ExtensionMenuSessionController } from '../menu-session'
import type { ExtensionResolvedMenuActionNode, ExtensionResolvedMenuGroup } from '@shared/extension'
import type { MenuComponents } from '@renderer/types'

const props = defineProps<{
  node: ExtensionResolvedMenuActionNode
  group: ExtensionResolvedMenuGroup
  nodePath: readonly string[]
  components: MenuComponents
  session: ExtensionMenuSessionController
}>()

const invoking = computed(() => props.session.isInvoking(props.group, props.nodePath))
const disabled = computed(() => props.node.disabled === true || invoking.value)
</script>

<template>
  <component
    :is="props.components.Item"
    :disabled="disabled"
    @select="props.session.invokeNode(props.group, props.node, props.nodePath)"
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
</template>
