<script setup lang="ts">
import { toRef } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Spinner } from '@renderer/components/ui/spinner'
import ActionNode from './node/action-node.vue'
import CheckboxNode from './node/checkbox-node.vue'
import SelectNode from './node/select-node.vue'
import SubmenuNode from './node/submenu-node.vue'
import SeparatorNode from './node/separator-node.vue'
import { useExtensionEntityMenuSession } from './entity-menu-session'
import type { EntityMenuInput } from '@kisaki3/extension-api'
import type { MenuComponents } from '@renderer/types'

defineOptions({
  name: 'ExtensionEntityMenuItems'
})

const props = withDefaults(
  defineProps<{
    input: EntityMenuInput
    components: MenuComponents
    enabled?: boolean
    leadingSeparator?: boolean
  }>(),
  {
    enabled: true,
    leadingSeparator: true
  }
)

const session = useExtensionEntityMenuSession(toRef(props, 'input'), toRef(props, 'enabled'))
</script>

<template>
  <template v-if="props.enabled && session.hasContent.value">
    <component
      :is="props.components.Separator"
      v-if="props.leadingSeparator"
    />

    <component
      :is="props.components.Item"
      v-if="session.loading.value && session.visibleGroups.value.length === 0"
      disabled
    >
      <Spinner class="size-3.5" />
      加载扩展菜单...
    </component>

    <component
      :is="props.components.Item"
      v-if="session.error.value"
      disabled
    >
      <Icon
        icon="icon-[mdi--alert-circle-outline]"
        class="size-4 text-destructive"
      />
      扩展菜单加载失败
    </component>

    <template
      v-for="(group, groupIndex) in session.visibleGroups.value"
      :key="`${group.extensionId}:${group.contributionId}`"
    >
      <component
        :is="props.components.Separator"
        v-if="groupIndex > 0"
      />

      <template
        v-for="node in group.nodes"
        :key="`${group.extensionId}:${group.contributionId}:${node.id}`"
      >
        <SeparatorNode
          v-if="node.kind === 'separator'"
          :components="props.components"
        />
        <ActionNode
          v-else-if="node.kind === 'action'"
          :node="node"
          :group="group"
          :node-path="[node.id]"
          :components="props.components"
          :session="session"
        />
        <CheckboxNode
          v-else-if="node.kind === 'checkbox'"
          :node="node"
          :group="group"
          :node-path="[node.id]"
          :components="props.components"
          :session="session"
        />
        <SelectNode
          v-else-if="node.kind === 'select'"
          :node="node"
          :group="group"
          :node-path="[node.id]"
          :components="props.components"
          :session="session"
        />
        <SubmenuNode
          v-else-if="node.kind === 'submenu'"
          :node="node"
          :group="group"
          :node-path="[node.id]"
          :components="props.components"
          :session="session"
        />
      </template>
    </template>

    <component
      :is="props.components.Item"
      v-if="(session.resolvedMenu.value?.errors.length ?? 0) > 0"
      disabled
    >
      <Icon
        icon="icon-[mdi--alert-circle-outline]"
        class="size-4 text-muted-foreground"
      />
      部分扩展菜单不可用
    </component>
  </template>
</template>
