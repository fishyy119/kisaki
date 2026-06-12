<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import type {
  BangumiImportDataItem,
  BangumiImportIndexTargetMode,
  BangumiPreviewGroupDto,
  BangumiSettingsOverview
} from '../../../shared/settings'
import { host, toErrorMessage } from '../rpc'
import Modal from '../components/modal.vue'
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

async function runImportAction(
  kind: 'preview' | 'run',
  action: () => Promise<void>
): Promise<void> {
  busy.value = kind
  try {
    await action()
  } catch (error) {
    emit('error', toErrorMessage(error))
  } finally {
    busy.value = null
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
  <section>
    <p
      v-if="!hasProfiles"
      class="notice"
    >
      尚未配置游戏刮削配置，导入仍可执行，但不会抓取元数据。
    </p>

    <div class="field">
      <div class="field-info">
        <span class="field-label">导入我的收藏</span>
        <span class="field-hint">按收藏类型导入当前 Bangumi 用户的游戏收藏。</span>
      </div>
      <div class="field-control">
        <button
          type="button"
          class="border-transparent bg-primary text-primary-foreground"
          :disabled="overview.activeJobs.importCollections"
          @click="openCollectionsDialog"
        >
          配置导入
        </button>
      </div>
    </div>

    <div class="field">
      <div class="field-info">
        <span class="field-label">导入目录</span>
        <span class="field-hint">输入 Bangumi 目录 ID 或链接后配置导入。</span>
      </div>
      <div class="field-control">
        <input
          v-model="indexInput"
          type="text"
          placeholder="Bangumi 目录 ID 或链接"
          size="28"
        />
        <button
          type="button"
          class="border-transparent bg-primary text-primary-foreground"
          :disabled="!indexInput.trim() || overview.activeJobs.importIndex"
          @click="openIndexDialog"
        >
          导入
        </button>
      </div>
    </div>

    <Modal
      v-if="collectionsOpen"
      title="导入我的收藏"
      @close="collectionsOpen = false"
    >
      <div class="field">
        <div class="field-info"><span class="field-label">刮削配置</span></div>
        <div class="field-control">
          <select v-model="collectionsForm.profileId">
            <option
              v-for="profile in overview.profiles"
              :key="profile.value"
              :value="profile.value"
            >
              {{ profile.label }}
            </option>
          </select>
        </div>
      </div>
      <div class="field">
        <div class="field-info"><span class="field-label">收藏类型</span></div>
        <div class="field-control check-group">
          <label
            v-for="type in COLLECTION_TYPES"
            :key="type.value"
          >
            <input
              type="checkbox"
              :checked="collectionsForm.collectionTypes.includes(type.value)"
              @change="
                collectionsForm.collectionTypes = toggleArrayValue(
                  collectionsForm.collectionTypes,
                  type.value,
                  ($event.target as HTMLInputElement).checked
                )
              "
            />
            {{ type.label }}
          </label>
        </div>
      </div>
      <div class="field">
        <div class="field-info"><span class="field-label">导入数据</span></div>
        <div class="field-control check-group">
          <label
            v-for="item in DATA_ITEMS"
            :key="item.value"
          >
            <input
              type="checkbox"
              :checked="collectionsForm.dataItems.includes(item.value)"
              @change="
                collectionsForm.dataItems = toggleArrayValue(
                  collectionsForm.dataItems,
                  item.value,
                  ($event.target as HTMLInputElement).checked
                )
              "
            />
            {{ item.label }}
          </label>
        </div>
      </div>
      <div class="field">
        <div class="field-info">
          <span class="field-label">更新已有条目</span>
        </div>
        <div class="field-control">
          <input
            v-model="collectionsForm.patchExisting"
            type="checkbox"
          />
        </div>
      </div>
      <div class="field">
        <div class="field-info"><span class="field-label">导入到合集</span></div>
        <div class="field-control">
          <input
            v-model="collectionsForm.useTargetCollection"
            type="checkbox"
          />
          <select
            v-if="collectionsForm.useTargetCollection"
            v-model="collectionsForm.targetCollectionId"
          >
            <option
              v-for="collection in overview.collections"
              :key="collection.value"
              :value="collection.value"
            >
              {{ collection.label }}
            </option>
          </select>
        </div>
      </div>

      <PreviewGroups
        v-if="collectionsPreview"
        :groups="collectionsPreview"
      />

      <template #footer>
        <button
          type="button"
          :disabled="busy !== null || overview.activeJobs.importCollections"
          @click="previewCollections"
        >
          {{ busy === 'preview' ? '正在预览...' : '预览' }}
        </button>
        <button
          type="button"
          class="border-transparent bg-primary text-primary-foreground"
          :disabled="busy !== null || overview.activeJobs.importCollections"
          @click="runCollections"
        >
          开始导入
        </button>
      </template>
    </Modal>

    <Modal
      v-if="indexOpen"
      title="导入目录"
      @close="indexOpen = false"
    >
      <div class="field">
        <div class="field-info"><span class="field-label">目录</span></div>
        <div class="field-control">
          <span>{{ indexInput }}</span>
        </div>
      </div>
      <div class="field">
        <div class="field-info"><span class="field-label">刮削配置</span></div>
        <div class="field-control">
          <select v-model="indexForm.profileId">
            <option
              v-for="profile in overview.profiles"
              :key="profile.value"
              :value="profile.value"
            >
              {{ profile.label }}
            </option>
          </select>
        </div>
      </div>
      <div class="field">
        <div class="field-info"><span class="field-label">目标合集</span></div>
        <div class="field-control check-group">
          <label>
            <input
              v-model="indexForm.targetCollectionMode"
              type="radio"
              value="none"
            />
            不放入合集
          </label>
          <label>
            <input
              v-model="indexForm.targetCollectionMode"
              type="radio"
              value="existing"
            />
            已有合集
          </label>
          <label>
            <input
              v-model="indexForm.targetCollectionMode"
              type="radio"
              value="byIndexTitle"
            />
            按目录标题创建
          </label>
        </div>
      </div>
      <div
        v-if="indexForm.targetCollectionMode === 'existing'"
        class="field"
      >
        <div class="field-info"><span class="field-label">选择合集</span></div>
        <div class="field-control">
          <select v-model="indexForm.targetCollectionId">
            <option
              v-for="collection in overview.collections"
              :key="collection.value"
              :value="collection.value"
            >
              {{ collection.label }}
            </option>
          </select>
        </div>
      </div>
      <div class="field">
        <div class="field-info">
          <span class="field-label">更新已有条目</span>
        </div>
        <div class="field-control">
          <input
            v-model="indexForm.patchExisting"
            type="checkbox"
            :disabled="indexForm.targetCollectionMode === 'none'"
          />
        </div>
      </div>

      <PreviewGroups
        v-if="indexPreview"
        :groups="indexPreview"
      />

      <template #footer>
        <button
          type="button"
          :disabled="busy !== null || overview.activeJobs.importIndex"
          @click="previewIndex"
        >
          {{ busy === 'preview' ? '正在预览...' : '预览' }}
        </button>
        <button
          type="button"
          class="border-transparent bg-primary text-primary-foreground"
          :disabled="busy !== null || overview.activeJobs.importIndex"
          @click="runIndex"
        >
          开始导入
        </button>
      </template>
    </Modal>
  </section>
</template>
