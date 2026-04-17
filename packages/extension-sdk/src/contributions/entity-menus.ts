import type {
  DisposableStore,
  EntityMenuBuilder,
  EntityMenuContribution,
  EntityMenuRegistrar
} from '@kisaki/extension-api'
import type { ExtensionSdkBridge } from '../bridge'

export function createEntityMenuBuilder(): EntityMenuBuilder {
  return {
    action(node) {
      return { kind: 'action', ...node }
    },
    checkbox(node) {
      return { kind: 'checkbox', ...node }
    },
    select(node) {
      return { kind: 'select', ...node }
    },
    separator(node) {
      return { kind: 'separator', ...node }
    }
  }
}

export function createEntityMenuRegistrar(
  bridge: ExtensionSdkBridge,
  subscriptions: DisposableStore
): EntityMenuRegistrar {
  return {
    register(contribution) {
      const disposable = bridge.registerEntityMenu(contribution as EntityMenuContribution)
      subscriptions.add(disposable)
      return disposable
    }
  }
}
