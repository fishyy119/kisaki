import type {
  SettingsAnyNodeEvents,
  SettingsContribution,
  SettingsDialogButtonResult,
  SettingsDialogCommitResult,
  SettingsDialogModel,
  SettingsDialogSubmitResult,
  SettingsField,
  SettingsFieldNode,
  SettingsPopoverActionResult,
  SettingsPopoverButtonResult,
  SettingsPopoverCommitResult,
  SettingsPopoverModel,
  SettingsRootButtonResult,
  SettingsRootCommitResult,
  SettingsRootModel,
  SettingsRootSubmitResult,
  SettingsTab
} from '../contracts'
import { validateSettingsContributionShape } from './contribution'
import {
  validateSettingsDialogModel,
  validateSettingsPopoverModel,
  validateSettingsRootModel
} from './models'
import { validateSettingsField, validateSettingsNode, validateSettingsTab } from './nodes'
import {
  validateSettingsDialogButtonResult,
  validateSettingsDialogCommitResult,
  validateSettingsDialogSubmitResult,
  validateSettingsPopoverActionResult,
  validateSettingsPopoverButtonResult,
  validateSettingsPopoverCommitResult,
  validateSettingsRootButtonResult,
  validateSettingsRootCommitResult,
  validateSettingsRootSubmitResult
} from './results'

export function isSettingsContribution(value: unknown): value is SettingsContribution {
  return validateSettingsContributionShape(value).length === 0
}

export function isSettingsRootModel(value: unknown): value is SettingsRootModel {
  return validateSettingsRootModel(value).length === 0
}

export function isSettingsDialogModel(value: unknown): value is SettingsDialogModel {
  return validateSettingsDialogModel(value).length === 0
}

export function isSettingsPopoverModel(value: unknown): value is SettingsPopoverModel {
  return validateSettingsPopoverModel(value).length === 0
}

export function isSettingsField(value: unknown): value is SettingsField<SettingsAnyNodeEvents> {
  return validateSettingsField(value).length === 0
}

export function isSettingsTab(value: unknown): value is SettingsTab<SettingsAnyNodeEvents> {
  return validateSettingsTab(value).length === 0
}

export function isSettingsNode(value: unknown): value is SettingsFieldNode<SettingsAnyNodeEvents> {
  return validateSettingsNode(value).length === 0
}

export function isSettingsRootCommitResult(value: unknown): value is SettingsRootCommitResult {
  return validateSettingsRootCommitResult(value).length === 0
}

export function isSettingsDialogCommitResult(value: unknown): value is SettingsDialogCommitResult {
  return validateSettingsDialogCommitResult(value).length === 0
}

export function isSettingsPopoverActionResult(
  value: unknown
): value is SettingsPopoverActionResult {
  return validateSettingsPopoverActionResult(value).length === 0
}

export function isSettingsPopoverCommitResult(
  value: unknown
): value is SettingsPopoverCommitResult {
  return validateSettingsPopoverCommitResult(value).length === 0
}

export function isSettingsPopoverButtonResult(
  value: unknown
): value is SettingsPopoverButtonResult {
  return validateSettingsPopoverButtonResult(value).length === 0
}

export function isSettingsRootButtonResult(value: unknown): value is SettingsRootButtonResult {
  return validateSettingsRootButtonResult(value).length === 0
}

export function isSettingsDialogButtonResult(value: unknown): value is SettingsDialogButtonResult {
  return validateSettingsDialogButtonResult(value).length === 0
}

export function isSettingsRootSubmitResult(value: unknown): value is SettingsRootSubmitResult {
  return validateSettingsRootSubmitResult(value).length === 0
}

export function isSettingsDialogSubmitResult(value: unknown): value is SettingsDialogSubmitResult {
  return validateSettingsDialogSubmitResult(value).length === 0
}
