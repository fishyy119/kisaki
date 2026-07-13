<!--
Extension Header renders extension manager navigation and actions.
Boundary: emits commands and does not fetch extension data.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import {
  PageHeader,
  PageHeaderNav,
  PageHeaderTitle,
  type PageHeaderNavItem
} from '@renderer/components/ui/page-header'

interface Props {
  reloadingExtensionHost?: boolean
  hasPendingReload?: boolean
  pendingReloadCount?: number
}

interface Emits {
  (e: 'openReleaseDialog'): void
  (e: 'reloadExtensionHost'): void
}

const props = withDefaults(defineProps<Props>(), {
  reloadingExtensionHost: false,
  hasPendingReload: false,
  pendingReloadCount: 0
})
const emit = defineEmits<Emits>()

const showPendingIndicator = computed(() => props.hasPendingReload && !props.reloadingExtensionHost)
const reloadButtonTitle = computed(() =>
  props.hasPendingReload
    ? `扩展代码已更新（${props.pendingReloadCount}），点击重载进程以应用`
    : '重载扩展进程'
)

const navItems: PageHeaderNavItem[] = [
  { routeName: 'extension-discover', label: '发现', icon: 'icon-[mdi--storefront-outline]' },
  { routeName: 'extension-installed', label: '已安装', icon: 'icon-[mdi--check-circle-outline]' },
  { routeName: 'extension-repositories', label: '仓库', icon: 'icon-[mdi--source-branch]' },
  { routeName: 'extension-signers', label: '签名', icon: 'icon-[mdi--shield-key-outline]' }
]
</script>

<template>
  <PageHeader back-to="/library">
    <!-- Left: Title and sub-route navigation -->
    <PageHeaderTitle
      title="扩展"
      icon="icon-[mdi--puzzle-outline]"
    />
    <PageHeaderNav :items="navItems" />

    <!-- Right: Actions -->
    <template #actions>
      <Button
        variant="outline"
        size="sm"
        class="relative text-xs gap-1.5"
        :disabled="props.reloadingExtensionHost"
        :tooltip="reloadButtonTitle"
        @click="emit('reloadExtensionHost')"
      >
        <Icon
          :icon="props.reloadingExtensionHost ? 'icon-[mdi--loading]' : 'icon-[mdi--restart]'"
          :class="props.reloadingExtensionHost ? 'size-4 animate-spin' : 'size-4'"
        />
        重载进程
        <span
          v-if="showPendingIndicator"
          class="absolute -right-1 -top-1 size-2 rounded-full bg-warning ring-2 ring-surface"
        />
      </Button>

      <!-- Install extension button -->
      <Button
        variant="default"
        size="sm"
        class="text-xs gap-1.5"
        @click="emit('openReleaseDialog')"
      >
        <Icon
          icon="icon-[mdi--plus]"
          class="size-4"
        />
        安装扩展
      </Button>
    </template>
  </PageHeader>
</template>
