import type { Disposable, SerializableValue } from '../../shared'

export interface DeeplinkRequest {
  route: string
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
  route: string
  handle(input: DeeplinkRequest): Promise<DeeplinkResponse>
}

export interface DeeplinkRegistrar {
  register(contribution: DeeplinkContribution): Disposable
}
