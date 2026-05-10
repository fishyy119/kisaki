import type {
  SettingsPanelAnyNodeEvents,
  SettingsPanelContribution,
  SettingsPanelDialogButtonResult,
  SettingsPanelDialogCommitResult,
  SettingsPanelDialogModel,
  SettingsPanelDialogSubmitResult,
  SettingsPanelField,
  SettingsPanelFieldContentNode,
  SettingsPanelPopoverActionResult,
  SettingsPanelPopoverButtonResult,
  SettingsPanelPopoverCommitResult,
  SettingsPanelPopoverModel,
  SettingsPanelRootButtonResult,
  SettingsPanelRootCommitResult,
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
  validateSettingsPanelDialogCommitResult,
  validateSettingsPanelDialogSubmitResult,
  validateSettingsPanelPopoverActionResult,
  validateSettingsPanelPopoverButtonResult,
  validateSettingsPanelPopoverCommitResult,
  validateSettingsPanelRootButtonResult,
  validateSettingsPanelRootCommitResult,
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

export function isSettingsPanelRootCommitResult(
  value: unknown
): value is SettingsPanelRootCommitResult {
  return validateSettingsPanelRootCommitResult(value).length === 0
}

export function isSettingsPanelDialogCommitResult(
  value: unknown
): value is SettingsPanelDialogCommitResult {
  return validateSettingsPanelDialogCommitResult(value).length === 0
}

export function isSettingsPanelPopoverActionResult(
  value: unknown
): value is SettingsPanelPopoverActionResult {
  return validateSettingsPanelPopoverActionResult(value).length === 0
}

export function isSettingsPanelPopoverCommitResult(
  value: unknown
): value is SettingsPanelPopoverCommitResult {
  return validateSettingsPanelPopoverCommitResult(value).length === 0
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
