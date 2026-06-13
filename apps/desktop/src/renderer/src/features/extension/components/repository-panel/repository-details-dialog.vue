<!--
Repository Details Dialog shows read-only repository metadata and health fields.
Boundary: no mutations; consumes the repository DTO already loaded by the parent panel.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import type { ExtensionRepositoryInfo } from '@shared/extension'
import {
  formatRepositoryDate,
  formatRepositoryNullable,
  getRepositoryHealthLabel,
  getRepositoryHealthVariant,
  getRepositoryStateLabel,
  getRepositoryStateVariant
} from './display'

interface Props {
  repository: ExtensionRepositoryInfo
  priorityLabel: number
}

const props = defineProps<Props>()
const open = defineModel<boolean>('open', { required: true })

const stateLabel = computed(() => getRepositoryStateLabel(props.repository))
const stateVariant = computed(() => getRepositoryStateVariant(props.repository))
const healthLabel = computed(() => getRepositoryHealthLabel(props.repository))
const healthVariant = computed(() => getRepositoryHealthVariant(props.repository))
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-2xl">
      <DialogHeader>
        <div class="flex items-start gap-3 min-w-0">
          <Icon
            icon="icon-[mdi--source-branch]"
            class="size-6 text-muted-foreground shrink-0"
          />
          <div class="min-w-0 flex-1">
            <DialogTitle>{{ props.repository.name }}</DialogTitle>
            <div class="mt-2 flex flex-wrap items-center gap-2">
              <Badge :variant="stateVariant">{{ stateLabel }}</Badge>
              <Badge :variant="healthVariant">{{ healthLabel }}</Badge>
            </div>
          </div>
        </div>
      </DialogHeader>

      <DialogBody class="max-h-[65vh] overflow-auto space-y-5">
        <section class="space-y-2">
          <div class="text-sm font-medium">基础信息</div>
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div class="min-w-0">
              <dt class="text-muted-foreground">仓库 ID</dt>
              <dd class="font-mono break-all select-text">{{ props.repository.id }}</dd>
            </div>
            <div class="min-w-0">
              <dt class="text-muted-foreground">优先级</dt>
              <dd>{{ props.priorityLabel }}</dd>
            </div>
            <div class="min-w-0">
              <dt class="text-muted-foreground">扩展包</dt>
              <dd>{{ props.repository.packageCount }}</dd>
            </div>
            <div class="min-w-0">
              <dt class="text-muted-foreground">本地状态</dt>
              <dd>{{ stateLabel }}</dd>
            </div>
            <div class="min-w-0 sm:col-span-2">
              <dt class="text-muted-foreground">仓库清单 URL</dt>
              <dd>
                <a
                  :href="props.repository.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="block break-all text-primary hover:underline"
                >
                  {{ props.repository.url }}
                </a>
              </dd>
            </div>
          </dl>
        </section>

        <section class="space-y-2">
          <div class="text-sm font-medium">清单元数据</div>
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div class="min-w-0 sm:col-span-2">
              <dt class="text-muted-foreground">清单摘要</dt>
              <dd class="font-mono break-all select-text">
                {{ formatRepositoryNullable(props.repository.manifestDigest) }}
              </dd>
            </div>
            <div class="min-w-0">
              <dt class="text-muted-foreground">清单更新时间</dt>
              <dd>{{ formatRepositoryDate(props.repository.manifestUpdatedAt) }}</dd>
            </div>
            <div class="min-w-0">
              <dt class="text-muted-foreground">Last-Modified</dt>
              <dd class="break-all select-text">
                {{ formatRepositoryNullable(props.repository.lastModified) }}
              </dd>
            </div>
            <div class="min-w-0 sm:col-span-2">
              <dt class="text-muted-foreground">ETag</dt>
              <dd class="font-mono break-all select-text">
                {{ formatRepositoryNullable(props.repository.etag) }}
              </dd>
            </div>
          </dl>
        </section>

        <section class="space-y-2">
          <div class="text-sm font-medium">刷新状态</div>
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div class="min-w-0">
              <dt class="text-muted-foreground">上次检查</dt>
              <dd>{{ formatRepositoryDate(props.repository.lastRefreshAt) }}</dd>
            </div>
            <div class="min-w-0">
              <dt class="text-muted-foreground">上次成功</dt>
              <dd>{{ formatRepositoryDate(props.repository.lastSuccessAt) }}</dd>
            </div>
            <div
              v-if="props.repository.lastError"
              class="min-w-0 sm:col-span-2"
            >
              <dt class="text-muted-foreground">最近错误</dt>
              <dd class="break-words text-destructive">{{ props.repository.lastError }}</dd>
            </div>
          </dl>
        </section>

        <section class="space-y-2">
          <div class="text-sm font-medium">本地记录</div>
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div class="min-w-0">
              <dt class="text-muted-foreground">创建时间</dt>
              <dd>{{ formatRepositoryDate(props.repository.createdAt) }}</dd>
            </div>
            <div class="min-w-0">
              <dt class="text-muted-foreground">更新时间</dt>
              <dd>{{ formatRepositoryDate(props.repository.updatedAt) }}</dd>
            </div>
          </dl>
        </section>
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
