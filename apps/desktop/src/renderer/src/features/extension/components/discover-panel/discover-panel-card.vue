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
import { useI18n } from '@renderer/composables/use-i18n'
import { resolveExtensionText } from '@renderer/core/extensions'
import type {
  ExtensionCatalogPackageInfo,
  ExtensionCreateRepositoryReleasePlanRequest
} from '@shared/extension'

interface Props {
  extension: ExtensionCatalogPackageInfo
  installed: boolean
}

interface Emits {
  (e: 'apply-release', request: ExtensionCreateRepositoryReleasePlanRequest): void
  (e: 'details', extension: ExtensionCatalogPackageInfo): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { m } = useI18n()
const iconError = ref(false)

const latestRelease = computed(() => props.extension.latestRelease)
const canInstall = computed(
  () =>
    !props.installed &&
    Boolean(latestRelease.value?.compatible) &&
    !latestRelease.value?.yanked &&
    Boolean(latestRelease.value?.artifact)
)
const displayName = computed(() => resolveExtensionText(props.extension.name))
const displaySummary = computed(() => resolveExtensionText(props.extension.summary))
const ownerLabel = computed(
  () => props.extension.owner?.name ?? m.value.extension.discover.unknownAuthor
)
const sourceLabel = computed(() =>
  m.value.extension.discover.sourceCount({ count: props.extension.repositoryCount })
)

function handleInstall() {
  const release = latestRelease.value
  if (!release || !canInstall.value) {
    return
  }

  emit('apply-release', {
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
        class="size-5 rounded shrink-0 border shadow-raised"
        @error="iconError = true"
      />
      <Icon
        v-else
        icon="icon-[mdi--puzzle-outline]"
        class="size-5 text-muted-foreground shrink-0"
      />
      <h3 class="text-sm font-medium truncate flex-1">{{ displayName }}</h3>
      <Badge
        variant="outline"
        class="text-[10px] px-1.5 py-0 h-4 text-muted-foreground font-mono"
      >
        <template v-if="latestRelease">v{{ latestRelease.version }}</template>
        <template v-else>{{ m.extension.discover.noVersion }}</template>
      </Badge>
    </div>

    <!-- Meta -->
    <div class="mb-2 min-w-0 text-xs text-muted-foreground">
      <div class="truncate">{{ ownerLabel }}</div>
    </div>

    <!-- Description -->
    <p class="text-xs text-muted-foreground/70 line-clamp-2 flex-1 mb-3">
      {{ displaySummary || m.extension.discover.noDescription }}
    </p>

    <!-- Footer -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3 text-xs text-muted-foreground">
        <span class="flex items-center gap-1">
          <Icon
            icon="icon-[mdi--source-branch]"
            class="size-3.5"
          />
          {{ sourceLabel }}
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
          {{ m.extension.discover.homepage }}
        </a>
      </div>

      <div class="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          @click="emit('details', props.extension)"
        >
          {{ m.extension.discover.details }}
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
            {{ m.extension.discover.installed }}
          </template>
          <template v-else>
            <Icon
              icon="icon-[mdi--download]"
              class="size-3.5"
            />
            {{ m.extension.discover.install }}
          </template>
        </Button>
      </div>
    </div>
  </div>
</template>
