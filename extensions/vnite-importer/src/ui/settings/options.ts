import type {
  GameUpdateSurface,
  LibraryGraphConflictMode,
  JsonObject,
  SettingsPanelSelectOption
} from '@kisaki3/extension-sdk'
import type { VniteImporterSettingsV1 } from '../../config'
import {
  resolveVniteCompletionSurfaces,
  normalizeGameUpdateSurfaces,
  normalizeVniteCompletionSurfacePreset,
  type VniteCompletionSurfacePreset
} from '../../completion'
import type { VniteImportFieldSelection } from '../../import/options'
import { omitUndefined } from '../../shared/object'
import { VNITE_SETTINGS_NODE_IDS } from './ids'

export const VNITE_CONFLICT_MODE_OPTIONS = [
  {
    value: 'skipExisting',
    label: '跳过现有',
    description: '命中现有游戏时不更新已存在条目'
  },
  {
    value: 'mergeSelected',
    label: '合并缺失字段',
    description: '只写入当前为空的所选字段'
  },
  {
    value: 'overwriteSelected',
    label: '覆盖所选字段',
    description: '覆盖已选字段，关系仍以合并为主'
  }
] as const satisfies readonly SettingsPanelSelectOption[]

export interface VniteImportFormOptions {
  fieldSelection: VniteImportFieldSelection
  conflictMode: LibraryGraphConflictMode
  strictAttachments: boolean
  completion: {
    enabled: boolean
    profileId?: string
    preset: VniteCompletionSurfacePreset
    surfaces: readonly GameUpdateSurface[]
  }
}

export interface VniteFieldGroupDefinition {
  key: keyof VniteImportFieldSelection
  label: string
  description: string
  items: readonly VniteFieldItemDefinition[]
}

export interface VniteFieldItemDefinition {
  key: string
  label: string
  description?: string
  coverageKey?: string
}

export const VNITE_FIELD_GROUPS = [
  {
    key: 'core',
    label: '基础信息',
    description: '名称、简介、日期、外部 ID 和分级',
    items: [
      { key: 'name', label: '名称' },
      { key: 'originalName', label: '原名' },
      { key: 'sortName', label: '排序名' },
      { key: 'releaseDate', label: '发售日期' },
      { key: 'description', label: '简介' },
      { key: 'relatedSites', label: '相关网站' },
      { key: 'externalIds', label: '外部 ID' },
      { key: 'nsfw', label: 'NSFW 标记' }
    ]
  },
  {
    key: 'local',
    label: '本地启动',
    description: '启动器、游戏目录和存档路径',
    items: [
      { key: 'launcher', label: '启动配置', coverageKey: 'local.gamePath' },
      { key: 'gameDirPath', label: '游戏目录', coverageKey: 'local.gamePath' },
      { key: 'savePath', label: '存档路径' }
    ]
  },
  {
    key: 'activity',
    label: '游玩记录',
    description: '状态、评分、时长、会话和添加时间',
    items: [
      { key: 'status', label: '游玩状态' },
      { key: 'score', label: '评分', coverageKey: 'activity.score' },
      { key: 'totalDuration', label: '总游玩时长', coverageKey: 'activity.playTime' },
      { key: 'lastActiveAt', label: '最后游玩时间', coverageKey: 'activity.lastRunDate' },
      { key: 'sessions', label: '游玩会话' },
      { key: 'createdAt', label: '添加时间' }
    ]
  },
  {
    key: 'organization',
    label: '分类与标签',
    description: '合集、标签、题材和平台',
    items: [
      { key: 'collections', label: '合集' },
      { key: 'tags', label: '标签' },
      { key: 'genresAsTags', label: '题材作为标签' },
      { key: 'platformsAsTags', label: '平台作为标签' }
    ]
  },
  {
    key: 'credits',
    label: '制作方与人员',
    description: '开发商、发行商和 extra 人员',
    items: [
      { key: 'companies', label: '制作方' },
      { key: 'personsFromExtra', label: 'extra 人员' },
      { key: 'unknownExtraAsNotes', label: '未知 extra 写入备注' }
    ]
  },
  {
    key: 'media',
    label: '媒体',
    description: '封面、背景图、Logo、图标和简介图片',
    items: [
      { key: 'cover', label: '封面', coverageKey: 'media.cover' },
      { key: 'backdrop', label: '背景图', coverageKey: 'media.backdrop' },
      { key: 'logo', label: 'Logo', coverageKey: 'media.logo' },
      { key: 'icon', label: '图标', coverageKey: 'media.icon' },
      { key: 'descriptionImages', label: '简介图片' }
    ]
  },
  {
    key: 'saves',
    label: '存档',
    description: '存档备份和最大备份数',
    items: [
      { key: 'saveBackups', label: '存档备份', coverageKey: 'saves.saveBackups' },
      { key: 'maxSaveBackups', label: '最大备份数' }
    ]
  },
  {
    key: 'memories',
    label: '回忆',
    description: '回忆记录和回忆图片',
    items: [
      { key: 'notes', label: '回忆记录', coverageKey: 'memories.notes' },
      { key: 'noteImages', label: '回忆图片' }
    ]
  }
] as const satisfies readonly VniteFieldGroupDefinition[]

export function readVniteImportFormOptions(input: {
  values: JsonObject
  settings: VniteImporterSettingsV1
  defaultProfileId?: string
  profilesAvailable: boolean
}): VniteImportFormOptions {
  const defaults = input.settings.defaults
  const preset = normalizeVniteCompletionSurfacePreset(
    readString(
      input.values,
      VNITE_SETTINGS_NODE_IDS.completionSurfacePreset,
      defaults.completionSurfacePreset
    ),
    defaults.completionSurfacePreset
  )
  const customSurfaces = normalizeGameUpdateSurfaces(
    input.values[VNITE_SETTINGS_NODE_IDS.completionSurfaces]
  )
  const profileId = readString(
    input.values,
    VNITE_SETTINGS_NODE_IDS.scraperProfileId,
    defaults.scraperProfileId ?? input.defaultProfileId ?? ''
  )
  const completionEnabled =
    input.profilesAvailable &&
    readBoolean(input.values, VNITE_SETTINGS_NODE_IDS.completeMetadata, defaults.completeMetadata)

  return {
    fieldSelection: defaults.fieldSelection,
    conflictMode: readConflictMode(input.values, defaults.conflictMode),
    strictAttachments: defaults.strictAttachments,
    completion: omitUndefined({
      enabled: completionEnabled,
      profileId: profileId || undefined,
      preset,
      surfaces: resolveVniteCompletionSurfaces({
        preset,
        customSurfaces: customSurfaces.length > 0 ? customSurfaces : defaults.completionSurfaces
      })
    })
  }
}

export function createFieldNodeId(group: keyof VniteImportFieldSelection, key: string): string {
  return `field.${group}.${key}`
}

export function createFieldGroupNodeId(group: keyof VniteImportFieldSelection): string {
  return `fieldGroup.${group}`
}

export function readFieldSelection(
  values: JsonObject,
  fallback: VniteImportFieldSelection
): VniteImportFieldSelection {
  const selection = structuredClone(fallback) as VniteImportFieldSelection

  for (const group of VNITE_FIELD_GROUPS) {
    const groupSelection = selection[group.key] as Record<string, boolean>
    const groupValue = values[createFieldGroupNodeId(group.key)]
    if (Array.isArray(groupValue)) {
      const selected = new Set(
        groupValue.filter((item): item is string => typeof item === 'string')
      )
      for (const item of group.items) {
        groupSelection[item.key] = selected.has(item.key)
      }
      continue
    }

    for (const item of group.items) {
      groupSelection[item.key] = readBoolean(
        values,
        createFieldNodeId(group.key, item.key),
        groupSelection[item.key] ?? false
      )
    }
  }

  return selection
}

export function countSelectedFields(selection: VniteImportFieldSelection): number {
  return Object.values(selection).reduce(
    (sum, group) => sum + Object.values(group).filter(Boolean).length,
    0
  )
}

export function countAllFields(): number {
  return VNITE_FIELD_GROUPS.reduce((sum, group) => sum + group.items.length, 0)
}

export function readBoolean(values: JsonObject, nodeId: string, fallback: boolean): boolean {
  return typeof values[nodeId] === 'boolean' ? values[nodeId] : fallback
}

export function readString(values: JsonObject, nodeId: string, fallback: string): string {
  return typeof values[nodeId] === 'string' ? values[nodeId] : fallback
}

function readConflictMode(
  values: JsonObject,
  fallback: LibraryGraphConflictMode
): LibraryGraphConflictMode {
  const value = readString(values, VNITE_SETTINGS_NODE_IDS.conflictMode, fallback)
  return VNITE_CONFLICT_MODE_OPTIONS.some((option) => option.value === value)
    ? (value as LibraryGraphConflictMode)
    : fallback
}
