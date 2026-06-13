<!--
Import Tab runs Bangumi collection and index imports, including their
configuration and preview dialogs.
Boundary: renders `overview` data and emits refresh/error; jobs go through
`host` RPC.
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldContent,
  FieldGroup,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Switch
} from '@kisaki3/extension-ui-vue'
import type {
  BangumiImportDataItem,
  BangumiImportIndexTargetMode,
  BangumiPreviewGroupDto,
  BangumiSettingsOverview
} from '../../../shared/settings'
import { host, onHostPreviewProgress, toErrorMessage } from '../rpc'
import PreviewGroups from '../components/preview-groups.vue'

interface Props {
  overview: BangumiSettingsOverview
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'error', message: string): void
}>()

const COLLECTION_TYPES: readonly { value: number; label: string }[] = [
  { value: 1, label: '想玩' },
  { value: 2, label: '玩过' },
  { value: 3, label: '在玩' },
  { value: 4, label: '搁置' },
  { value: 5, label: '抛弃' }
]

const DATA_ITEMS: readonly { value: BangumiImportDataItem; label: string }[] = [
  { value: 'status', label: '游玩状态' },
  { value: 'score', label: '评分' },
  { value: 'tags', label: '标签' }
]

const hasProfiles = computed(() => props.overview.profiles.length > 0)
const defaultProfileId = computed(() => props.overview.profiles[0]?.value ?? '')

const indexInput = ref('')
const busy = ref<'preview' | 'run' | null>(null)
const previewProgress = ref<string | null>(null)

const collectionsOpen = ref(false)
const collectionsPreview = ref<readonly BangumiPreviewGroupDto[] | null>(null)
const collectionsForm = reactive({
  profileId: '',
  collectionTypes: [1, 2, 3, 4, 5] as number[],
  dataItems: [] as BangumiImportDataItem[],
  patchExisting: false,
  useTargetCollection: false,
  targetCollectionId: ''
})

const indexOpen = ref(false)
const indexPreview = ref<readonly BangumiPreviewGroupDto[] | null>(null)
const indexForm = reactive({
  profileId: '',
  patchExisting: false,
  targetCollectionMode: 'none' as BangumiImportIndexTargetMode,
  targetCollectionId: ''
})

let stopProgressListener: (() => void) | null = null

onMounted(() => {
  stopProgressListener = onHostPreviewProgress((label) => {
    if (busy.value === 'preview') {
      previewProgress.value = label
    }
  })
})

onUnmounted(() => {
  stopProgressListener?.()
})

function openCollectionsDialog(): void {
  collectionsForm.profileId = defaultProfileId.value
  collectionsForm.targetCollectionId = props.overview.collections[0]?.value ?? ''
  collectionsPreview.value = null
  collectionsOpen.value = true
}

function openIndexDialog(): void {
  indexForm.profileId = defaultProfileId.value
  indexForm.targetCollectionId = props.overview.collections[0]?.value ?? ''
  indexPreview.value = null
  indexOpen.value = true
}

function toggleArrayValue<T>(values: readonly T[], value: T, checked: boolean): T[] {
  const next = new Set(values)
  if (checked) {
    next.add(value)
  } else {
    next.delete(value)
  }
  return [...next]
}

function collectionsArgs() {
  return {
    profileId: collectionsForm.profileId,
    collectionTypes: [...collectionsForm.collectionTypes],
    dataItems: [...collectionsForm.dataItems],
    patchExisting: collectionsForm.patchExisting,
    targetCollectionId: collectionsForm.useTargetCollection
      ? collectionsForm.targetCollectionId || null
      : null
  }
}

function indexArgs() {
  return {
    profileId: indexForm.profileId,
    indexInput: indexInput.value,
    patchExisting: indexForm.patchExisting,
    targetCollectionMode: indexForm.targetCollectionMode,
    targetCollectionId:
      indexForm.targetCollectionMode === 'existing' ? indexForm.targetCollectionId || null : null
  }
}

async function runImportAction(kind: 'preview' | 'run', action: () => Promise<void>): Promise<void> {
  busy.value = kind
  previewProgress.value = null
  try {
    await action()
  } catch (error) {
    emit('error', toErrorMessage(error))
  } finally {
    busy.value = null
    previewProgress.value = null
  }
}

function previewCollections(): void {
  void runImportAction('preview', async () => {
    collectionsPreview.value = await host.previewImportCollections(collectionsArgs())
  })
}

function runCollections(): void {
  void runImportAction('run', async () => {
    await host.runImportCollections(collectionsArgs())
    collectionsOpen.value = false
    emit('refresh')
  })
}

function previewIndex(): void {
  void runImportAction('preview', async () => {
    indexPreview.value = await host.previewImportIndex(indexArgs())
  })
}

function runIndex(): void {
  void runImportAction('run', async () => {
    await host.runImportIndex(indexArgs())
    indexOpen.value = false
    emit('refresh')
  })
}
</script>

<template>
  <FieldGroup>
    <Alert
      v-if="!hasProfiles"
      variant="warning"
    >
      尚未配置游戏刮削配置，导入仍可执行，但不会抓取元数据。
    </Alert>

    <Field
      orientation="horizontal"
      label="导入我的收藏"
      description="按收藏类型导入当前 Bangumi 用户的游戏收藏。"
    >
      <FieldContent class="flex-row items-center">
        <Button
          type="button"
          :disabled="overview.activeJobs.importCollections"
          @click="openCollectionsDialog"
        >
          配置导入
        </Button>
      </FieldContent>
    </Field>

    <Field
      orientation="horizontal"
      label="导入目录"
      description="输入 Bangumi 目录 ID 或链接后配置导入。"
    >
      <FieldContent class="flex-row items-center gap-2">
        <Input
          v-model="indexInput"
          type="text"
          placeholder="Bangumi 目录 ID 或链接"
          class="w-64"
        />
        <Button
          type="button"
          :disabled="!indexInput.trim() || overview.activeJobs.importIndex"
          @click="openIndexDialog"
        >
          导入
        </Button>
      </FieldContent>
    </Field>
  </FieldGroup>

  <Dialog v-model:open="collectionsOpen">
    <DialogContent class="max-w-xl">
      <DialogHeader>
        <DialogTitle>导入我的收藏</DialogTitle>
      </DialogHeader>
      <DialogBody class="max-h-[60vh] overflow-y-auto">
        <FieldGroup class="gap-4">
          <Field
            orientation="horizontal"
            label="刮削配置"
          >
            <Select v-model="collectionsForm.profileId">
              <SelectTrigger class="min-w-44">
                <SelectValue placeholder="选择刮削配置" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="profile in overview.profiles"
                  :key="profile.value"
                  :value="profile.value"
                >
                  {{ profile.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field
            orientation="horizontal"
            label="收藏类型"
          >
            <FieldContent class="flex-row items-center gap-3">
              <Label
                v-for="type in COLLECTION_TYPES"
                :key="type.value"
                class="font-normal"
              >
                <Checkbox
                  :model-value="collectionsForm.collectionTypes.includes(type.value)"
                  @update:model-value="
                    (checked) =>
                      (collectionsForm.collectionTypes = toggleArrayValue(
                        collectionsForm.collectionTypes,
                        type.value,
                        checked === true
                      ))
                  "
                />
                {{ type.label }}
              </Label>
            </FieldContent>
          </Field>

          <Field
            orientation="horizontal"
            label="导入数据"
          >
            <FieldContent class="flex-row items-center gap-3">
              <Label
                v-for="item in DATA_ITEMS"
                :key="item.value"
                class="font-normal"
              >
                <Checkbox
                  :model-value="collectionsForm.dataItems.includes(item.value)"
                  @update:model-value="
                    (checked) =>
                      (collectionsForm.dataItems = toggleArrayValue(
                        collectionsForm.dataItems,
                        item.value,
                        checked === true
                      ))
                  "
                />
                {{ item.label }}
              </Label>
            </FieldContent>
          </Field>

          <Field
            orientation="horizontal"
            label="更新已有条目"
          >
            <Switch v-model="collectionsForm.patchExisting" />
          </Field>

          <Field
            orientation="horizontal"
            label="导入到合集"
          >
            <FieldContent class="flex-row items-center gap-2">
              <Switch v-model="collectionsForm.useTargetCollection" />
              <Select
                v-if="collectionsForm.useTargetCollection"
                v-model="collectionsForm.targetCollectionId"
              >
                <SelectTrigger class="min-w-40">
                  <SelectValue placeholder="选择合集" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="collection in overview.collections"
                    :key="collection.value"
                    :value="collection.value"
                  >
                    {{ collection.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FieldContent>
          </Field>

          <PreviewGroups
            v-if="collectionsPreview"
            :groups="collectionsPreview"
          />
        </FieldGroup>
      </DialogBody>
      <DialogFooter>
        <span
          v-if="busy === 'preview' && previewProgress"
          class="mr-auto flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <Spinner class="size-3" />
          {{ previewProgress }}
        </span>
        <Button
          variant="outline"
          type="button"
          :disabled="busy !== null || overview.activeJobs.importCollections"
          @click="previewCollections"
        >
          {{ busy === 'preview' ? '正在预览…' : '预览' }}
        </Button>
        <Button
          type="button"
          :disabled="busy !== null || overview.activeJobs.importCollections"
          @click="runCollections"
        >
          开始导入
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <Dialog v-model:open="indexOpen">
    <DialogContent class="max-w-xl">
      <DialogHeader>
        <DialogTitle>导入目录</DialogTitle>
      </DialogHeader>
      <DialogBody class="max-h-[60vh] overflow-y-auto">
        <FieldGroup class="gap-4">
          <Field
            orientation="horizontal"
            label="目录"
          >
            <FieldContent class="flex-row items-center">
              <span class="text-sm break-all text-muted-foreground">{{ indexInput }}</span>
            </FieldContent>
          </Field>

          <Field
            orientation="horizontal"
            label="刮削配置"
          >
            <Select v-model="indexForm.profileId">
              <SelectTrigger class="min-w-44">
                <SelectValue placeholder="选择刮削配置" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="profile in overview.profiles"
                  :key="profile.value"
                  :value="profile.value"
                >
                  {{ profile.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="目标合集">
            <RadioGroup v-model="indexForm.targetCollectionMode">
              <Label class="font-normal">
                <RadioGroupItem value="none" />
                不放入合集
              </Label>
              <Label class="font-normal">
                <RadioGroupItem value="existing" />
                已有合集
              </Label>
              <Label class="font-normal">
                <RadioGroupItem value="byIndexTitle" />
                按目录标题创建
              </Label>
            </RadioGroup>
          </Field>

          <Field
            v-if="indexForm.targetCollectionMode === 'existing'"
            orientation="horizontal"
            label="选择合集"
          >
            <Select v-model="indexForm.targetCollectionId">
              <SelectTrigger class="min-w-40">
                <SelectValue placeholder="选择合集" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="collection in overview.collections"
                  :key="collection.value"
                  :value="collection.value"
                >
                  {{ collection.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field
            orientation="horizontal"
            label="更新已有条目"
          >
            <Switch
              v-model="indexForm.patchExisting"
              :disabled="indexForm.targetCollectionMode === 'none'"
            />
          </Field>

          <PreviewGroups
            v-if="indexPreview"
            :groups="indexPreview"
          />
        </FieldGroup>
      </DialogBody>
      <DialogFooter>
        <span
          v-if="busy === 'preview' && previewProgress"
          class="mr-auto flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <Spinner class="size-3" />
          {{ previewProgress }}
        </span>
        <Button
          variant="outline"
          type="button"
          :disabled="busy !== null || overview.activeJobs.importIndex"
          @click="previewIndex"
        >
          {{ busy === 'preview' ? '正在预览…' : '预览' }}
        </Button>
        <Button
          type="button"
          :disabled="busy !== null || overview.activeJobs.importIndex"
          @click="runIndex"
        >
          开始导入
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
