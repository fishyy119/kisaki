<!--
Extension Install Dialog installs extensions from supported sources.
Boundary: owns install-source inputs and delegates work to main over IPC.
-->
<script setup lang="ts">
import { ref, watch } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { notify } from '@renderer/core/notify'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Field, FieldContent, FieldLabel, FieldDescription } from '@renderer/components/ui/field'
import { Spinner } from '@renderer/components/ui/spinner'
import { ipcManager, unwrapIpcData, unwrapIpcVoid } from '@renderer/core/ipc'
import type { ExtensionInstallPlan } from '@shared/extension'

type InstallMethod = 'github' | 'url' | 'local'

interface Emits {
  (e: 'installed'): void
}

const emit = defineEmits<Emits>()
const open = defineModel<boolean>('open', { required: true })

const method = ref<InstallMethod>('github')
const installing = ref(false)

// GitHub method state
const githubRepo = ref('')

// URL method state
const extensionUrl = ref('')
const localFilePath = ref<string | null>(null)
const localInstallPlan = ref<ExtensionInstallPlan | null>(null)

// Reset form when dialog opens
watch(open, (isOpen) => {
  if (isOpen) {
    method.value = 'github'
    githubRepo.value = ''
    extensionUrl.value = ''
    localFilePath.value = null
    localInstallPlan.value = null
    installing.value = false
  }
})

async function handleInstallFromGitHub() {
  if (!githubRepo.value.trim()) {
    notify.error('请输入仓库地址')
    return
  }

  // Validate format: owner/repo
  const repoPattern = /^[\w.-]+\/[\w.-]+$/
  if (!repoPattern.test(githubRepo.value.trim())) {
    notify.error('格式错误', '请使用 owner/repo 格式')
    return
  }

  installing.value = true
  try {
    const source = `github:${githubRepo.value.trim()}`
    unwrapIpcVoid(await ipcManager.invoke('extension:install', source))

    notify.success('扩展安装成功')
    githubRepo.value = ''
    open.value = false
    emit('installed')
  } catch (error) {
    notify.error('安装失败', error instanceof Error ? error.message : String(error))
  } finally {
    installing.value = false
  }
}

async function handleInstallFromUrl() {
  if (!extensionUrl.value.trim()) {
    notify.error('请输入下载地址')
    return
  }

  // Basic URL validation
  try {
    new URL(extensionUrl.value.trim())
  } catch {
    notify.error('格式错误', '请输入有效的 URL')
    return
  }

  installing.value = true
  try {
    unwrapIpcVoid(await ipcManager.invoke('extension:install', extensionUrl.value.trim()))

    notify.success('扩展安装成功')
    extensionUrl.value = ''
    open.value = false
    emit('installed')
  } catch (error) {
    notify.error('安装失败', error instanceof Error ? error.message : String(error))
  } finally {
    installing.value = false
  }
}

async function handleInstallFromFile() {
  installing.value = true
  try {
    const res = await ipcManager.invoke('native:open-dialog', {
      title: '选择扩展文件',
      filters: [{ name: '扩展包', extensions: ['kisx'] }],
      properties: ['openFile']
    })

    if (res.success && res.data && !res.data.canceled && res.data.filePaths.length > 0) {
      const filePath = res.data.filePaths[0]
      localFilePath.value = filePath
      localInstallPlan.value = unwrapIpcData(
        await ipcManager.invoke('extension:create-install-plan', {
          sourceKind: 'local-file',
          filePath
        })
      )
    }
  } catch (error) {
    localFilePath.value = null
    localInstallPlan.value = null
    notify.error('无法创建安装计划', error instanceof Error ? error.message : String(error))
  } finally {
    installing.value = false
  }
}

async function handleConfirmLocalInstall() {
  const plan = localInstallPlan.value
  const filePath = localFilePath.value
  if (!plan || !filePath) {
    await handleInstallFromFile()
    return
  }

  installing.value = true
  try {
    unwrapIpcVoid(
      await ipcManager.invoke('extension:install-from-file', {
        operationId: createOperationId(),
        filePath,
        planId: plan.id,
        planFingerprint: plan.fingerprint,
        acceptedRiskIds: plan.risks.map((risk) => risk.id),
        enabled: plan.defaultEnabled
      })
    )

    notify.success('扩展安装成功')
    localFilePath.value = null
    localInstallPlan.value = null
    open.value = false
    emit('installed')
  } catch (error) {
    notify.error('安装失败', error instanceof Error ? error.message : String(error))
  } finally {
    installing.value = false
  }
}

function createOperationId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>安装扩展</DialogTitle>
        <DialogDescription>选择安装来源以添加新扩展</DialogDescription>
      </DialogHeader>
      <DialogBody>
        <Tabs v-model="method">
          <TabsList class="w-full">
            <TabsTrigger
              value="github"
              class="flex-1 gap-1.5"
            >
              <Icon
                icon="icon-[mdi--github]"
                class="size-4"
              />
              GitHub
            </TabsTrigger>
            <TabsTrigger
              value="url"
              class="flex-1 gap-1.5"
            >
              <Icon
                icon="icon-[mdi--link]"
                class="size-4"
              />
              URL
            </TabsTrigger>
            <TabsTrigger
              value="local"
              class="flex-1 gap-1.5"
            >
              <Icon
                icon="icon-[mdi--folder-open-outline]"
                class="size-4"
              />
              本地
            </TabsTrigger>
          </TabsList>

          <!-- GitHub installation -->
          <TabsContent
            value="github"
            class="space-y-4"
          >
            <Field>
              <FieldLabel>仓库地址</FieldLabel>
              <FieldDescription>输入 GitHub 仓库的 owner/repo 格式</FieldDescription>
              <FieldContent>
                <Input
                  v-model="githubRepo"
                  placeholder="例如: ximu3/vndb-scraper"
                  @keydown.enter="handleInstallFromGitHub"
                />
              </FieldContent>
            </Field>
          </TabsContent>

          <!-- URL installation -->
          <TabsContent
            value="url"
            class="space-y-4"
          >
            <Field>
              <FieldLabel>下载地址</FieldLabel>
              <FieldDescription>输入扩展包 (.kisx) 的直接下载链接</FieldDescription>
              <FieldContent>
                <Input
                  v-model="extensionUrl"
                  placeholder="https://example.com/extension.kisx"
                  @keydown.enter="handleInstallFromUrl"
                />
              </FieldContent>
            </Field>
          </TabsContent>

          <!-- Local installation -->
          <TabsContent
            value="local"
            class="space-y-4"
          >
            <div
              v-if="!localInstallPlan"
              class="text-center py-6 border border-dashed border-border rounded-lg"
            >
              <Icon
                icon="icon-[mdi--folder-zip-outline]"
                class="size-12 text-muted-foreground/50 mx-auto mb-3"
              />
              <p class="text-sm text-muted-foreground mb-4">选择本地扩展包文件 (.kisx)</p>
            </div>
            <div
              v-else
              class="space-y-3"
            >
              <div class="rounded-md border border-border p-3">
                <div class="flex items-start gap-2">
                  <Icon
                    icon="icon-[mdi--package-variant-closed]"
                    class="size-5 text-muted-foreground shrink-0 mt-0.5"
                  />
                  <div class="min-w-0 flex-1">
                    <div class="text-sm font-medium truncate">
                      {{ localInstallPlan.package.name }}
                    </div>
                    <div class="text-xs text-muted-foreground">
                      v{{ localInstallPlan.package.targetVersion }} · 本地导入 · unsigned
                    </div>
                    <div class="mt-2 text-xs text-muted-foreground break-all">
                      SHA256: {{ localInstallPlan.localFile?.sha256 }}
                    </div>
                  </div>
                </div>
              </div>

              <div
                v-if="localInstallPlan.risks.length > 0"
                class="rounded-md border border-warning/40 bg-warning/5 p-3 text-xs"
              >
                <div class="font-medium mb-2">需要确认</div>
                <ul class="space-y-1 text-muted-foreground">
                  <li
                    v-for="risk in localInstallPlan.risks"
                    :key="risk.id"
                  >
                    {{ risk.message }}
                  </li>
                </ul>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogBody>

      <DialogFooter>
        <Button
          v-if="method === 'github'"
          class="w-full"
          :disabled="installing || !githubRepo.trim()"
          @click="handleInstallFromGitHub"
        >
          <Spinner
            v-if="installing"
            class="size-4 mr-2"
          />
          安装
        </Button>
        <Button
          v-if="method === 'url'"
          class="w-full"
          :disabled="installing || !extensionUrl.trim()"
          @click="handleInstallFromUrl"
        >
          <Spinner
            v-if="installing"
            class="size-4 mr-2"
          />
          安装
        </Button>
        <Button
          v-if="method === 'local'"
          class="w-full"
          :disabled="installing"
          @click="localInstallPlan ? handleConfirmLocalInstall() : handleInstallFromFile()"
        >
          <Spinner
            v-if="installing"
            class="size-4 mr-2"
          />
          {{ localInstallPlan ? '确认安装' : '选择文件' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
