<!--
Extension Repository Panel manages distributed extension repositories.
Boundary: calls repository IPC only; renderer never fetches manifests directly.
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { Input } from '@renderer/components/ui/input'
import { Switch } from '@renderer/components/ui/switch'
import { Spinner } from '@renderer/components/ui/spinner'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { notify } from '@renderer/core/notify'
import { ipcManager, unwrapIpcData, unwrapIpcVoid } from '@renderer/core/ipc'
import { useAsyncData, useRenderState } from '@renderer/composables'
import type { ExtensionRepositoryInfo } from '@shared/extension'

interface FormData {
  url: string
  name: string
}

const addDialogOpen = ref(false)
const formData = ref<FormData>({
  url: '',
  name: ''
})
const submitting = ref(false)
const refreshingAll = ref(false)
const busyRepositoryIds = ref(new Set<string>())

const {
  data: repositories,
  isLoading,
  error,
  refetch
} = useAsyncData(
  async () => unwrapIpcData(await ipcManager.invoke('extension:list-repositories')),
  { immediate: true }
)
const state = useRenderState(isLoading, error, repositories, { preset: 'network' })
const repositoryList = computed(() =>
  [...(repositories.value ?? [])].sort((left, right) => left.priority - right.priority)
)

let unsubscribeRepositoriesChanged: (() => void) | null = null

onMounted(() => {
  unsubscribeRepositoriesChanged = ipcManager.on('extension:repositories-changed', () => {
    refetch()
  })
})

onUnmounted(() => {
  unsubscribeRepositoriesChanged?.()
})

async function handleAddRepository() {
  if (!formData.value.url.trim()) {
    notify.error('请输入仓库清单 URL')
    return
  }

  submitting.value = true
  try {
    await ipcManager
      .invoke('extension:add-repository', {
        url: formData.value.url.trim(),
        name: formData.value.name.trim() || undefined
      })
      .then(unwrapIpcData)

    notify.success('仓库已添加')
    addDialogOpen.value = false
    formData.value = { url: '', name: '' }
    refetch()
  } catch (err) {
    notify.error('添加仓库失败', err instanceof Error ? err.message : String(err))
  } finally {
    submitting.value = false
  }
}

async function handleRefreshAll() {
  refreshingAll.value = true
  try {
    const results = unwrapIpcData(await ipcManager.invoke('extension:refresh-repositories'))
    const failed = results.filter((result) => result.status === 'failed')
    if (failed.length > 0) {
      notify.error('部分仓库刷新失败', `${failed.length} 个仓库返回错误`)
    } else {
      notify.success('仓库已刷新')
    }
    refetch()
  } catch (err) {
    notify.error('刷新仓库失败', err instanceof Error ? err.message : String(err))
  } finally {
    refreshingAll.value = false
  }
}

async function handleRefreshRepository(repository: ExtensionRepositoryInfo) {
  await withRepositoryBusy(repository.id, async () => {
    const result = unwrapIpcData(
      await ipcManager.invoke('extension:refresh-repository', repository.id)
    )
    if (result.status === 'failed') {
      notify.error('仓库刷新失败', result.error ?? '未知错误')
    } else {
      notify.success(result.status === 'not-modified' ? '仓库未变化' : '仓库已刷新')
    }
    refetch()
  })
}

async function handleToggleRepository(repository: ExtensionRepositoryInfo, enabled: boolean) {
  await withRepositoryBusy(repository.id, async () => {
    await ipcManager
      .invoke('extension:update-repository', {
        id: repository.id,
        state: enabled ? 'enabled' : 'disabled'
      })
      .then(unwrapIpcData)
    notify.success(enabled ? '仓库已启用' : '仓库已禁用')
    refetch()
  })
}

async function handleMovePriority(repository: ExtensionRepositoryInfo, delta: number) {
  await withRepositoryBusy(repository.id, async () => {
    await ipcManager
      .invoke('extension:update-repository', {
        id: repository.id,
        priority: repository.priority + delta
      })
      .then(unwrapIpcData)
    refetch()
  })
}

async function handleRemoveRepository(repository: ExtensionRepositoryInfo) {
  await withRepositoryBusy(repository.id, async () => {
    unwrapIpcVoid(await ipcManager.invoke('extension:remove-repository', repository.id))
    notify.success('仓库已删除')
    refetch()
  })
}

async function withRepositoryBusy(repositoryId: string, run: () => Promise<void>) {
  setRepositoryBusy(repositoryId, true)
  try {
    await run()
  } catch (err) {
    notify.error('仓库操作失败', err instanceof Error ? err.message : String(err))
  } finally {
    setRepositoryBusy(repositoryId, false)
  }
}

function setRepositoryBusy(repositoryId: string, busy: boolean) {
  const next = new Set(busyRepositoryIds.value)
  if (busy) {
    next.add(repositoryId)
  } else {
    next.delete(repositoryId)
  }
  busyRepositoryIds.value = next
}

function healthVariant(
  repository: ExtensionRepositoryInfo
): 'success' | 'warning' | 'destructive' | 'secondary' {
  if (repository.state === 'disabled') {
    return 'secondary'
  }
  if (repository.lastError) {
    return 'destructive'
  }
  if (!repository.lastSuccessAt) {
    return 'warning'
  }
  return 'success'
}

function healthLabel(repository: ExtensionRepositoryInfo): string {
  if (repository.state === 'disabled') {
    return '已禁用'
  }
  if (repository.lastError) {
    return '异常'
  }
  if (!repository.lastSuccessAt) {
    return '未刷新'
  }
  return '正常'
}

function formatDate(value: string | null): string {
  if (!value) {
    return '无'
  }

  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) {
    return value
  }

  return date.toLocaleString()
}

function shortDigest(value: string | null): string {
  return value ? value.slice(0, 12) : '无'
}
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border bg-background/50">
      <div class="flex-1">
        <div class="text-sm font-medium">扩展仓库</div>
        <div class="text-xs text-muted-foreground">
          {{ repositoryList.length }} 个仓库，按优先级聚合发现目录
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        :disabled="refreshingAll"
        @click="handleRefreshAll"
      >
        <Spinner
          v-if="refreshingAll"
          class="size-4"
        />
        <Icon
          v-else
          icon="icon-[mdi--refresh]"
          class="size-4"
        />
        刷新全部
      </Button>
      <Button
        size="sm"
        @click="addDialogOpen = true"
      >
        <Icon
          icon="icon-[mdi--plus]"
          class="size-4"
        />
        添加仓库
      </Button>
    </div>

    <div class="flex-1 overflow-auto scrollbar-thin">
      <template v-if="state === 'loading'">
        <div class="flex items-center justify-center h-48">
          <Spinner class="size-6" />
        </div>
      </template>

      <template v-else-if="repositoryList.length === 0">
        <div class="flex flex-col items-center justify-center h-48 text-muted-foreground">
          <Icon
            icon="icon-[mdi--source-repository]"
            class="size-16 mb-3 opacity-30"
          />
          <p class="font-medium">暂无扩展仓库</p>
        </div>
      </template>

      <template v-else>
        <div class="divide-y divide-border">
          <div
            v-for="repository in repositoryList"
            :key="repository.id"
            class="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-4 py-3 hover:bg-accent/40 transition-colors"
          >
            <div class="min-w-0 space-y-2">
              <div class="flex items-center gap-2 min-w-0">
                <Icon
                  icon="icon-[mdi--source-repository]"
                  class="size-4 text-muted-foreground shrink-0"
                />
                <div class="text-sm font-medium truncate">{{ repository.name }}</div>
                <Badge
                  :variant="healthVariant(repository)"
                  class="text-[10px] h-5"
                >
                  {{ healthLabel(repository) }}
                </Badge>
                <Badge
                  v-if="repository.builtIn"
                  variant="secondary"
                  class="text-[10px] h-5"
                >
                  内置
                </Badge>
              </div>

              <div class="text-xs text-muted-foreground truncate">{{ repository.url }}</div>

              <div
                class="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-1 text-xs text-muted-foreground"
              >
                <div>优先级：{{ repository.priority }}</div>
                <div>包数量：{{ repository.packageCount }}</div>
                <div>清单摘要：{{ shortDigest(repository.manifestDigest) }}</div>
                <div>更新时间：{{ formatDate(repository.manifestUpdatedAt) }}</div>
                <div>上次刷新：{{ formatDate(repository.lastRefreshAt) }}</div>
                <div>上次成功：{{ formatDate(repository.lastSuccessAt) }}</div>
                <div>ETag：{{ repository.etag ?? '无' }}</div>
                <div>Last-Modified：{{ repository.lastModified ?? '无' }}</div>
              </div>

              <div
                v-if="repository.lastError"
                class="text-xs text-destructive"
              >
                {{ repository.lastError }}
              </div>
            </div>

            <div class="flex items-center gap-1">
              <Switch
                :model-value="repository.state === 'enabled'"
                :disabled="busyRepositoryIds.has(repository.id)"
                @update:model-value="
                  (enabled) => handleToggleRepository(repository, Boolean(enabled))
                "
              />
              <Button
                variant="ghost"
                size="icon-sm"
                :disabled="busyRepositoryIds.has(repository.id)"
                @click="handleRefreshRepository(repository)"
              >
                <Spinner
                  v-if="busyRepositoryIds.has(repository.id)"
                  class="size-3"
                />
                <Icon
                  v-else
                  icon="icon-[mdi--refresh]"
                  class="size-4"
                />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                :disabled="busyRepositoryIds.has(repository.id)"
                @click="handleMovePriority(repository, -1)"
              >
                <Icon
                  icon="icon-[mdi--arrow-up]"
                  class="size-4"
                />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                :disabled="busyRepositoryIds.has(repository.id)"
                @click="handleMovePriority(repository, 1)"
              >
                <Icon
                  icon="icon-[mdi--arrow-down]"
                  class="size-4"
                />
              </Button>
              <Button
                v-if="!repository.builtIn"
                variant="ghost"
                size="icon-sm"
                :disabled="busyRepositoryIds.has(repository.id)"
                class="hover:text-destructive"
                @click="handleRemoveRepository(repository)"
              >
                <Icon
                  icon="icon-[mdi--delete-outline]"
                  class="size-4"
                />
              </Button>
            </div>
          </div>
        </div>
      </template>
    </div>

    <Dialog v-model:open="addDialogOpen">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>添加扩展仓库</DialogTitle>
        </DialogHeader>
        <DialogBody class="space-y-3">
          <div class="space-y-1.5">
            <label class="text-xs text-muted-foreground">仓库清单 URL</label>
            <Input
              v-model="formData.url"
              placeholder="https://example.com/extensions/manifest.json"
              @keydown.enter="handleAddRepository"
            />
          </div>
          <div class="space-y-1.5">
            <label class="text-xs text-muted-foreground">显示名称</label>
            <Input
              v-model="formData.name"
              placeholder="留空使用仓库清单名称"
              @keydown.enter="handleAddRepository"
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            :disabled="submitting"
            @click="addDialogOpen = false"
          >
            取消
          </Button>
          <Button
            :disabled="submitting || !formData.url.trim()"
            @click="handleAddRepository"
          >
            <Spinner
              v-if="submitting"
              class="size-4"
            />
            添加
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
