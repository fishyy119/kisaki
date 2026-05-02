import { createUnavailableError, type ExtensionRuntimeMetadata } from '@kisaki/extension-api'
import type { DbService } from '@main/services/db'
import type { EventService } from '@main/services/event'
import type { NetworkService } from '@main/services/network'
import type { NotifyService } from '@main/services/notify'
import type { ExtensionHostRpcClient } from '../runtime/rpc-client'
import { ExtensionEventsCapabilityHost } from './events'
import { ExtensionLibraryCapabilityHost } from './library'
import { ExtensionNetworkCapabilityHost } from './network'
import { ExtensionNotifyCapabilityHost } from './notify'
import { ExtensionRuntimeCapabilityHost } from './runtime'

export interface ExtensionCapabilityGatewayOptions {
  db: DbService
  event: EventService
  network: NetworkService
  notify: NotifyService
  resolveRuntimeHandle(runtimeHandle: string): ExtensionRuntimeMetadata | null | undefined
}

export class ExtensionCapabilityGateway {
  readonly library: ExtensionLibraryCapabilityHost
  readonly network: ExtensionNetworkCapabilityHost
  readonly notify: ExtensionNotifyCapabilityHost
  readonly events: ExtensionEventsCapabilityHost
  readonly runtime: ExtensionRuntimeCapabilityHost

  constructor(options: ExtensionCapabilityGatewayOptions) {
    this.library = new ExtensionLibraryCapabilityHost({
      db: options.db,
      resolveRuntimeHandle: options.resolveRuntimeHandle
    })
    this.network = new ExtensionNetworkCapabilityHost({
      network: options.network,
      resolveRuntimeHandle: options.resolveRuntimeHandle
    })
    this.notify = new ExtensionNotifyCapabilityHost({
      notify: options.notify,
      resolveRuntimeHandle: options.resolveRuntimeHandle
    })
    this.events = new ExtensionEventsCapabilityHost({
      db: options.db,
      event: options.event
    })
    this.runtime = new ExtensionRuntimeCapabilityHost({
      resolveRuntimeHandle: options.resolveRuntimeHandle
    })
  }

  registerRpcHandlers(rpc: ExtensionHostRpcClient): void {
    this.events.attachRpc(rpc)
    this.library.registerRpcHandlers(rpc)

    rpc.handleHostRequest(
      'capabilities.network.request',
      async ({ runtimeHandle, input }, context) => ({
        response: await this.network.request(runtimeHandle, input, context.signal)
      })
    )
    rpc.handleHostRequest(
      'capabilities.network.download',
      async ({ runtimeHandle, input }, context) => ({
        result: await this.network.download(runtimeHandle, input, context.signal)
      })
    )

    rpc.handleHostRequest(
      'capabilities.notify.show',
      async ({ runtimeHandle, kind, title, options }) => {
        return {
          handle: await this.notify.show(runtimeHandle, kind, title, options)
        }
      }
    )
    rpc.handleHostRequest(
      'capabilities.notify.update',
      async ({ runtimeHandle, id, kind, title, options }) => {
        await this.notify.update(runtimeHandle, id, kind, title, options)
        return {}
      }
    )
    rpc.handleHostRequest('capabilities.notify.dismiss', async ({ runtimeHandle, id }) => {
      await this.notify.dismiss(runtimeHandle, id)
      return {}
    })

    rpc.handleHostRequest(
      'capabilities.events.subscribeHost',
      async ({ runtimeHandle, subscriptionId, topic }) => {
        this.requireRuntime(runtimeHandle)
        this.events.subscribeHost(runtimeHandle, subscriptionId, topic)
        return {}
      }
    )
    rpc.handleHostRequest(
      'capabilities.events.unsubscribeHost',
      async ({ runtimeHandle, subscriptionId }) => {
        this.events.unsubscribeHost(runtimeHandle, subscriptionId)
        return {}
      }
    )

    rpc.handleHostRequest('capabilities.runtime.getInfo', async ({ runtimeHandle }) => ({
      info: this.runtime.getInfo(runtimeHandle)
    }))
    rpc.handleHostRequest('capabilities.runtime.openExternal', async ({ runtimeHandle, url }) => {
      await this.runtime.openExternal(runtimeHandle, url)
      return {}
    })
  }

  detachRpc(): void {
    this.events.detachRpc()
  }

  releaseRuntime(runtimeHandle: string): void {
    this.events.releaseRuntime(runtimeHandle)
    this.notify.releaseRuntime(runtimeHandle)
  }

  releaseAll(): void {
    this.events.releaseAll()
    this.notify.releaseAll()
  }

  private requireRuntime(runtimeHandle: string): ExtensionRuntimeMetadata {
    const metadata = this.runtime.getMetadata(runtimeHandle)
    if (!metadata) {
      throw createUnavailableError(`Runtime handle "${runtimeHandle}" is not active.`)
    }

    return metadata
  }
}
