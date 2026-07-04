<!-- Import Tab offers source selection; source-specific options live in flow dialogs. -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  Alert,
  Button,
  Field,
  FieldContent,
  FieldGroup,
  Icon,
  Input
} from '@kisaki3/extension-ui-vue'
import type { BangumiSettingsOverview } from '../../../shared/settings'
import SettingsSection from '../components/settings-section.vue'
import ImportCollectionsDialog from '../flows/import-collections-dialog.vue'
import ImportIndexDialog from '../flows/import-index-dialog.vue'

interface Props {
  overview: BangumiSettingsOverview
}

const props = defineProps<Props>()

const emit = defineEmits<{
  refresh: []
  error: [message: string]
}>()

const indexInput = ref('')
const collectionsOpen = ref(false)
const indexOpen = ref(false)
const hasProfiles = computed(() => props.overview.profiles.length > 0)
</script>

<template>
  <div class="space-y-4">
    <Alert
      v-if="!hasProfiles"
      variant="warning"
    >
      尚未配置游戏刮削配置，导入仍可预览，但执行本地写入前需要可用配置。
    </Alert>

    <SettingsSection
      title="导入来源"
      description="导入是一次性任务；选项只用于本次运行，不写入 Bangumi 偏好。"
      surface="rows"
    >
      <FieldGroup>
        <Field
          orientation="horizontal"
          label="我的收藏"
          description="按收藏类型导入当前 Bangumi 用户的游戏收藏。"
        >
          <FieldContent class="flex-row items-center">
            <Button
              size="sm"
              type="button"
              :disabled="props.overview.activeJobs.importCollections"
              @click="collectionsOpen = true"
            >
              <Icon
                icon="icon-[mdi--account-heart-outline]"
                class="size-3.5"
              />
              配置导入
            </Button>
          </FieldContent>
        </Field>

        <Field
          orientation="horizontal"
          label="Bangumi 目录"
          description="输入目录 ID 或链接后配置导入。"
        >
          <FieldContent class="flex-row items-center gap-2">
            <Input
              v-model="indexInput"
              type="text"
              placeholder="目录 ID 或 https://bgm.tv/index/..."
              class="w-72"
            />
            <Button
              size="sm"
              type="button"
              :disabled="!indexInput.trim() || props.overview.activeJobs.importIndex"
              @click="indexOpen = true"
            >
              <Icon
                icon="icon-[mdi--playlist-plus]"
                class="size-3.5"
              />
              配置导入
            </Button>
          </FieldContent>
        </Field>
      </FieldGroup>
    </SettingsSection>

    <ImportCollectionsDialog
      v-if="collectionsOpen"
      v-model:open="collectionsOpen"
      :overview="props.overview"
      @refresh="emit('refresh')"
      @error="(message) => emit('error', message)"
    />

    <ImportIndexDialog
      v-if="indexOpen"
      v-model:open="indexOpen"
      :overview="props.overview"
      :index-input="indexInput"
      @refresh="emit('refresh')"
      @error="(message) => emit('error', message)"
    />
  </div>
</template>
