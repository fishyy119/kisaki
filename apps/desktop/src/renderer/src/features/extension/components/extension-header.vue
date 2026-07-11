<!--
Extension Header renders extension manager navigation and actions.
Boundary: emits commands and does not fetch extension data.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'

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

const route = useRoute()

const showPendingIndicator = computed(() => props.hasPendingReload && !props.reloadingExtensionHost)
const reloadButtonTitle = computed(() =>
  props.hasPendingReload
    ? `扩展代码已更新（${props.pendingReloadCount}），点击重载进程以应用`
    : '重载扩展进程'
)

const navItems: {
  routeName:
    'extension-discover' | 'extension-installed' | 'extension-repositories' | 'extension-signers'
  label: string
  icon: string
}[] = [
  { routeName: 'extension-discover', label: '发现', icon: 'icon-[mdi--storefront-outline]' },
  { routeName: 'extension-installed', label: '已安装', icon: 'icon-[mdi--check-circle-outline]' },
  { routeName: 'extension-repositories', label: '仓库', icon: 'icon-[mdi--source-branch]' },
  { routeName: 'extension-signers', label: '签名', icon: 'icon-[mdi--shield-key-outline]' }
]

function isRouteActive(routeName: string): boolean {
  const currentRouteName = route.name
  if (!currentRouteName || typeof currentRouteName !== 'string')
    return routeName === 'extension-discover'
  return currentRouteName === routeName
}
</script>

<template>
  <div class="shrink-0 flex items-center gap-3 px-4 h-12 border-b border-border bg-surface">
    <!-- Left: Title and sub-route navigation -->
    <div class="flex items-center gap-4 shrink-0">
      <div class="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          as-child
        >
          <RouterLink to="/library">
            <Icon
              icon="icon-[mdi--arrow-left]"
              class="size-4"
            />
          </RouterLink>
        </Button>
        <Icon
          icon="icon-[mdi--puzzle-outline]"
          class="size-5"
        />
        <h1 class="text-base font-semibold">扩展</h1>
      </div>

      <!-- Sub-route navigation -->
      <div class="flex items-center gap-1">
        <RouterLink
          v-for="item in navItems"
          :key="item.routeName"
          v-slot="{ navigate }"
          :to="{ name: item.routeName }"
          custom
        >
          <Button
            variant="ghost"
            size="sm"
            :class="{ 'bg-accent': isRouteActive(item.routeName) }"
            @click="navigate"
          >
            <span class="flex items-center gap-1.5">
              <Icon
                :icon="item.icon"
                class="size-3.5"
              />
              <span>{{ item.label }}</span>
            </span>
          </Button>
        </RouterLink>
      </div>
    </div>

    <!-- Spacer -->
    <div class="flex-1" />

    <!-- Right: Actions -->
    <div class="flex items-center gap-2 shrink-0">
      <Button
        variant="outline"
        size="sm"
        class="relative text-xs gap-1.5"
        :disabled="props.reloadingExtensionHost"
        :title="reloadButtonTitle"
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
    </div>
  </div>
</template>
