<!--
  CharacterBatchMetadataUpdateFormDialog
  Batch update character metadata through renderer-local lookup plus the main-process ingest service.
-->
<script setup lang="ts">
import { computed, ref, toRaw, watch } from 'vue'
import { eq, inArray } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { notify } from '@renderer/core/notify'
import { useAsyncData } from '@renderer/composables'
import { characterExternalIds, characters, scraperProfiles } from '@shared/db'
import type { ExternalId } from '@shared/identity'
import {
  CHARACTER_UPDATE_SURFACE_KEYS,
  type CharacterUpdateRequest,
  type CharacterUpdateSurface,
  type IngestUpdatePolicy
} from '@shared/ingest/update'
import { buildIngestUpdateLookup } from '@renderer/utils'
import { ScraperProfileSelect } from '@renderer/components/shared/scraper'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { Checkbox } from '@renderer/components/ui/checkbox'
import { Label } from '@renderer/components/ui/label'
import { Spinner } from '@renderer/components/ui/spinner'
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
  characterIds: string[]
}

interface BatchRow {
  id: string
  name: string
  originalName: string | null
  externalIds: ExternalId[]
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
const selectedSurfaces = ref<CharacterUpdateSurface[]>([...CHARACTER_UPDATE_SURFACE_KEYS])
const useCurrentExternalIdsAsKnownIds = ref(true)

const SURFACE_LABELS: Record<CharacterUpdateSurface, string> = {
  name: '名称',
  originalName: '原名',
  birthDate: '生日',
  gender: '性别',
  age: '年龄',
  bloodType: '血型',
  height: '身高',
  weight: '体重',
  bust: '胸围',
  waist: '腰围',
  hips: '臀围',
  cup: '罩杯',
  description: '简介',
  relatedSites: '相关链接',
  externalIds: '外部 ID',
  tags: '标签',
  person: '人物',
  photos: '照片'
}

const selectedCount = computed(() => props.characterIds.length)

const { data, isLoading } = useAsyncData(
  async () => {
    const ids = props.characterIds
    if (ids.length === 0) return []

    const rows = await db
      .select({ id: characters.id, name: characters.name, originalName: characters.originalName })
      .from(characters)
      .where(inArray(characters.id, ids))

    const extRows = await db
      .select({
        characterId: characterExternalIds.characterId,
        source: characterExternalIds.source,
        id: characterExternalIds.externalId
      })
      .from(characterExternalIds)
      .where(inArray(characterExternalIds.characterId, ids))

    const byId = new Map<string, ExternalId[]>()
    for (const ext of extRows) {
      const list = byId.get(ext.characterId) ?? []
      list.push({ source: ext.source, id: ext.id })
      byId.set(ext.characterId, list)
    }

    const rowById = new Map(rows.map((row) => [row.id, row] as const))
    const out: BatchRow[] = []

    for (const id of ids) {
      const row = rowById.get(id)
      if (!row) continue

      out.push({
        id: row.id,
        name: row.name,
        originalName: row.originalName ?? null,
        externalIds: byId.get(row.id) ?? []
      })
    }

    return out
  },
  { watch: [() => props.characterIds], enabled: () => open.value }
)

const canSubmit = computed(() => {
  return (
    !!profileId.value &&
    selectedSurfaces.value.length > 0 &&
    selectedCount.value > 0 &&
    !isSubmitting.value
  )
})

function toggleSurface(surface: CharacterUpdateSurface, nextValue: boolean) {
  const current = selectedSurfaces.value
  if (nextValue) {
    if (!current.includes(surface)) selectedSurfaces.value = [...current, surface]
    return
  }
  selectedSurfaces.value = current.filter((item) => item !== surface)
}

function handleSelectAllSurfaces() {
  selectedSurfaces.value = [...CHARACTER_UPDATE_SURFACE_KEYS]
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
    selectedSurfaces.value = [...CHARACTER_UPDATE_SURFACE_KEYS]
    useCurrentExternalIdsAsKnownIds.value = true
  }
)

async function handleSubmit() {
  if (!profileId.value) return
  if (!data.value || data.value.length === 0) return
  if (selectedSurfaces.value.length === 0) return

  const currentProfileId = profileId.value
  const entities = toRaw(data.value)
  const currentProfile = await db.query.scraperProfiles.findFirst({
    where: eq(scraperProfiles.id, currentProfileId)
  })

  if (!currentProfile) {
    notify.error('批量更新失败', '刮削配置不存在')
    return
  }

  const surfaces = [...selectedSurfaces.value]
  const policy = {
    singularUpdate: singularUpdate.value,
    collectionUpdate: collectionUpdate.value
  } satisfies IngestUpdatePolicy

  isSubmitting.value = true

  const toastTitle = '批量更新元数据中...'
  const toastId = notify.loading(toastTitle, `${entities.length} 个角色`)

  let okCount = 0
  const failed: Array<{ id: string; name: string; error: string }> = []
  const total = entities.length

  try {
    for (const [index, entity] of entities.entries()) {
      const queryName = entity.originalName || entity.name
      const baseKnownIds = useCurrentExternalIdsAsKnownIds.value ? entity.externalIds : []

      notify.update(toastId, {
        title: toastTitle,
        message: `${index + 1} / ${total} · ${queryName}`,
        type: 'loading'
      })

      try {
        const searchResult = await ipcManager.invoke(
          'scraper:search-character',
          currentProfileId,
          queryName
        )
        if (!searchResult.success) throw new Error(searchResult.error)

        const first = searchResult.data?.[0]
        if (!first) throw new Error('无搜索结果')

        const request: CharacterUpdateRequest = {
          rootId: entity.id,
          profileId: currentProfileId,
          lookup: buildIngestUpdateLookup({
            name: first.originalName || first.name || queryName,
            baseKnownIds,
            selectionKnownIds: first.externalIds
          }),
          selection: {
            surfaces: [...surfaces]
          },
          policy
        }

        const result = await ipcManager.invoke(
          'ingest:update-character-from-scraper',
          request
        )
        if (!result.success) throw new Error(result.error)

        okCount++
      } catch (error) {
        failed.push({
          id: entity.id,
          name: queryName,
          error: error instanceof Error ? error.message : '未知错误'
        })
      }
    }

    const failCount = failed.length
    if (failCount === 0) {
      notify.update(toastId, {
        title: '批量更新完成',
        message: `${okCount} / ${entities.length}`,
        type: 'success'
      })
    } else if (okCount === 0) {
      notify.update(toastId, {
        title: '批量更新失败',
        message: failed[0]?.error,
        type: 'error'
      })
    } else {
      notify.update(toastId, {
        title: '批量更新完成（部分失败）',
        message: `成功 ${okCount}，失败 ${failCount}`,
        type: 'warning'
      })
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="openModel">
    <DialogContent class="max-w-3xl">
      <template v-if="isLoading || !data">
        <DialogBody class="flex items-center justify-center py-10">
          <Spinner class="size-8" />
        </DialogBody>
      </template>

      <template v-else>
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Icon
              icon="icon-[mdi--database-sync-outline]"
              class="size-4"
            />
            批量更新元数据
            <span class="text-xs text-muted-foreground">{{ selectedCount }} 个角色</span>
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
                    media-type="character"
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
                      v-for="surface in CHARACTER_UPDATE_SURFACE_KEYS"
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
            <div class="flex items-center gap-1.5 text-[11px] text-muted-foreground mr-auto">
              <Icon
                icon="icon-[mdi--lightbulb-outline]"
                class="size-3.5"
              />
              <span>“人物”可作为独立项单独勾选更新。</span>
            </div>
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
      </template>
    </DialogContent>
  </Dialog>
</template>
