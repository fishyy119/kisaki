<!--
Browse Extension Card renders one extension discovery result.
Boundary: installs by locator, but does not own catalog refresh.
-->
<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { Spinner } from '@renderer/components/ui/spinner'
import { cn } from '@renderer/utils/cn'
import { installExtension } from '@renderer/core/extensions'
import { notify } from '@renderer/core/notify'
import type { ExtensionRegistryEntry } from '@shared/extension'

interface Props {
  extension: ExtensionRegistryEntry
  installed: boolean
  refreshInstalledState: () => Promise<void>
}

const props = defineProps<Props>()

const installing = ref(false)
const iconError = ref(false)

async function handleInstall() {
  installing.value = true
  try {
    await installExtension(props.extension.locator)
    await props.refreshInstalledState()
    notify.success('扩展安装成功')
  } catch (error) {
    console.error('Install failed:', error)
    notify.error('安装失败', (error as Error).message)
  } finally {
    installing.value = false
  }
}
</script>

<template>
  <div :class="cn('flex flex-col p-4 border-r border-b', 'hover:bg-accent/50 transition-colors')">
    <!-- Header -->
    <div class="flex items-center gap-2 mb-2">
      <img
        v-if="props.extension.iconUrl && !iconError"
        :src="props.extension.iconUrl"
        alt=""
        class="size-5 rounded shrink-0 border shadow-xs"
        @error="iconError = true"
      />
      <Icon
        v-else
        icon="icon-[mdi--puzzle-outline]"
        class="size-5 text-muted-foreground shrink-0"
      />
      <h3 class="text-sm font-medium truncate flex-1">{{ props.extension.name }}</h3>
      <span class="text-[10px] text-muted-foreground/70 px-1.5 py-0.5 bg-muted/30 rounded">
        <template v-if="props.extension.version">v{{ props.extension.version }}</template>
        <template v-else>仓库</template>
      </span>
    </div>

    <!-- Meta - only author -->
    <div class="text-xs text-muted-foreground mb-2">{{ props.extension.author || '未知' }}</div>

    <!-- Description -->
    <p class="text-xs text-muted-foreground/70 line-clamp-2 flex-1 mb-3">
      {{ props.extension.description || '无描述' }}
    </p>

    <!-- Footer -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3 text-xs text-muted-foreground">
        <span
          v-if="props.extension.stars !== undefined"
          class="flex items-center gap-1"
        >
          <Icon
            icon="icon-[mdi--starburst-outline]"
            class="size-3.5"
          />
          {{ props.extension.stars }}
        </span>
        <a
          v-if="props.extension.homepage"
          :href="props.extension.homepage"
          target="_blank"
          rel="noopener noreferrer"
          class="hover:text-foreground transition-colors flex items-center gap-1"
        >
          <Icon
            icon="icon-[mdi--open-in-new]"
            class="size-3"
          />
          主页
        </a>
      </div>

      <Button
        size="sm"
        :variant="props.installed ? 'ghost' : 'default'"
        :disabled="installing || props.installed"
        @click="handleInstall"
      >
        <Spinner
          v-if="installing"
          class="size-3"
        />
        <template v-else-if="props.installed">
          <Icon
            icon="icon-[mdi--check]"
            class="size-3.5"
          />
          已安装
        </template>
        <template v-else>
          <Icon
            icon="icon-[mdi--download]"
            class="size-3.5"
          />
          安装
        </template>
      </Button>
    </div>
  </div>
</template>
