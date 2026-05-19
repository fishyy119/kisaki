import type {
  SettingsPanelAnyNodeEvents,
  SettingsPanelContribution,
  SettingsPanelDialogButtonResult,
  SettingsPanelDialogChangeResult,
  SettingsPanelDialogModel,
  SettingsPanelDialogSubmitResult,
  SettingsPanelField,
  SettingsPanelFieldContentNode,
  SettingsPanelPopoverActionResult,
  SettingsPanelPopoverButtonResult,
  SettingsPanelPopoverChangeResult,
  SettingsPanelPopoverModel,
  SettingsPanelRootButtonResult,
  SettingsPanelRootChangeResult,
  SettingsPanelRootModel,
  SettingsPanelRootSubmitResult,
  SettingsPanelTab
} from '../contracts'
import { validateSettingsPanelContributionShape } from './contribution'
import {
  validateSettingsPanelDialogModel,
  validateSettingsPanelPopoverModel,
  validateSettingsPanelRootModel
} from './models'
import {
  validateSettingsPanelField,
  validateSettingsPanelNode,
  validateSettingsPanelTab
} from './nodes'
import {
  validateSettingsPanelDialogButtonResult,
  validateSettingsPanelDialogChangeResult,
  validateSettingsPanelDialogSubmitResult,
  validateSettingsPanelPopoverActionResult,
  validateSettingsPanelPopoverButtonResult,
  validateSettingsPanelPopoverChangeResult,
  validateSettingsPanelRootButtonResult,
  validateSettingsPanelRootChangeResult,
  validateSettingsPanelRootSubmitResult
} from './results'

export function isSettingsPanelContribution(value: unknown): value is SettingsPanelContribution {
  return validateSettingsPanelContributionShape(value).length === 0
}

export function isSettingsPanelRootModel(value: unknown): value is SettingsPanelRootModel {
  return validateSettingsPanelRootModel(value).length === 0
}

export function isSettingsPanelDialogModel(value: unknown): value is SettingsPanelDialogModel {
  return validateSettingsPanelDialogModel(value).length === 0
}

export function isSettingsPanelPopoverModel(value: unknown): value is SettingsPanelPopoverModel {
  return validateSettingsPanelPopoverModel(value).length === 0
}

export function isSettingsPanelField(
  value: unknown
): value is SettingsPanelField<SettingsPanelAnyNodeEvents> {
  return validateSettingsPanelField(value).length === 0
}

export function isSettingsPanelTab(
  value: unknown
): value is SettingsPanelTab<SettingsPanelAnyNodeEvents> {
  return validateSettingsPanelTab(value).length === 0
}

export function isSettingsPanelNode(
  value: unknown
): value is SettingsPanelFieldContentNode<SettingsPanelAnyNodeEvents> {
  return validateSettingsPanelNode(value).length === 0
}

export function isSettingsPanelRootChangeResult(
  value: unknown
): value is SettingsPanelRootChangeResult {
  return validateSettingsPanelRootChangeResult(value).length === 0
}

export function isSettingsPanelDialogChangeResult(
  value: unknown
): value is SettingsPanelDialogChangeResult {
  return validateSettingsPanelDialogChangeResult(value).length === 0
}

export function isSettingsPanelPopoverActionResult(
  value: unknown
): value is SettingsPanelPopoverActionResult {
  return validateSettingsPanelPopoverActionResult(value).length === 0
}

export function isSettingsPanelPopoverChangeResult(
  value: unknown
): value is SettingsPanelPopoverChangeResult {
  return validateSettingsPanelPopoverChangeResult(value).length === 0
}

export function isSettingsPanelPopoverButtonResult(
  value: unknown
): value is SettingsPanelPopoverButtonResult {
  return validateSettingsPanelPopoverButtonResult(value).length === 0
}

export function isSettingsPanelRootButtonResult(
  value: unknown
): value is SettingsPanelRootButtonResult {
  return validateSettingsPanelRootButtonResult(value).length === 0
}

export function isSettingsPanelDialogButtonResult(
  value: unknown
): value is SettingsPanelDialogButtonResult {
  return validateSettingsPanelDialogButtonResult(value).length === 0
}

export function isSettingsPanelRootSubmitResult(
  value: unknown
): value is SettingsPanelRootSubmitResult {
  return validateSettingsPanelRootSubmitResult(value).length === 0
}

export function isSettingsPanelDialogSubmitResult(
  value: unknown
): value is SettingsPanelDialogSubmitResult {
  return validateSettingsPanelDialogSubmitResult(value).length === 0
}
