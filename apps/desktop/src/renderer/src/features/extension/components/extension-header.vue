<!--
Extension Header renders extension manager navigation and actions.
Boundary: emits shell commands; each route's own operations come from that
panel's actions component, mounted here only while its route is active.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import {
  PageHeader,
  PageHeaderNav,
  PageHeaderTitle,
  type PageHeaderNavItem
} from '@renderer/components/ui/page-header'
import { useI18n } from '@renderer/composables/use-i18n'
import InstalledPanelActions from './installed-panel/installed-panel-actions.vue'
import RepositoryPanelActions from './repository-panel/repository-panel-actions.vue'
import SignerPanelActions from './signer-panel/signer-panel-actions.vue'
import { EXTENSION_ROUTE_NAMES } from '../routes'

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

const { m } = useI18n()
const route = useRoute()

const showPendingIndicator = computed(() => props.hasPendingReload && !props.reloadingExtensionHost)
const reloadButtonTitle = computed(() =>
  props.hasPendingReload
    ? m.value.extension.header.reloadPending({ count: props.pendingReloadCount })
    : m.value.extension.header.reloadHost
)

const navItems = computed<PageHeaderNavItem[]>(() => [
  {
    routeName: EXTENSION_ROUTE_NAMES.discover,
    label: m.value.extension.nav.discover,
    icon: 'icon-[mdi--storefront-outline]'
  },
  {
    routeName: EXTENSION_ROUTE_NAMES.installed,
    label: m.value.extension.nav.installed,
    icon: 'icon-[mdi--check-circle-outline]'
  },
  {
    routeName: EXTENSION_ROUTE_NAMES.repositories,
    label: m.value.extension.nav.repositories,
    icon: 'icon-[mdi--source-branch]'
  },
  {
    routeName: EXTENSION_ROUTE_NAMES.signers,
    label: m.value.extension.nav.signers,
    icon: 'icon-[mdi--shield-key-outline]'
  }
])
</script>

<template>
  <PageHeader>
    <!-- Left: Title and sub-route navigation -->
    <PageHeaderTitle
      :title="m.extension.title"
      icon="icon-[mdi--puzzle-outline]"
    />
    <!-- Title 6rem + four icon pills 22rem + up to three action buttons 24rem
         need about 56rem; below the 4xl step the pills become one dropdown -->
    <PageHeaderNav
      :items="navItems"
      collapse-below="4xl"
    />

    <!-- Right: Actions -->
    <template #actions>
      <!-- Route-scoped operations, owned by each panel's actions component -->
      <InstalledPanelActions v-if="route.name === EXTENSION_ROUTE_NAMES.installed" />
      <RepositoryPanelActions v-else-if="route.name === EXTENSION_ROUTE_NAMES.repositories" />
      <SignerPanelActions v-else-if="route.name === EXTENSION_ROUTE_NAMES.signers" />

      <Button
        variant="outline"
        size="sm"
        class="relative"
        :disabled="props.reloadingExtensionHost"
        :tooltip="reloadButtonTitle"
        @click="emit('reloadExtensionHost')"
      >
        <Icon
          :icon="props.reloadingExtensionHost ? 'icon-[mdi--loading]' : 'icon-[mdi--restart]'"
          :class="props.reloadingExtensionHost ? 'size-4 animate-spin' : 'size-4'"
        />
        {{ m.extension.header.reloadProcess }}
        <span
          v-if="showPendingIndicator"
          class="absolute -right-1 -top-1 size-2 rounded-full bg-warning ring-2 ring-surface"
        />
      </Button>

      <!-- Install extension button -->
      <Button
        variant="default"
        size="sm"
        @click="emit('openReleaseDialog')"
      >
        <Icon
          icon="icon-[mdi--plus]"
          class="size-4"
        />
        {{ m.extension.header.install }}
      </Button>
    </template>
  </PageHeader>
</template>
