<script setup lang="ts">
import { computed } from 'vue'
import { Spinner } from '@renderer/components/ui/spinner'
import ContributionIcon from '../../contribution-icon.vue'
import type { ExtensionEntityMenuSessionController } from '../entity-menu-session'
import type {
  ExtensionResolvedEntityMenuActionNode,
  ExtensionResolvedEntityMenuGroup
} from '@shared/extension'
import type { MenuComponents } from '@renderer/types'

const props = defineProps<{
  node: ExtensionResolvedEntityMenuActionNode
  group: ExtensionResolvedEntityMenuGroup
  nodePath: readonly string[]
  components: MenuComponents
  session: ExtensionEntityMenuSessionController
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
    <ContributionIcon
      v-else-if="props.node.icon"
      :icon="props.node.icon"
      class="size-4"
    />
    {{ props.node.label }}
  </component>
</template>
