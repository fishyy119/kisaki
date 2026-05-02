import log from 'electron-log/main'
import {
  normalizeCapabilityError,
  type ExtensionRuntimeHandle,
  type ExtensionRuntimeMetadata,
  type RpcValue
} from '@kisaki/extension-api'
import type { ExtensionCapabilityGateway } from '../capabilities'
import type { ExtensionContributionRegistry } from '../contributions/registry'
import type { ExtensionHostRpcClient } from './rpc-client'
import type { ExtensionRuntimeSecrets } from './secrets'
import type { ExtensionRuntimeStorage } from './storage'

const EMPTY_RPC_RESULT = Object.freeze({})

export interface HostRequestOptions {
  rpc: ExtensionHostRpcClient
  storage: ExtensionRuntimeStorage
  secrets: ExtensionRuntimeSecrets
  capabilities?: ExtensionCapabilityGateway
  contributions?: ExtensionContributionRegistry
  resolveRuntimeHandle(runtimeHandle: ExtensionRuntimeHandle): ExtensionRuntimeMetadata | null
}

export function registerHostRequests(options: HostRequestOptions): void {
  options.rpc.handleHostRequest('runtime.logger.log', async (params) => {
    try {
      const extension = requireRuntimeHandle(options, params.runtimeHandle)
      writeExtensionLog(extension.id, params.level, params.message, params.args)
      return EMPTY_RPC_RESULT
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to write extension log.')
    }
  })

  options.rpc.handleHostRequest('runtime.storage.get', async (params, context) => {
    try {
      const value = await options.storage.get(
        params.runtimeHandle,
        params.key,
        params.fallback,
        context.signal
      )
      return { value }
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to read extension storage.')
    }
  })

  options.rpc.handleHostRequest('runtime.storage.set', async (params, context) => {
    try {
      await options.storage.set(params.runtimeHandle, params.key, params.value, context.signal)
      return EMPTY_RPC_RESULT
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to write extension storage.')
    }
  })

  options.rpc.handleHostRequest('runtime.storage.delete', async (params, context) => {
    try {
      await options.storage.delete(params.runtimeHandle, params.key, context.signal)
      return EMPTY_RPC_RESULT
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to delete extension storage value.')
    }
  })

  options.rpc.handleHostRequest('runtime.storage.listKeys', async (params, context) => {
    try {
      const keys = await options.storage.listKeys(
        params.runtimeHandle,
        params.prefix,
        context.signal
      )
      return { keys }
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to list extension storage keys.')
    }
  })

  options.rpc.handleHostRequest('runtime.secrets.get', async (params, context) => {
    try {
      const value = await options.secrets.get(params.runtimeHandle, params.key, context.signal)
      return value === undefined ? EMPTY_RPC_RESULT : { value }
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to read extension secret.')
    }
  })

  options.rpc.handleHostRequest('runtime.secrets.set', async (params, context) => {
    try {
      await options.secrets.set(params.runtimeHandle, params.key, params.value, context.signal)
      return EMPTY_RPC_RESULT
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to write extension secret.')
    }
  })

  options.rpc.handleHostRequest('runtime.secrets.delete', async (params, context) => {
    try {
      await options.secrets.delete(params.runtimeHandle, params.key, context.signal)
      return EMPTY_RPC_RESULT
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to delete extension secret.')
    }
  })

  options.rpc.handleHostRequest('runtime.secrets.listKeys', async (params, context) => {
    try {
      const keys = await options.secrets.listKeys(
        params.runtimeHandle,
        params.prefix,
        context.signal
      )
      return { keys }
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to list extension secret keys.')
    }
  })

  options.contributions?.registerRpcHandlers(options.rpc)
  options.capabilities?.registerRpcHandlers(options.rpc)
}

function requireRuntimeHandle(
  options: HostRequestOptions,
  runtimeHandle: ExtensionRuntimeHandle
): ExtensionRuntimeMetadata {
  const extension = options.resolveRuntimeHandle(runtimeHandle)
  if (!extension) {
    throw new Error(`Runtime handle "${runtimeHandle}" is not active.`)
  }

  return extension
}

function writeExtensionLog(
  extensionId: string,
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  args: readonly RpcValue[]
): void {
  const prefix = `[ExtensionHost][${extensionId}] ${message}`

  switch (level) {
    case 'debug':
      log.debug(prefix, ...args)
      break
    case 'info':
      log.info(prefix, ...args)
      break
    case 'warn':
      log.warn(prefix, ...args)
      break
    case 'error':
      log.error(prefix, ...args)
      break
  }
}
