import { pathToFileURL } from 'node:url'
import type {
  ExtensionDefinition,
  ExtensionRuntimeHandle,
  ExtensionUnloadResult,
  ExtensionRuntimeMetadata
} from '@kisaki3/extension-api'
import { toRpcErrorPayload } from '@kisaki3/extension-api'
// Import the manifest module directly: the packages barrel links Electron
// main-process modules, which must stay out of the utility process bundle.
import { readExtensionManifestFile, resolveExtensionFilePath } from '../../packages/manifest'
import {
  createEntityMenuRegistrationMaps,
  createScraperProviderMaps,
  type ExtensionRegistry,
  type LoadedExtensionRuntime
} from './extension-registry'
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

    const abortController = new AbortController()
    const { context, subscriptions, scope } = this.sdkBridge.createExtensionContext({
      extension,
      runtimeHandle,
      abortSignal: abortController.signal
    })
    const entryPath = resolveExtensionFilePath(extension.extensionPath, parsed.manifest.entry)

    let extensionModule: Record<string, unknown>
    try {
      extensionModule = await this.sdkBridge.runInExtensionContext(
        scope,
        () => import(pathToFileURL(entryPath).href) as Promise<Record<string, unknown>>
      )
    } catch (error) {
      abortController.abort()
      await subscriptions.clear()
      await this.sdkBridge.releaseRuntime(runtimeHandle)
      throw error
    }

    const definition = resolveExtensionDefinition(extension.id, extensionModule)

    const runtime: LoadedExtensionRuntime = {
      metadata: extension,
      runtimeHandle,
      generation,
      definition,
      context,
      subscriptions,
      abortController,
      entityMenus: createEntityMenuRegistrationMaps(),
      cardActions: new Map(),
      scraperProviders: createScraperProviderMaps(),
      deeplinkRoutes: new Map(),
      themes: new Map(),
      commands: new Map(),
      webviewPages: new Map(),
      webviewDialogs: new Map()
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

    try {
      if (runtime.definition.deactivate) {
        await this.sdkBridge.runInExtensionContext(runtime, () =>
          runtime.definition.deactivate!(runtime.context)
        )
      }
    } catch (error) {
      deactivateError = toRpcErrorPayload(error)
    }

    await this.sdkBridge.flushRuntime(runtime.runtimeHandle)
    runtime.abortController.abort()

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

    try {
      await runtime.subscriptions.clear()
    } catch (error) {
      console.warn(
        `[ExtensionHost][${runtime.metadata.id}] Failed to clear subscriptions after activation failed:`,
        error
      )
    }

    try {
      await this.sdkBridge.releaseRuntime(runtime.runtimeHandle)
    } catch (error) {
      console.warn(
        `[ExtensionHost][${runtime.metadata.id}] Failed to release runtime after activation failed:`,
        error
      )
    } finally {
      this.registry.delete(runtime.metadata.id)
    }
  }
}

function resolveExtensionDefinition(
  extensionId: string,
  module: Record<string, unknown>
): ExtensionDefinition {
  for (const candidate of createExtensionDefinitionCandidates(module)) {
    const definition = toExtensionDefinition(candidate)
    if (definition) {
      return definition
    }
  }

  throw new Error(
    `Extension "${extensionId}" must export an ExtensionDefinition or activate(context) from its .mjs entry.`
  )
}

function createExtensionDefinitionCandidates(module: Record<string, unknown>): readonly unknown[] {
  return [module.default, module]
}

function toExtensionDefinition(value: unknown): ExtensionDefinition | null {
  if (isExtensionDefinition(value)) {
    return value
  }

  if (isRecord(value) && typeof value.activate === 'function') {
    return {
      activate: value.activate as ExtensionDefinition['activate'],
      deactivate:
        typeof value.deactivate === 'function'
          ? (value.deactivate as ExtensionDefinition['deactivate'])
          : undefined
    }
  }

  return null
}

function isExtensionDefinition(value: unknown): value is ExtensionDefinition {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    typeof (value as ExtensionDefinition).activate === 'function'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}
