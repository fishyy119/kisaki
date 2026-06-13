<!-- Step 2: import options. The options form is shared two-way with the app root. -->
<script setup lang="ts">
import {
  Alert,
  Button,
  Checkbox,
  Field,
  FieldContent,
  FieldGroup,
  Label,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch
} from '@kisaki3/extension-ui-vue'
import type { GameUpdateSurface } from '@kisaki3/extension-sdk'
import type { VniteImportOptionsForm } from '../../../shared/import-wizard'

const CONFLICT_MODE_OPTIONS = [
  { value: 'skipExisting', label: '跳过现有' },
  { value: 'mergeSelected', label: '合并缺失字段' },
  { value: 'overwriteSelected', label: '覆盖所选字段' }
] as const

const COMPLETION_PRESET_OPTIONS = [
  { value: 'missingCoreAndMedia', label: '补全缺失的核心资料与媒体' },
  { value: 'missingAll', label: '补全所有缺失字段' },
  { value: 'custom', label: '自定义字段' }
] as const

const COMPLETION_SURFACE_OPTIONS: readonly { value: GameUpdateSurface; label: string }[] = [
  { value: 'name', label: '名称' },
  { value: 'originalName', label: '原名' },
  { value: 'releaseDate', label: '发售日期' },
  { value: 'description', label: '简介' },
  { value: 'relatedSites', label: '相关网站' },
  { value: 'externalIds', label: '外部 ID' },
  { value: 'tags', label: '标签' },
  { value: 'person', label: '人员' },
  { value: 'company', label: '公司' },
  { value: 'character', label: '角色' },
  { value: 'covers', label: '封面' },
  { value: 'backdrops', label: '背景图' },
  { value: 'logos', label: 'Logo' },
  { value: 'icons', label: '图标' }
]

interface Props {
  profiles: readonly { value: string; label: string }[]
  selectedFieldCount: number
  totalFieldCount: number
}

const props = defineProps<Props>()
const options = defineModel<VniteImportOptionsForm>('options', { required: true })

const emit = defineEmits<{
  editFields: []
}>()

function toggleSurface(surface: GameUpdateSurface, checked: boolean): void {
  const next = new Set(options.value.completionSurfaces)
  if (checked) {
    next.add(surface)
  } else {
    next.delete(surface)
  }
  options.value.completionSurfaces = [...next]
}
</script>

<template>
  <FieldGroup>
    <Field
      orientation="horizontal"
      label="字段"
      description="选择从备份包写入资料库的字段。"
    >
      <FieldContent class="flex-row items-center gap-2">
        <span class="text-sm text-muted-foreground">
          {{ props.selectedFieldCount }}/{{ props.totalFieldCount }}
        </span>
        <Button
          variant="outline"
          type="button"
          @click="emit('editFields')"
        >
          编辑字段
        </Button>
      </FieldContent>
    </Field>

    <Alert
      v-if="props.profiles.length === 0"
      variant="warning"
    >
      尚未配置游戏刮削配置，无法启用元数据补全。可以先直接导入。
    </Alert>

    <Field
      orientation="horizontal"
      label="元数据补全"
      description="导入后使用刮削配置补全缺失资料。"
    >
      <Switch
        v-model="options.completeMetadata"
        :disabled="props.profiles.length === 0"
      />
    </Field>

    <Field
      v-if="options.completeMetadata"
      orientation="horizontal"
      label="刮削配置"
    >
      <Select v-model="options.scraperProfileId">
        <SelectTrigger class="min-w-44">
          <SelectValue placeholder="选择刮削配置" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="profile in props.profiles"
            :key="profile.value"
            :value="profile.value"
          >
            {{ profile.label }}
          </SelectItem>
        </SelectContent>
      </Select>
    </Field>

    <Field
      v-if="options.completeMetadata"
      label="补全范围"
    >
      <RadioGroup v-model="options.completionSurfacePreset">
        <Label
          v-for="preset in COMPLETION_PRESET_OPTIONS"
          :key="preset.value"
          class="font-normal"
        >
          <RadioGroupItem :value="preset.value" />
          {{ preset.label }}
        </Label>
      </RadioGroup>
    </Field>

    <Field
      v-if="options.completeMetadata && options.completionSurfacePreset === 'custom'"
      label="自定义字段"
    >
      <div class="grid grid-cols-4 gap-x-3 gap-y-1.5">
        <Label
          v-for="surface in COMPLETION_SURFACE_OPTIONS"
          :key="surface.value"
          class="font-normal"
        >
          <Checkbox
            :model-value="options.completionSurfaces.includes(surface.value)"
            @update:model-value="(checked) => toggleSurface(surface.value, checked === true)"
          />
          {{ surface.label }}
        </Label>
      </div>
    </Field>

    <Field
      orientation="horizontal"
      label="冲突策略"
      description="命中现有游戏时的写入方式。"
    >
      <Select v-model="options.conflictMode">
        <SelectTrigger class="min-w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="mode in CONFLICT_MODE_OPTIONS"
            :key="mode.value"
            :value="mode.value"
          >
            {{ mode.label }}
          </SelectItem>
        </SelectContent>
      </Select>
    </Field>

    <Field
      orientation="horizontal"
      label="附件失败时中止"
      description="关闭时附件失败仅记录诊断。"
    >
      <Switch v-model="options.strictAttachments" />
    </Field>
  </FieldGroup>
</template>
