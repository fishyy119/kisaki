<!--
Extension Changelog Dialog shows the full localized changelog for one release.
Boundary: presentation-only dialog for release metadata supplied by parent components.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { MarkdownContent } from '@renderer/components/ui/markdown'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { selectLocalizedDocument } from '../utils/localized-document'
import type { ExtensionCatalogReleaseInfo } from '@shared/extension'

interface Props {
  release: ExtensionCatalogReleaseInfo | null
  packageName?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  packageName: null
})
const open = defineModel<boolean>('open', { required: true })

const changelog = computed(() => selectLocalizedDocument(props.release?.changelog))
const title = computed(() => (props.release ? `v${props.release.version} 更新日志` : '更新日志'))
const description = computed(() => props.packageName ?? '扩展版本变更')
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>{{ description }}</DialogDescription>
      </DialogHeader>

      <DialogBody class="max-h-[60vh] overflow-auto space-y-3">
        <template v-if="changelog">
          <p
            v-if="changelog.summary"
            class="text-sm"
          >
            {{ changelog.summary }}
          </p>
          <MarkdownContent
            v-if="changelog.body"
            :content="changelog.body"
            class="text-sm text-muted-foreground"
          />
        </template>

        <div
          v-else
          class="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <Icon
            icon="icon-[mdi--text-box-outline]"
            class="size-4"
          />
          暂无更新日志
        </div>
      </DialogBody>

      <DialogFooter>
        <Button
          variant="outline"
          @click="open = false"
        >
          关闭
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
