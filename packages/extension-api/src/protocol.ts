import type { SerializableRecord, SerializableValue } from './shared'

export interface SerializableError {
  code?: string
  message: string
  details?: SerializableRecord
  stack?: string
}

export type ProtocolMethod = string

export type ProtocolEventName = string

export interface ProtocolHandshakeRequest {
  protocolVersion: string
  peerVersion?: string
  metadata?: SerializableRecord
}

export interface ProtocolHandshakeResponse {
  protocolVersion: string
  accepted: boolean
  error?: SerializableError
  metadata?: SerializableRecord
}

export interface ProtocolRequestMessage<
  TMethod extends ProtocolMethod = ProtocolMethod,
  TParams extends SerializableValue = SerializableValue
> {
  kind: 'request'
  id: string
  method: TMethod
  params: TParams
}

export interface ProtocolSuccessResponseMessage<
  TResult extends SerializableValue = SerializableValue
> {
  kind: 'response'
  id: string
  ok: true
  result: TResult
}

export interface ProtocolErrorResponseMessage {
  kind: 'response'
  id: string
  ok: false
  error: SerializableError
}

export interface ProtocolEventMessage<
  TName extends ProtocolEventName = ProtocolEventName,
  TPayload extends SerializableValue = SerializableValue
> {
  kind: 'event'
  name: TName
  payload: TPayload
}

export type ProtocolResponseMessage<TResult extends SerializableValue = SerializableValue> =
  | ProtocolSuccessResponseMessage<TResult>
  | ProtocolErrorResponseMessage

export type ProtocolMessage<
  TMethod extends ProtocolMethod = ProtocolMethod,
  TParams extends SerializableValue = SerializableValue,
  TResult extends SerializableValue = SerializableValue,
  TEventName extends ProtocolEventName = ProtocolEventName,
  TEventPayload extends SerializableValue = SerializableValue
> =
  | ProtocolRequestMessage<TMethod, TParams>
  | ProtocolResponseMessage<TResult>
  | ProtocolEventMessage<TEventName, TEventPayload>
