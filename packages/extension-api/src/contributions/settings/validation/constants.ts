export type SettingsValueSchema = 'boolean' | 'string' | 'number' | 'stringArray' | 'recordArray'

export interface SurfaceValidationState {
  fieldIds: Set<string>
  nodeIds: Set<string>
}

export interface ResultCapability {
  allowedRefreshTargets: readonly SettingsRefreshTargetValue[]
  allowClosePopover?: boolean
  allowOpenDialog?: boolean
  allowOpenPopover?: boolean
  allowedCloseTargets?: readonly SettingsCloseTargetValue[]
  allowClosePopoverWithClose?: boolean
}

export type SettingsRefreshTargetValue = 'self' | 'root' | 'dialog' | 'popover' | 'all'
export type SettingsCloseTargetValue = 'root' | 'dialog'

export const SETTINGS_DIALOG_SIZE_VALUES = ['sm', 'md', 'lg', 'xl'] as const
export const SETTINGS_POPOVER_WIDTH_VALUES = ['sm', 'md', 'lg'] as const
export const SETTINGS_NOTICE_TONE_VALUES = ['info', 'warning', 'error', 'success'] as const
export const SETTINGS_STATUS_TONE_VALUES = ['neutral', 'success', 'warning', 'danger'] as const
export const SETTINGS_TEXT_TONE_VALUES = ['default', 'muted', 'danger'] as const
export const SETTINGS_BUTTON_TONE_VALUES = ['default', 'primary', 'danger'] as const
export const SETTINGS_NODE_WIDTH_VALUES = ['auto', 'sm', 'md', 'lg', 'full'] as const
export const SETTINGS_FIELD_ORIENTATION_VALUES = ['vertical', 'horizontal', 'responsive'] as const
export const SETTINGS_FIELD_SPAN_VALUES = ['full'] as const
export const SETTINGS_CONTENT_LAYOUT_VALUES = ['stack', 'inline', 'grid'] as const
export const SETTINGS_TEXT_INPUT_MODE_VALUES = [
  'text',
  'email',
  'url',
  'search',
  'tel',
  'password'
] as const
export const SETTINGS_TABLE_COLUMN_KIND_VALUES = ['text', 'number', 'boolean', 'badge'] as const
export const SETTINGS_RECORD_LIST_COLUMN_KIND_VALUES = [
  'text',
  'select',
  'number',
  'boolean'
] as const
export const SETTINGS_IMAGE_FIT_VALUES = ['contain', 'cover'] as const

export const CONTRIBUTION_KEYS = new Set<string>([
  'id',
  'title',
  'description',
  'order',
  'popovers',
  'dialogs',
  'resolve',
  'submit'
])
export const DIALOG_DEFINITION_KEYS = new Set<string>(['title', 'size', 'resolve', 'submit'])
export const POPOVER_DEFINITION_KEYS = new Set<string>(['title', 'width', 'resolve'])
export const ROOT_MODEL_KEYS = new Set<string>([
  'title',
  'description',
  'size',
  'fields',
  'tabs',
  'activeTabId'
])
export const DIALOG_MODEL_KEYS = new Set<string>(['title', 'description', 'size', 'fields'])
export const POPOVER_MODEL_KEYS = new Set<string>(['title', 'description', 'width', 'fields'])
export const FIELD_KEYS = new Set<string>([
  'id',
  'label',
  'description',
  'hidden',
  'disabled',
  'orientation',
  'span',
  'contentLayout',
  'contentColumns',
  'content'
])
export const TAB_KEYS = new Set<string>(['id', 'label', 'description', 'icon', 'fields'])
export const NODE_BASE_KEYS = ['kind', 'id', 'hidden', 'disabled', 'grow', 'width'] as const
export const VALUE_NODE_BASE_KEYS = [...NODE_BASE_KEYS, 'initialValue', 'onCommit'] as const
export const SELECT_OPTION_KEYS = new Set<string>(['value', 'label', 'description', 'disabled'])
export const TABLE_COLUMN_KEYS = new Set<string>(['key', 'label', 'kind'])
export const RECORD_LIST_COLUMN_KEYS = new Set<string>(['key', 'label', 'kind', 'options'])
export const RESULT_FAILURE_KEYS = new Set<string>(['success', 'error', 'refresh', 'closePopover'])
export const DIALOG_TARGET_KEYS = new Set<string>(['dialogId', 'params'])
export const POPOVER_TARGET_KEYS = new Set<string>(['popoverId', 'params'])
