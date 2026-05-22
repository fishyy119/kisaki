<!--
Installed Extension Details Dialog shows read-only metadata for one installed extension.
Boundary: no mutations; includes provenance and verification metadata for troubleshooting.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import type { ExtensionInstalledPackageInfo } from '@shared/extension'
import { EXTENSION_CATEGORIES } from '../../types/constants'

interface Props {
  extension: ExtensionInstalledPackageInfo
}

const props = defineProps<Props>()
const open = defineModel<boolean>('open', { required: true })
const iconError = ref(false)

const iconUrl = computed(() => props.extension.iconUrl)
const repositorySource = computed(() =>
  props.extension.installationSource?.kind === 'repository'
    ? props.extension.installationSource
    : null
)
const localFileSource = computed(() =>
  props.extension.installationSource?.kind === 'local-file'
    ? props.extension.installationSource
    : null
)
const categoryLabels = computed(() => {
  const labelMap = new Map(EXTENSION_CATEGORIES.map((category) => [category.id, category.label]))
  const labels = props.extension.categories.map((category) => labelMap.get(category) ?? category)
  return labels.length > 0 ? labels.join('、') : '未分类'
})
const versionLabel = computed(() =>
  props.extension.version ? `v${props.extension.version}` : '未知版本'
)
const sourceKindLabel = computed(() => {
  if (props.extension.builtin) {
    return '内置扩展'
  }

  if (repositorySource.value) {
    return '仓库安装'
  }

  if (localFileSource.value) {
    return '本地文件'
  }

  return '未知来源'
})
const packageStatusLabel = computed(() => {
  switch (props.extension.status) {
    case 'ready':
      return '正常'
    case 'invalid':
      return '包无效'
    case 'missing-package':
      return '包缺失'
  }
})
const runtimeStatusLabel = computed(() => {
  if (!props.extension.enabled || props.extension.status !== 'ready') {
    return '未运行'
  }

  switch (props.extension.runtimeStatus) {
    case 'running':
      return '运行中'
    case 'failed':
      return '加载失败'
    case 'stopped':
      return '未运行'
  }
})
const updatePolicyLabel = computed(() => {
  switch (props.extension.updatePolicy ?? 'manual') {
    case 'manual':
      return '手动'
    case 'auto':
      return '自动'
    case 'pinned':
      return '锁定'
  }
})

watch(iconUrl, () => {
  iconError.value = false
})

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '未知时间'
  }

  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) {
    return value
  }

  return date.toLocaleString()
}

function formatBoolean(value: boolean | null | undefined): string {
  return value ? '是' : '否'
}

function diagnosticSeverityLabel(severity: string): string {
  switch (severity) {
    case 'info':
      return '信息'
    case 'warning':
      return '警告'
    case 'error':
      return '错误'
    default:
      return severity
  }
}

function diagnosticSeverityClass(severity: string): string {
  switch (severity) {
    case 'info':
      return 'text-sky-600'
    case 'warning':
      return 'text-amber-600'
    case 'error':
      return 'text-destructive'
    default:
      return 'text-muted-foreground'
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-2xl">
      <DialogHeader>
        <div class="flex items-start gap-3 min-w-0">
          <img
            v-if="iconUrl && !iconError"
            :src="iconUrl"
            alt=""
            class="size-9 rounded-md border shrink-0"
            @error="iconError = true"
          />
          <Icon
            v-else
            icon="icon-[mdi--puzzle-outline]"
            class="size-9 text-muted-foreground shrink-0"
          />
          <div class="min-w-0 flex-1">
            <DialogTitle>{{ props.extension.name }}</DialogTitle>
            <DialogDescription
              v-if="props.extension.description"
              class="mt-1"
            >
              {{ props.extension.description }}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <DialogBody class="max-h-[65vh] overflow-auto scrollbar-thin space-y-5">
        <section class="space-y-2">
          <div class="text-sm font-medium">基础信息</div>
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div class="min-w-0 sm:col-span-2">
              <dt class="text-muted-foreground">扩展 ID</dt>
              <dd class="font-mono break-all select-text">{{ props.extension.id }}</dd>
            </div>
            <div class="min-w-0">
              <dt class="text-muted-foreground">版本</dt>
              <dd>{{ versionLabel }}</dd>
            </div>
            <div class="min-w-0">
              <dt class="text-muted-foreground">作者</dt>
              <dd>{{ props.extension.author || '未知作者' }}</dd>
            </div>
            <div class="min-w-0">
              <dt class="text-muted-foreground">类别</dt>
              <dd>{{ categoryLabels }}</dd>
            </div>
            <div
              v-if="props.extension.installedAt"
              class="min-w-0"
            >
              <dt class="text-muted-foreground">安装时间</dt>
              <dd>{{ formatDate(props.extension.installedAt) }}</dd>
            </div>
            <div
              v-if="props.extension.homepage"
              class="min-w-0 sm:col-span-2"
            >
              <dt class="text-muted-foreground">主页</dt>
              <dd>
                <a
                  :href="props.extension.homepage"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="block truncate text-primary hover:underline"
                >
                  {{ props.extension.homepage }}
                </a>
              </dd>
            </div>
          </dl>
        </section>

        <section class="space-y-2">
          <div class="text-sm font-medium">状态</div>
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div class="min-w-0">
              <dt class="text-muted-foreground">启用状态</dt>
              <dd>{{ props.extension.enabled ? '已启用' : '已禁用' }}</dd>
            </div>
            <div class="min-w-0">
              <dt class="text-muted-foreground">包状态</dt>
              <dd>{{ packageStatusLabel }}</dd>
            </div>
            <div class="min-w-0">
              <dt class="text-muted-foreground">运行状态</dt>
              <dd>{{ runtimeStatusLabel }}</dd>
            </div>
            <div
              v-if="props.extension.runtimeError"
              class="min-w-0 sm:col-span-2"
            >
              <dt class="text-muted-foreground">运行错误</dt>
              <dd class="break-words text-destructive">{{ props.extension.runtimeError }}</dd>
            </div>
          </dl>
        </section>

        <section class="space-y-2">
          <div class="text-sm font-medium">安装来源</div>
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div class="min-w-0">
              <dt class="text-muted-foreground">类型</dt>
              <dd>{{ sourceKindLabel }}</dd>
            </div>
            <template v-if="repositorySource">
              <div class="min-w-0 sm:col-span-2">
                <dt class="text-muted-foreground">仓库</dt>
                <dd>
                  <a
                    :href="repositorySource.repositoryUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="block break-all text-primary hover:underline"
                  >
                    {{ repositorySource.repositoryUrl }}
                  </a>
                </dd>
              </div>
              <div class="min-w-0 sm:col-span-2">
                <dt class="text-muted-foreground">发布摘要</dt>
                <dd class="font-mono break-all select-text">{{ repositorySource.releaseId }}</dd>
              </div>
              <div class="min-w-0 sm:col-span-2">
                <dt class="text-muted-foreground">清单摘要</dt>
                <dd class="font-mono break-all select-text">
                  {{ repositorySource.manifestDigest }}
                </dd>
              </div>
              <div class="min-w-0 sm:col-span-2">
                <dt class="text-muted-foreground">安装包 SHA256</dt>
                <dd class="font-mono break-all select-text">
                  {{ repositorySource.artifact.sha256 }}
                </dd>
              </div>
              <div
                v-if="repositorySource.signature?.fingerprint"
                class="min-w-0 sm:col-span-2"
              >
                <dt class="text-muted-foreground">签名指纹</dt>
                <dd class="font-mono break-all select-text">
                  {{ repositorySource.signature.fingerprint }}
                </dd>
              </div>
              <div class="min-w-0">
                <dt class="text-muted-foreground">发布版本</dt>
                <dd>v{{ repositorySource.snapshot.release.version }}</dd>
              </div>
              <div class="min-w-0">
                <dt class="text-muted-foreground">发布时间</dt>
                <dd>{{ formatDate(repositorySource.snapshot.release.publishedAt) }}</dd>
              </div>
              <div class="min-w-0">
                <dt class="text-muted-foreground">Kisaki</dt>
                <dd>{{ repositorySource.snapshot.release.engines.kisaki }}</dd>
              </div>
            </template>
            <template v-else-if="localFileSource">
              <div class="min-w-0 sm:col-span-2">
                <dt class="text-muted-foreground">文件</dt>
                <dd class="break-all select-text">{{ localFileSource.path }}</dd>
              </div>
              <div class="min-w-0 sm:col-span-2">
                <dt class="text-muted-foreground">安装包 SHA256</dt>
                <dd class="font-mono break-all select-text">
                  {{ localFileSource.artifactSha256 }}
                </dd>
              </div>
            </template>
            <div class="min-w-0 sm:col-span-2">
              <dt class="text-muted-foreground">安装目录</dt>
              <dd class="break-all select-text">{{ props.extension.directory }}</dd>
            </div>
          </dl>
        </section>

        <section
          v-if="!props.extension.builtin"
          class="space-y-2"
        >
          <div class="text-sm font-medium">更新配置</div>
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div class="min-w-0">
              <dt class="text-muted-foreground">更新策略</dt>
              <dd>{{ updatePolicyLabel }}</dd>
            </div>
            <div
              v-if="props.extension.updatePolicy === 'pinned' && props.extension.pinnedVersion"
              class="min-w-0"
            >
              <dt class="text-muted-foreground">锁定版本</dt>
              <dd>v{{ props.extension.pinnedVersion }}</dd>
            </div>
            <div class="min-w-0">
              <dt class="text-muted-foreground">接收预览版更新</dt>
              <dd>{{ formatBoolean(props.extension.includePreviewUpdates) }}</dd>
            </div>
          </dl>
        </section>

        <section
          v-if="props.extension.issues.length > 0"
          class="space-y-2"
        >
          <div class="text-sm font-medium">包问题</div>
          <ul class="space-y-1 text-xs text-destructive">
            <li
              v-for="issue in props.extension.issues"
              :key="issue"
              class="break-words"
            >
              {{ issue }}
            </li>
          </ul>
        </section>

        <section
          v-if="props.extension.runtimeDiagnostics.length > 0"
          class="space-y-2"
        >
          <div class="text-sm font-medium">运行诊断</div>
          <div class="space-y-2 text-xs">
            <div
              v-for="diagnostic in props.extension.runtimeDiagnostics"
              :key="`${diagnostic.source}:${diagnostic.code}:${diagnostic.createdAt}`"
              class="rounded-md border border-border px-3 py-2 space-y-1"
            >
              <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span
                  class="font-medium"
                  :class="diagnosticSeverityClass(diagnostic.severity)"
                >
                  {{ diagnosticSeverityLabel(diagnostic.severity) }}
                </span>
                <span class="text-muted-foreground">{{ diagnostic.source }}</span>
                <span class="text-muted-foreground">{{ formatDate(diagnostic.createdAt) }}</span>
              </div>
              <div class="break-words">{{ diagnostic.message }}</div>
              <div
                v-if="diagnostic.details"
                class="break-words text-muted-foreground"
              >
                {{ diagnostic.details }}
              </div>
            </div>
          </div>
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
