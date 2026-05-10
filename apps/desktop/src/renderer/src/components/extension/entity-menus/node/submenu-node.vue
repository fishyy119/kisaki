<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import ActionNode from './action-node.vue'
import CheckboxNode from './checkbox-node.vue'
import SelectNode from './select-node.vue'
import SeparatorNode from './separator-node.vue'
import type { ExtensionEntityMenuSessionController } from '../entity-menu-session'
import type {
  ExtensionResolvedEntityMenuGroup,
  ExtensionResolvedEntityMenuSubmenuNode
} from '@shared/extension'
import type { MenuComponents } from '@renderer/types'

defineOptions({
  name: 'ExtensionEntityMenuSubmenuNode'
})

const props = defineProps<{
  node: ExtensionResolvedEntityMenuSubmenuNode
  group: ExtensionResolvedEntityMenuGroup
  nodePath: readonly string[]
  components: MenuComponents
  session: ExtensionEntityMenuSessionController
}>()

const visibleChildren = computed(() =>
  props.node.children.filter((node) => node.kind === 'separator' || !node.hidden)
)
</script>

<template>
  <component :is="props.components.Sub">
    <component
      :is="props.components.SubTrigger"
      :disabled="props.node.disabled"
    >
      <Icon
        v-if="props.node.icon"
        :icon="props.node.icon"
        class="size-4"
      />
      {{ props.node.label }}
    </component>
    <component :is="props.components.SubContent">
      <template
        v-for="child in visibleChildren"
        :key="child.id"
      >
        <SeparatorNode
          v-if="child.kind === 'separator'"
          :components="props.components"
        />
        <ActionNode
          v-else-if="child.kind === 'action'"
          :node="child"
          :group="props.group"
          :node-path="[...props.nodePath, child.id]"
          :components="props.components"
          :session="props.session"
        />
        <CheckboxNode
          v-else-if="child.kind === 'checkbox'"
          :node="child"
          :group="props.group"
          :node-path="[...props.nodePath, child.id]"
          :components="props.components"
          :session="props.session"
        />
        <SelectNode
          v-else-if="child.kind === 'select'"
          :node="child"
          :group="props.group"
          :node-path="[...props.nodePath, child.id]"
          :components="props.components"
          :session="props.session"
        />
        <ExtensionEntityMenuSubmenuNode
          v-else-if="child.kind === 'submenu'"
          :node="child"
          :group="props.group"
          :node-path="[...props.nodePath, child.id]"
          :components="props.components"
          :session="props.session"
        />
      </template>
    </component>
  </component>
</template>
