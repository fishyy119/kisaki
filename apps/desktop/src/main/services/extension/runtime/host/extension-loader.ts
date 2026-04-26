import { pathToFileURL } from 'node:url'
import type {
  ExtensionDefinition,
  ExtensionRuntimeHandle,
  ExtensionUnloadResult,
  ExtensionRuntimeMetadata
} from '@kisaki/extension-api'
import { toRpcErrorPayload } from '@kisaki/extension-api'
import { readExtensionManifestFile, resolveExtensionFilePath } from '../../manifest'
import type { ExtensionRegistry, LoadedExtensionRuntime } from './extension-registry'
import type { ExtensionHostSdkBridge } from './sdk-bridge'

/**
 * Loads and unloads extension entry modules inside the shared extension host process.
 */
export class ExtensionLoader {
  constructor(
    private readonly registry: ExtensionRegistry,
    private readonly sdkBridge: ExtensionHostSdkBridge
  ) {}

  async loadExtension(
    extension: ExtensionRuntimeMetadata,
    runtimeHandle: ExtensionRuntimeHandle,
    generation: number
  ): Promise<void> {
    if (this.registry.has(extension.id)) {
      throw new Error(`Extension "${extension.id}" is already loaded`)
    }

    const parsed = await readExtensionManifestFile(extension.manifestPath)
    if (!parsed.manifest) {
      throw new Error(
        `Extension "${extension.id}" manifest is invalid:\n${parsed.issues
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join('\n')}`
      )
    }

    const entryPath = resolveExtensionFilePath(extension.extensionPath, parsed.manifest.entry)
    const cacheBuster = `?t=${Date.now()}`
    const extensionModule = await import(`${pathToFileURL(entryPath).href}${cacheBuster}`)
    const definition = resolveExtensionDefinition(extension.id, extensionModule)

    const abortController = new AbortController()
    const { context, subscriptions } = this.sdkBridge.createExtensionContext({
      extension,
      runtimeHandle,
      abortSignal: abortController.signal
    })

    const runtime: LoadedExtensionRuntime = {
      metadata: extension,
      runtimeHandle,
      generation,
      definition,
      context,
      subscriptions,
      abortController,
      entityMenus: new Map(),
      settingsPanels: new Map(),
      gameScrapers: new Map(),
      personScrapers: new Map(),
      companyScrapers: new Map(),
      characterScrapers: new Map(),
      deeplinks: new Map(),
      themes: new Map()
    }

    this.registry.add(runtime)

    try {
      await this.sdkBridge.runInExtensionContext(runtime, () => definition.activate(context))
      await this.sdkBridge.flushRuntime(runtimeHandle)
    } catch (error) {
      await this.cleanupFailedActivation(runtime)
      throw error
    }
  }

  async unloadExtension(
    extensionId: string,
    runtimeHandle?: ExtensionRuntimeHandle
  ): Promise<ExtensionUnloadResult> {
    const runtime = this.registry.get(extensionId)
    if (!runtime) {
      return { unloaded: false }
    }

    if (runtimeHandle && runtime.runtimeHandle !== runtimeHandle) {
      return { unloaded: false }
    }

    let deactivateError: ExtensionUnloadResult['deactivateError']
    let cleanupError: ExtensionUnloadResult['cleanupError']
    runtime.abortController.abort()

    try {
      if (runtime.definition.deactivate) {
        await this.sdkBridge.runInExtensionContext(runtime, () =>
          runtime.definition.deactivate!(runtime.context)
        )
      }
    } catch (error) {
      deactivateError = toRpcErrorPayload(error)
    }

    try {
      await runtime.subscriptions.clear()
    } catch (error) {
      cleanupError = toRpcErrorPayload(error)
    } finally {
      await this.sdkBridge.releaseRuntime(runtime.runtimeHandle)
      this.registry.delete(extensionId)
    }

    return {
      unloaded: true,
      deactivateError,
      cleanupError
    }
  }

  async shutdown(): Promise<void> {
    const runtimes = [...this.registry.list()].reverse()
    for (const runtime of runtimes) {
      await this.unloadExtension(runtime.metadata.id)
    }
  }

  private async cleanupFailedActivation(runtime: LoadedExtensionRuntime): Promise<void> {
    runtime.abortController.abort()

    try {
      if (runtime.definition.deactivate) {
        await this.sdkBridge.runInExtensionContext(runtime, () =>
          runtime.definition.deactivate!(runtime.context)
        )
      }
    } catch {
      // Best-effort cleanup only.
    }

    await runtime.subscriptions.clear()
    await this.sdkBridge.releaseRuntime(runtime.runtimeHandle)
    this.registry.delete(runtime.metadata.id)
  }
}

function resolveExtensionDefinition(
  extensionId: string,
  module: Record<string, unknown>
): ExtensionDefinition {
  if (isExtensionDefinition(module.default)) {
    return module.default
  }

  if (typeof module.activate === 'function') {
    return {
      activate: module.activate as ExtensionDefinition['activate'],
      deactivate:
        typeof module.deactivate === 'function'
          ? (module.deactivate as ExtensionDefinition['deactivate'])
          : undefined
    }
  }

  throw new Error(
    `Extension "${extensionId}" must export either a default defineExtension({...}) object or a named activate(context) function`
  )
}

function isExtensionDefinition(value: unknown): value is ExtensionDefinition {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    typeof (value as ExtensionDefinition).activate === 'function'
  )
}
