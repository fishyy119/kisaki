<script setup lang="ts">
import { Icon } from '@renderer/components/ui/icon'
import { useI18n } from '@renderer/composables'

interface Props {
  targetName: string
  sourceName: string
}

const props = defineProps<Props>()
const { m } = useI18n()
</script>

<template>
  <div class="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm">
    <div class="flex gap-2">
      <Icon
        icon="icon-[mdi--alert-outline]"
        class="mt-0.5 size-4 shrink-0 text-warning"
      />
      <div class="min-w-0 space-y-1">
        <div class="font-medium">
          {{ m.merge.confirmTitle({ source: props.sourceName, target: props.targetName }) }}
        </div>
        <div class="text-xs leading-5 text-muted-foreground">
          {{ m.merge.confirmDescription({ source: props.sourceName }) }}
        </div>
      </div>
    </div>
  </div>
</template>
