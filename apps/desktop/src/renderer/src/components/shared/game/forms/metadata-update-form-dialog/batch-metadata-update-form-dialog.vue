<!--
  GameBatchMetadataUpdateFormDialog
  Starts a main-process batch metadata update for selected games.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ipcManager } from '@renderer/core/ipc'
import { notify } from '@renderer/core/notify'
import {
  GAME_UPDATE_SURFACE_KEYS,
  type GameUpdateSurface,
  type IngestUpdatePolicy
} from '@shared/ingest/update'
import { ScraperProfileSelect } from '@renderer/components/shared/scraper'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { Checkbox } from '@renderer/components/ui/checkbox'
import { Label } from '@renderer/components/ui/label'
import { Form } from '@renderer/components/ui/form'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import {
  Field,
  FieldLabel,
  FieldContent,
  FieldGroup,
  FieldDescription
} from '@renderer/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'

interface Props {
  gameIds: string[]
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const openModel = computed({
  get: () => open.value,
  set: (value) => {
    if (!isSubmitting.value) {
      open.value = value
    }
  }
})

const isSubmitting = ref(false)
const profileId = ref('')
const singularUpdate = ref<IngestUpdatePolicy['singularUpdate']>('overwrite')
const collectionUpdate = ref<IngestUpdatePolicy['collectionUpdate']>('replace')
const selectedSurfaces = ref<GameUpdateSurface[]>([...GAME_UPDATE_SURFACE_KEYS])
const useCurrentExternalIdsAsKnownIds = ref(true)

const SURFACE_LABELS: Record<GameUpdateSurface, string> = {
  name: '名称',
  originalName: '原名',
  releaseDate: '发售日期',
  description: '简介',
  relatedSites: '相关链接',
  externalIds: '外部 ID',
  tags: '标签',
  person: '人物',
  company: '公司',
  character: '角色',
  covers: '封面',
  backdrops: '背景',
  logos: '徽标',
  icons: '图标'
}

const selectedCount = computed(() => props.gameIds.length)

const canSubmit = computed(() => {
  return (
    !!profileId.value &&
    selectedSurfaces.value.length > 0 &&
    selectedCount.value > 0 &&
    !isSubmitting.value
  )
})

function toggleSurface(surface: GameUpdateSurface, nextValue: boolean) {
  const current = selectedSurfaces.value
  if (nextValue) {
    if (!current.includes(surface)) selectedSurfaces.value = [...current, surface]
    return
  }
  selectedSurfaces.value = current.filter((item) => item !== surface)
}

function handleSelectAllSurfaces() {
  selectedSurfaces.value = [...GAME_UPDATE_SURFACE_KEYS]
}

function handleSelectNoSurfaces() {
  selectedSurfaces.value = []
}

watch(
  () => open.value,
  (isOpen) => {
    if (!isOpen) return
    isSubmitting.value = false
    profileId.value = ''
    singularUpdate.value = 'overwrite'
    collectionUpdate.value = 'replace'
    selectedSurfaces.value = [...GAME_UPDATE_SURFACE_KEYS]
    useCurrentExternalIdsAsKnownIds.value = true
  }
)

async function handleSubmit() {
  if (!profileId.value) return
  if (props.gameIds.length === 0) return
  if (selectedSurfaces.value.length === 0) return

  const request = {
    rootIds: [...props.gameIds],
    profileId: profileId.value,
    selection: { surfaces: [...selectedSurfaces.value] },
    policy: {
      singularUpdate: singularUpdate.value,
      collectionUpdate: collectionUpdate.value
    } satisfies IngestUpdatePolicy,
    useCurrentExternalIdsAsKnownIds: useCurrentExternalIdsAsKnownIds.value
  }

  open.value = false
  isSubmitting.value = true

  try {
    const result = await ipcManager.invoke('ingest:batch-update-game-from-scraper', request)
    if (!result.success) {
      notify.error('启动批量更新失败', result.error)
    }
  } catch (error) {
    notify.error('启动批量更新失败', error instanceof Error ? error.message : '未知错误')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="openModel">
    <DialogContent class="max-w-3xl">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Icon
            icon="icon-[mdi--database-sync-outline]"
            class="size-4"
          />
          批量更新元数据
          <span class="text-xs text-muted-foreground">{{ selectedCount }} 个游戏</span>
        </DialogTitle>
      </DialogHeader>

      <Form @submit="handleSubmit">
          <DialogBody class="space-y-4 max-h-[70vh] overflow-y-auto scrollbar-thin">
            <FieldGroup>
              <Field>
                <FieldLabel>刮削器配置</FieldLabel>
                <FieldContent>
                  <ScraperProfileSelect
                    v-model="profileId"
                    media-type="game"
                  />
                </FieldContent>
              </Field>
            </FieldGroup>

            <FieldGroup>
              <Field>
                <FieldLabel>更新项</FieldLabel>
                <FieldContent>
                  <div class="flex items-center gap-2 pb-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      :disabled="isSubmitting"
                      @click="handleSelectAllSurfaces"
                    >
                      全选
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      :disabled="isSubmitting"
                      @click="handleSelectNoSurfaces"
                    >
                      全不选
                    </Button>
                  </div>

                  <div class="grid grid-cols-2 gap-x-6 gap-y-2">
                    <div
                      v-for="surface in GAME_UPDATE_SURFACE_KEYS"
                      :key="surface"
                      class="flex items-center gap-2"
                    >
                      <Checkbox
                        :id="`core-surface-${surface}`"
                        :model-value="selectedSurfaces.includes(surface)"
                        :disabled="isSubmitting"
                        @update:model-value="(value) => toggleSurface(surface, !!value)"
                      />
                      <Label
                        :for="`core-surface-${surface}`"
                        class="text-sm font-normal cursor-pointer"
                      >
                        {{ SURFACE_LABELS[surface] }}
                      </Label>
                    </div>
                  </div>
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel>单值策略</FieldLabel>
                <FieldContent>
                  <Select
                    v-model="singularUpdate"
                    :disabled="isSubmitting"
                  >
                    <SelectTrigger class="w-full">
                      <SelectValue placeholder="选择单值策略..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ifMissing">仅缺失时写入</SelectItem>
                      <SelectItem value="overwrite">覆盖现有值</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldContent>
                <FieldDescription>
                  {{
                    singularUpdate === 'ifMissing'
                      ? '仅在当前值缺失时写入新值'
                      : '如存在可用新值，则覆盖当前值'
                  }}
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel>集合策略</FieldLabel>
                <FieldContent>
                  <Select
                    v-model="collectionUpdate"
                    :disabled="isSubmitting"
                  >
                    <SelectTrigger class="w-full">
                      <SelectValue placeholder="选择集合策略..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="merge">合并追加</SelectItem>
                      <SelectItem value="replace">整体替换</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldContent>
                <FieldDescription>
                  {{
                    collectionUpdate === 'merge'
                      ? '保留现有内容，并追加新增内容'
                      : '以新内容整体替换当前内容'
                  }}
                </FieldDescription>
              </Field>

              <Field orientation="horizontal">
                <FieldLabel>使用当前外部 ID 辅助定位</FieldLabel>
                <FieldContent>
                  <Checkbox
                    id="use-current-external-ids"
                    v-model="useCurrentExternalIdsAsKnownIds"
                    :disabled="isSubmitting"
                  />
                </FieldContent>
                <FieldDescription>若当前条目可能对应错误目标，请勿启用此项。</FieldDescription>
              </Field>
            </FieldGroup>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              :disabled="isSubmitting"
              @click="open = false"
            >
              关闭
            </Button>
            <Button
              type="submit"
              :disabled="!canSubmit"
            >
              <template v-if="isSubmitting">
                <Icon
                  icon="icon-[mdi--loading]"
                  class="size-4 animate-spin"
                />
                更新中...
              </template>
              <template v-else>
                <Icon
                  icon="icon-[mdi--refresh]"
                  class="size-4"
                />
                更新
              </template>
            </Button>
          </DialogFooter>
      </Form>
    </DialogContent>
  </Dialog>
</template>
