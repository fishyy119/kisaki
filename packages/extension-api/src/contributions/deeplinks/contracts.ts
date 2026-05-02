import type { Disposable, SerializableValue } from '../../shared'

export interface DeeplinkRequest {
  path: string
  params: Record<string, string>
  rawUrl: string
}

export interface DeeplinkResponse {
  success: boolean
  status?: 'handled' | 'ignored' | 'error'
  message?: string
  data?: SerializableValue
}

export interface DeeplinkContribution {
  id: string
  path: string
  handle(input: DeeplinkRequest): Promise<DeeplinkResponse>
}

export interface DeeplinkRegistrationHandle extends Disposable {
  readonly url: string
}

export interface DeeplinkRegistrar {
  register(contribution: DeeplinkContribution): DeeplinkRegistrationHandle
}
