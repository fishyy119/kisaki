import type { NetworkDownloadRequest, NetworkRequest } from '@kisaki3/extension-api'
import { toJsonObject, toJsonValue } from '@kisaki3/extension-api'
import { toOptionalJsonField } from './json'

export function toNetworkRequest(input: NetworkRequest): NetworkRequest {
  const record = requireRecord(input, 'network request')
  const normalized: NetworkRequest = {
    url: toJsonValue(record.url, 'network request url') as NetworkRequest['url']
  }
  const method = toOptionalJsonField<NetworkRequest['method']>(
    record.method,
    'network request method'
  )
  const headers = toOptionalStringRecord(record.headers, 'network request headers')
  const query = toOptionalQueryRecord(record.query, 'network request query')
  const timeoutMs = toOptionalJsonField<NetworkRequest['timeoutMs']>(
    record.timeoutMs,
    'network request timeout'
  )
  const responseType = toOptionalJsonField<NetworkRequest['responseType']>(
    record.responseType,
    'network request response type'
  )

  if (method !== undefined) {
    normalized.method = method
  }
  if (headers !== undefined) {
    normalized.headers = headers
  }
  if (query !== undefined) {
    normalized.query = query
  }
  if (record.body !== undefined) {
    normalized.body =
      record.body instanceof Uint8Array
        ? record.body
        : toJsonValue(record.body, 'network request body')
  }
  if (timeoutMs !== undefined) {
    normalized.timeoutMs = timeoutMs
  }
  if (responseType !== undefined) {
    normalized.responseType = responseType
  }

  return normalized
}

export function toNetworkDownloadRequest(input: NetworkDownloadRequest): NetworkDownloadRequest {
  const record = requireRecord(input, 'network download request')
  const normalized: NetworkDownloadRequest = {
    url: toJsonValue(record.url, 'network download url') as NetworkDownloadRequest['url']
  }
  const destinationPath = toOptionalJsonField<NetworkDownloadRequest['destinationPath']>(
    record.destinationPath,
    'network download destination path'
  )
  const fileName = toOptionalJsonField<NetworkDownloadRequest['fileName']>(
    record.fileName,
    'network download file name'
  )
  const headers = toOptionalStringRecord(record.headers, 'network download headers')
  const timeoutMs = toOptionalJsonField<NetworkDownloadRequest['timeoutMs']>(
    record.timeoutMs,
    'network download timeout'
  )

  if (destinationPath !== undefined) {
    normalized.destinationPath = destinationPath
  }
  if (fileName !== undefined) {
    normalized.fileName = fileName
  }
  if (headers !== undefined) {
    normalized.headers = headers
  }
  if (timeoutMs !== undefined) {
    normalized.timeoutMs = timeoutMs
  }

  return normalized
}

function toOptionalStringRecord(value: unknown, label: string): Record<string, string> | undefined {
  if (value === undefined) {
    return undefined
  }

  const record = toJsonObject(value, label)
  const normalized = Object.create(null) as Record<string, string>
  for (const [key, entry] of Object.entries(record)) {
    if (typeof entry !== 'string') {
      throw new Error(`${label}${formatObjectKey(key)} must be a string.`)
    }
    normalized[key] = entry
  }
  return normalized
}

function toOptionalQueryRecord(
  value: unknown,
  label: string
): Record<string, string | number | boolean> | undefined {
  if (value === undefined) {
    return undefined
  }

  const record = toJsonObject(value, label)
  const normalized = Object.create(null) as Record<string, string | number | boolean>
  for (const [key, entry] of Object.entries(record)) {
    if (typeof entry !== 'string' && typeof entry !== 'number' && typeof entry !== 'boolean') {
      throw new Error(`${label}${formatObjectKey(key)} must be a string, number, or boolean.`)
    }
    normalized[key] = entry
  }
  return normalized
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }

  return value as Record<string, unknown>
}

function formatObjectKey(key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`
}
