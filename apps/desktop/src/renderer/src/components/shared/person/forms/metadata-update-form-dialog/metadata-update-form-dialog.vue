<!--
  PersonMetadataUpdateFormDialog
  Update person metadata from scraper results through the main-process ingest service.
-->
<script setup lang="ts">
import { computed, ref, toRaw, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { notify } from '@renderer/core/notify'
import { useAsyncData } from '@renderer/composables'
import { buildIngestUpdateLookup } from '@renderer/utils/ingest-update'
import { personExternalIds, persons } from '@shared/db'
import type { ExternalId } from '@shared/identity'
import {
  PERSON_UPDATE_SURFACE_KEYS,
  type PersonUpdateRequest,
  type PersonUpdateSurface,
  type IngestUpdatePolicy
} from '@shared/ingest/update'
import { PersonSearcher, type PersonSearcherSelection } from '@renderer/components/shared/person'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { Checkbox } from '@renderer/components/ui/checkbox'
import { Label } from '@renderer/components/ui/label'
import { StateView } from '@renderer/components/ui/state-view'
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
  personId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const isSubmitting = ref(false)

const selection = ref<PersonSearcherSelection>({
  profileId: '',
  personId: '',
  personName: '',
  originalName: '',
  knownIds: [],
  canSubmit: false
})

const singularUpdate = ref<IngestUpdatePolicy['singularUpdate']>('overwrite')
const collectionUpdate = ref<IngestUpdatePolicy['collectionUpdate']>('replace')
const selectedSurfaces = ref<PersonUpdateSurface[]>([...PERSON_UPDATE_SURFACE_KEYS])
const useCurrentExternalIdsAsKnownIds = ref(true)

const SURFACE_LABELS: Record<PersonUpdateSurface, string> = {
  name: '名称',
  originalName: '原名',
  birthDate: '出生日期',
  deathDate: '去世日期',
  gender: '性别',
  description: '简介',
  relatedSites: '相关链接',
  externalIds: '外部 ID',
  tags: '标签',
  photos: '照片'
}

const { data, isLoading } = useAsyncData(
  async () => {
    const person = await db.query.persons.findFirst({ where: eq(persons.id, props.personId) })
    if (!person) return null

    const rows = await db
      .select({ source: personExternalIds.source, id: personExternalIds.externalId })
      .from(personExternalIds)
      .where(eq(personExternalIds.personId, props.personId))

    const externalIds: ExternalId[] = rows.map((row) => ({ source: row.source, id: row.id }))

    return { person, externalIds }
  },
  {
    watch: [() => props.personId],
    enabled: () => open.value
  }
)

const defaultSearchQuery = computed(() => {
  const person = data.value?.person
  if (!person) return ''
  return person.originalName || person.name || ''
})

const canSubmit = computed(() => {
  return !!selection.value.profileId && selectedSurfaces.value.length > 0 && !isSubmitting.value
})

function handleSelectionChange(next: PersonSearcherSelection) {
  selection.value = next
}

function toggleSurface(surface: PersonUpdateSurface, nextValue: boolean) {
  const current = selectedSurfaces.value
  if (nextValue) {
    if (!current.includes(surface)) selectedSurfaces.value = [...current, surface]
    return
  }
  selectedSurfaces.value = current.filter((item) => item !== surface)
}

function handleSelectAllSurfaces() {
  selectedSurfaces.value = [...PERSON_UPDATE_SURFACE_KEYS]
}

function handleSelectNoSurfaces() {
  selectedSurfaces.value = []
}

watch(
  () => open.value,
  (isOpen) => {
    if (!isOpen) return
    isSubmitting.value = false
    selection.value = {
      profileId: '',
      personId: '',
      personName: '',
      originalName: '',
      knownIds: [],
      canSubmit: false
    }
    singularUpdate.value = 'overwrite'
    collectionUpdate.value = 'replace'
    selectedSurfaces.value = [...PERSON_UPDATE_SURFACE_KEYS]
    useCurrentExternalIdsAsKnownIds.value = true
  }
)

async function handleSubmit() {
  if (!data.value?.person) return
  if (!selection.value.profileId) return
  if (selectedSurfaces.value.length === 0) return

  const baseKnownIds = useCurrentExternalIdsAsKnownIds.value ? toRaw(data.value.externalIds) : []
  const selectionKnownIds = toRaw(selection.value.knownIds)
  const lookupName =
    selection.value.originalName ||
    selection.value.personName ||
    data.value.person.originalName ||
    data.value.person.name

  const request: PersonUpdateRequest = {
    rootId: props.personId,
    profileId: selection.value.profileId,
    lookup: buildIngestUpdateLookup({
      name: lookupName,
      baseKnownIds,
      selectionKnownIds
    }),
    selection: {
      surfaces: [...selectedSurfaces.value]
    },
    policy: {
      singularUpdate: singularUpdate.value,
      collectionUpdate: collectionUpdate.value
    }
  }

  open.value = false
  isSubmitting.value = true

  try {
    const result = await ipcManager.invoke('ingest:update-person-from-scraper', request)
    if (!result.success) {
      notify.error('启动更新失败', result.error)
      return
    }
  } catch (error) {
    notify.error('启动更新失败', error instanceof Error ? error.message : '未知错误')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-3xl">
      <template v-if="isLoading || !data">
        <DialogBody>
          <StateView
            state="loading"
            class="py-10"
          />
        </DialogBody>
      </template>

      <template v-else>
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Icon
              icon="icon-[mdi--database-sync-outline]"
              class="size-4"
            />
            更新元数据
          </DialogTitle>
        </DialogHeader>

        <Form @submit="handleSubmit">
          <DialogBody class="space-y-4 max-h-[70vh] overflow-y-auto">
            <PersonSearcher
              :default-search-query="defaultSearchQuery"
              :is-submitting="isSubmitting"
              @selection-change="handleSelectionChange"
            />

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
                      v-for="surface in PERSON_UPDATE_SURFACE_KEYS"
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
              <span>检索流程仍在 renderer 侧执行，提交时仅发送一次 update 请求。</span>
            </div>
            <Button
              type="button"
              variant="outline"
              :disabled="isSubmitting"
              @click="open = false"
            >
              取消
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
