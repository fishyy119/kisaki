<!--
Signer Panel Row renders one trusted signer entry.
Boundary: pure row UI; emits selection and removal intents to the parent panel.
-->
<script setup lang="ts">
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import type { ExtensionTrustedSignerInfo } from '@shared/extension'
import { formatSignerDate, getSignerRepositoryLabel, shortSignerFingerprint } from './display'

interface Props {
  signer: ExtensionTrustedSignerInfo
}

interface Emits {
  (e: 'details', signer: ExtensionTrustedSignerInfo): void
  (e: 'remove', signer: ExtensionTrustedSignerInfo): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
</script>

<template>
  <div
    class="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-4 py-3 transition-colors hover:bg-accent/40"
  >
    <div class="min-w-0 space-y-2">
      <div class="flex min-w-0 items-center gap-2">
        <Icon
          icon="icon-[mdi--shield-key-outline]"
          class="size-4 shrink-0 text-muted-foreground"
        />
        <span class="truncate text-sm font-medium">{{ props.signer.extensionId }}</span>
      </div>

      <div class="font-mono text-xs text-muted-foreground">
        {{ shortSignerFingerprint(props.signer.fingerprint) }}
      </div>

      <div class="grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-muted-foreground lg:grid-cols-2">
        <div class="truncate">来源：{{ getSignerRepositoryLabel(props.signer) }}</div>
        <div>信任时间：{{ formatSignerDate(props.signer.trustedAt) }}</div>
      </div>
    </div>

    <div class="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        tooltip="查看详情"
        @click="emit('details', props.signer)"
      >
        <Icon
          icon="icon-[mdi--information-outline]"
          class="size-4"
        />
      </Button>

      <Button
        variant="ghost"
        size="icon-sm"
        tooltip="撤销信任"
        class="hover:text-destructive"
        @click="emit('remove', props.signer)"
      >
        <Icon
          icon="icon-[mdi--delete-outline]"
          class="size-4"
        />
      </Button>
    </div>
  </div>
</template>
