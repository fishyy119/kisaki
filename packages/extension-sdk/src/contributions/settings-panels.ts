import type {
  DisposableStore,
  SettingsPanelBuilder,
  SettingsPanelContribution,
  SettingsPanelRegistrar
} from '@kisaki/extension-api'
import type { ExtensionSdkBridge } from '../bridge'

export function createSettingsPanelBuilder(): SettingsPanelBuilder {
  return {
    section(node) {
      return { kind: 'section', ...node }
    },
    text(node) {
      return { kind: 'text', ...node }
    },
    switch(node) {
      return { kind: 'switch', ...node }
    },
    checkbox(node) {
      return { kind: 'checkbox', ...node }
    },
    select(node) {
      return { kind: 'select', ...node }
    },
    textInput(node) {
      return { kind: 'textInput', ...node }
    },
    textarea(node) {
      return { kind: 'textarea', ...node }
    },
    numberInput(node) {
      return { kind: 'numberInput', ...node }
    },
    button(node) {
      return { kind: 'button', ...node }
    },
    notice(node) {
      return { kind: 'notice', ...node }
    },
    status(node) {
      return { kind: 'status', ...node }
    },
    divider(node) {
      return { kind: 'divider', ...node }
    }
  }
}

export function createSettingsPanelRegistrar(
  bridge: ExtensionSdkBridge,
  subscriptions: DisposableStore
): SettingsPanelRegistrar {
  return {
    register(contribution: SettingsPanelContribution) {
      const disposable = bridge.registerSettingsPanel(contribution)
      subscriptions.add(disposable)
      return disposable
    }
  }
}
