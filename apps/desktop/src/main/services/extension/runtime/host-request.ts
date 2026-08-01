import {
  createValidationError,
  normalizeCapabilityError,
  type ExtensionRuntimeDiagnostic,
  type ExtensionRuntimeDiagnosticSeverity,
  type ExtensionRuntimeHandle,
  type ExtensionRuntimeMetadata
} from '@kisaki3/extension-api'
import type { ExtensionCapabilityGateway } from '../capabilities'
import type { ExtensionContributionRegistry } from '../contributions'
import type { ExtensionWebviewSessionManager } from '../webviews'
import type { ExtensionHostRpcClient } from './rpc-client'
import type { ExtensionRuntimeLogs } from './logs'
import type { ExtensionRuntimeSecrets } from './secrets'
import type { ExtensionRuntimeStorage } from './storage'

const EMPTY_RPC_RESULT = Object.freeze({})

export interface HostRequestOptions {
  rpc: ExtensionHostRpcClient
  logs: ExtensionRuntimeLogs
  storage: ExtensionRuntimeStorage
  secrets: ExtensionRuntimeSecrets
  capabilities?: ExtensionCapabilityGateway
  contributions?: ExtensionContributionRegistry
  webviews?: ExtensionWebviewSessionManager
  resolveRuntimeHandle(runtimeHandle: ExtensionRuntimeHandle): ExtensionRuntimeMetadata | null
  reportDiagnostic(
    runtimeHandle: ExtensionRuntimeHandle,
    diagnostic: ExtensionRuntimeDiagnostic
  ): void
}

export function registerHostRequests(options: HostRequestOptions): void {
  options.rpc.handleHostRequest('runtime.logger.log', async (params, context) => {
    try {
      await options.logs.write(
        params.runtimeHandle,
        params.level,
        params.message,
        params.args,
        context.signal
      )
      return EMPTY_RPC_RESULT
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to write extension log.')
    }
  })

  options.rpc.handleHostRequest('runtime.diagnostics.report', async (params) => {
    try {
      requireRuntimeHandle(options, params.runtimeHandle)
      options.reportDiagnostic(params.runtimeHandle, validateDiagnostic(params.diagnostic))
      return EMPTY_RPC_RESULT
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to report extension runtime diagnostic.')
    }
  })

  options.rpc.handleHostRequest('runtime.storage.get', async (params, context) => {
    try {
      const value = await options.storage.get(params.runtimeHandle, params.key, context.signal)
      return value === undefined ? EMPTY_RPC_RESULT : { value }
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
  options.webviews?.attachRpc(options.rpc)
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

const DIAGNOSTIC_SEVERITIES: readonly ExtensionRuntimeDiagnosticSeverity[] = [
  'info',
  'warning',
  'error'
]

const DIAGNOSTIC_KEYS = new Set<string>([
  'severity',
  'source',
  'code',
  'message',
  'details',
  'createdAt'
])

function validateDiagnostic(diagnostic: ExtensionRuntimeDiagnostic): ExtensionRuntimeDiagnostic {
  if (!diagnostic || typeof diagnostic !== 'object' || Array.isArray(diagnostic)) {
    throw createValidationError('diagnostic must be an object.')
  }

  for (const key of Object.keys(diagnostic)) {
    if (!DIAGNOSTIC_KEYS.has(key)) {
      throw createValidationError(`diagnostic contains an unknown field "${key}".`)
    }
  }

  if (!DIAGNOSTIC_SEVERITIES.includes(diagnostic.severity)) {
    throw createValidationError(
      `diagnostic.severity must be one of: ${DIAGNOSTIC_SEVERITIES.join(', ')}.`
    )
  }

  requireDiagnosticString(diagnostic.source, 'diagnostic.source')
  requireDiagnosticString(diagnostic.code, 'diagnostic.code')
  requireDiagnosticString(diagnostic.message, 'diagnostic.message')
  requireDiagnosticString(diagnostic.createdAt, 'diagnostic.createdAt')
  if (diagnostic.details !== undefined && typeof diagnostic.details !== 'string') {
    throw createValidationError('diagnostic.details must be a string.')
  }

  return diagnostic
}

function requireDiagnosticString(value: unknown, label: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw createValidationError(`${label} must be a non-empty string.`)
  }
}
