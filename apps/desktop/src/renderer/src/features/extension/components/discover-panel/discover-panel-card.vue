<!--
Browse Extension Card renders one catalog package result.
Boundary: emits install/details actions and does not perform mutations directly.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { cn } from '@renderer/utils/cn'
import type {
  ExtensionCatalogPackageInfo,
  ExtensionCreateRepositoryInstallPlanRequest
} from '@shared/extension'

interface Props {
  extension: ExtensionCatalogPackageInfo
  installed: boolean
}

interface Emits {
  (e: 'install', request: ExtensionCreateRepositoryInstallPlanRequest): void
  (e: 'details', extension: ExtensionCatalogPackageInfo): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const iconError = ref(false)

const latestRelease = computed(() => props.extension.latestRelease)
const canInstall = computed(
  () =>
    !props.installed &&
    Boolean(latestRelease.value?.compatible) &&
    !latestRelease.value?.yanked &&
    Boolean(latestRelease.value?.artifact)
)
const ownerLabel = computed(() => props.extension.owner?.name ?? '未知作者')
const signerLabel = computed(() => {
  const signature = latestRelease.value?.artifact?.signature
  if (!latestRelease.value?.artifact) {
    return '无可用包'
  }

  return signature ? '已签名' : '未签名'
})
const signerVariant = computed(() =>
  latestRelease.value?.artifact?.signature ? 'success' : 'warning'
)
const compatibilityLabel = computed(() => {
  const release = latestRelease.value
  if (!release) {
    return '无版本'
  }
  if (release.yanked) {
    return '已撤回'
  }
  return release.compatible ? '兼容' : '不兼容'
})
const compatibilityVariant = computed(() => {
  const release = latestRelease.value
  if (!release) {
    return 'secondary'
  }
  if (release.yanked) {
    return 'destructive'
  }
  return release.compatible ? 'success' : 'warning'
})

function handleInstall() {
  const release = latestRelease.value
  if (!release || !canInstall.value) {
    return
  }

  emit('install', {
    sourceKind: 'repository',
    extensionId: props.extension.id,
    releaseId: release.releaseDigest,
    repositoryId: release.repositoryId
  })
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
        <template v-if="latestRelease">v{{ latestRelease.version }}</template>
        <template v-else>无版本</template>
      </span>
    </div>

    <!-- Meta -->
    <div class="flex items-center gap-1.5 mb-2 min-w-0">
      <span class="text-xs text-muted-foreground truncate">{{ ownerLabel }}</span>
      <span class="text-xs text-muted-foreground/50">·</span>
      <span class="text-xs text-muted-foreground shrink-0">
        {{ props.extension.repositoryCount }} 个仓库
      </span>
    </div>

    <!-- Description -->
    <p class="text-xs text-muted-foreground/70 line-clamp-2 flex-1 mb-3">
      {{ props.extension.summary || props.extension.description || '无描述' }}
    </p>

    <div class="flex items-center gap-1.5 mb-3">
      <Badge
        :variant="compatibilityVariant"
        class="text-[10px] h-5"
      >
        {{ compatibilityLabel }}
      </Badge>
      <Badge
        :variant="signerVariant"
        class="text-[10px] h-5"
      >
        {{ signerLabel }}
      </Badge>
      <Badge
        v-if="latestRelease"
        variant="secondary"
        class="text-[10px] h-5"
      >
        {{ latestRelease.channel }}
      </Badge>
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3 text-xs text-muted-foreground">
        <span
          v-if="latestRelease"
          class="flex items-center gap-1"
        >
          <Icon
            icon="icon-[mdi--source-branch]"
            class="size-3.5"
          />
          {{ latestRelease.repositoryName }}
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

      <div class="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          @click="emit('details', props.extension)"
        >
          详情
        </Button>
        <Button
          size="sm"
          :variant="props.installed ? 'ghost' : 'default'"
          :disabled="props.installed || !canInstall"
          @click="handleInstall"
        >
          <template v-if="props.installed">
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
  </div>
</template>
