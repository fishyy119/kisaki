<!--
Repository Details Dialog shows read-only repository metadata and health fields.
Boundary: no mutations; consumes the repository DTO already loaded by the parent panel.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@renderer/composables/use-i18n'
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

const { m } = useI18n()

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

      <DialogBody class="max-h-[65vh] space-y-5">
        <section class="space-y-2">
          <div class="text-sm font-medium">{{ m.extension.repository.details.basicInfo }}</div>
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div class="min-w-0">
              <dt class="text-muted-foreground">
                {{ m.extension.repository.details.repositoryId }}
              </dt>
              <dd class="font-mono break-all select-text">{{ props.repository.id }}</dd>
            </div>
            <div class="min-w-0">
              <dt class="text-muted-foreground">{{ m.extension.repository.details.priority }}</dt>
              <dd>{{ props.priorityLabel }}</dd>
            </div>
            <div class="min-w-0">
              <dt class="text-muted-foreground">{{ m.extension.repository.details.packages }}</dt>
              <dd>{{ props.repository.packageCount }}</dd>
            </div>
            <div class="min-w-0">
              <dt class="text-muted-foreground">{{ m.extension.repository.details.localState }}</dt>
              <dd>{{ stateLabel }}</dd>
            </div>
            <div class="min-w-0 sm:col-span-2">
              <dt class="text-muted-foreground">
                {{ m.extension.repository.details.manifestUrl }}
              </dt>
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
          <div class="text-sm font-medium">
            {{ m.extension.repository.details.manifestMetadata }}
          </div>
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div class="min-w-0 sm:col-span-2">
              <dt class="text-muted-foreground">
                {{ m.extension.repository.details.manifestDigest }}
              </dt>
              <dd class="font-mono break-all select-text">
                {{ formatRepositoryNullable(props.repository.manifestDigest) }}
              </dd>
            </div>
            <div class="min-w-0">
              <dt class="text-muted-foreground">
                {{ m.extension.repository.details.manifestUpdatedAt }}
              </dt>
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
          <div class="text-sm font-medium">{{ m.extension.repository.details.refreshState }}</div>
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div class="min-w-0">
              <dt class="text-muted-foreground">
                {{ m.extension.repository.details.lastChecked }}
              </dt>
              <dd>{{ formatRepositoryDate(props.repository.lastRefreshAt) }}</dd>
            </div>
            <div class="min-w-0">
              <dt class="text-muted-foreground">
                {{ m.extension.repository.details.lastSuccess }}
              </dt>
              <dd>{{ formatRepositoryDate(props.repository.lastSuccessAt) }}</dd>
            </div>
            <div
              v-if="props.repository.lastError"
              class="min-w-0 sm:col-span-2"
            >
              <dt class="text-muted-foreground">{{ m.extension.repository.details.lastError }}</dt>
              <dd class="break-words text-destructive">{{ props.repository.lastError }}</dd>
            </div>
          </dl>
        </section>

        <section class="space-y-2">
          <div class="text-sm font-medium">{{ m.extension.repository.details.localRecord }}</div>
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div class="min-w-0">
              <dt class="text-muted-foreground">{{ m.extension.repository.details.createdAt }}</dt>
              <dd>{{ formatRepositoryDate(props.repository.createdAt) }}</dd>
            </div>
            <div class="min-w-0">
              <dt class="text-muted-foreground">{{ m.extension.repository.details.updatedAt }}</dt>
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
          {{ m.actions.close }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
