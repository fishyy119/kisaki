import { createUnavailableError, type ExtensionRuntimeMetadata } from '@kisaki3/extension-api'
import type { AutomationService } from '@main/services/automation'
import type { CommandService } from '@main/services/command'
import type { DbService } from '@main/services/db'
import type { EventService } from '@main/services/event'
import type { IngestService } from '@main/services/ingest'
import type { NetworkService } from '@main/services/network'
import type { NotifyService } from '@main/services/notify'
import type { ScraperService } from '@main/services/scraper'
import type { ExtensionHostRpcClient } from '../runtime'
import { ExtensionAutomationsCapabilityProvider } from './automations'
import { ExtensionCommandsCapabilityProvider } from './commands'
import { ExtensionEventsCapabilityProvider } from './events'
import { ExtensionIngestCapabilityProvider } from './ingest'
import { ExtensionLibraryCapabilityProvider } from './library'
import { ExtensionNetworkCapabilityProvider } from './network'
import { ExtensionNotifyCapabilityProvider } from './notify'
import { ExtensionRuntimeCapabilityProvider } from './runtime'
import { ExtensionScrapersCapabilityProvider } from './scrapers'

export interface ExtensionCapabilityGatewayOptions {
  automation: AutomationService
  command: CommandService
  db: DbService
  event: EventService
  ingest: IngestService
  network: NetworkService
  notify: NotifyService
  scraper: ScraperService
  resolveRuntimeHandle(runtimeHandle: string): ExtensionRuntimeMetadata | null | undefined
}

export class ExtensionCapabilityGateway {
  readonly library: ExtensionLibraryCapabilityProvider
  readonly network: ExtensionNetworkCapabilityProvider
  readonly notify: ExtensionNotifyCapabilityProvider
  readonly events: ExtensionEventsCapabilityProvider
  readonly runtime: ExtensionRuntimeCapabilityProvider
  readonly scrapers: ExtensionScrapersCapabilityProvider
  readonly ingest: ExtensionIngestCapabilityProvider
  readonly commands: ExtensionCommandsCapabilityProvider
  readonly automations: ExtensionAutomationsCapabilityProvider

  constructor(options: ExtensionCapabilityGatewayOptions) {
    this.library = new ExtensionLibraryCapabilityProvider({
      db: options.db,
      resolveRuntimeHandle: options.resolveRuntimeHandle
    })
    this.network = new ExtensionNetworkCapabilityProvider({
      network: options.network,
      resolveRuntimeHandle: options.resolveRuntimeHandle
    })
    this.notify = new ExtensionNotifyCapabilityProvider({
      notify: options.notify,
      resolveRuntimeHandle: options.resolveRuntimeHandle
    })
    this.events = new ExtensionEventsCapabilityProvider({
      db: options.db,
      event: options.event
    })
    this.runtime = new ExtensionRuntimeCapabilityProvider({
      resolveRuntimeHandle: options.resolveRuntimeHandle
    })
    this.scrapers = new ExtensionScrapersCapabilityProvider({
      scraper: options.scraper,
      resolveRuntimeHandle: options.resolveRuntimeHandle
    })
    this.ingest = new ExtensionIngestCapabilityProvider({
      ingest: options.ingest,
      resolveRuntimeHandle: options.resolveRuntimeHandle
    })
    this.commands = new ExtensionCommandsCapabilityProvider({
      command: options.command,
      resolveRuntimeHandle: options.resolveRuntimeHandle
    })
    this.automations = new ExtensionAutomationsCapabilityProvider({
      automation: options.automation,
      command: options.command,
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

    rpc.handleHostRequest(
      'capabilities.scrapers.profiles.list',
      async ({ runtimeHandle, query }) => ({
        items: this.scrapers.listProfiles(runtimeHandle, query)
      })
    )
    rpc.handleHostRequest(
      'capabilities.scrapers.profiles.get',
      async ({ runtimeHandle, profileId }) => ({
        profile: this.scrapers.getProfile(runtimeHandle, profileId)
      })
    )

    rpc.handleHostRequest(
      'capabilities.ingest.games.addFromScraper',
      async ({ runtimeHandle, profileId, lookup, options }) => ({
        result: await this.ingest.addGameFromScraper(runtimeHandle, profileId, lookup, options)
      })
    )

    rpc.handleHostRequest('capabilities.commands.list', async ({ runtimeHandle }) => ({
      items: this.commands.list(runtimeHandle)
    }))
    rpc.handleHostRequest('capabilities.commands.get', async ({ runtimeHandle, commandId }) => ({
      command: this.commands.get(runtimeHandle, commandId)
    }))
    rpc.handleHostRequest('capabilities.commands.invoke', async ({ runtimeHandle, request }) => ({
      result: await this.commands.invoke(runtimeHandle, request)
    }))

    rpc.handleHostRequest('capabilities.automations.list', async ({ runtimeHandle }) => ({
      items: this.automations.list(runtimeHandle)
    }))
    rpc.handleHostRequest(
      'capabilities.automations.get',
      async ({ runtimeHandle, automationId }) => ({
        automation: this.automations.get(runtimeHandle, automationId)
      })
    )
    rpc.handleHostRequest('capabilities.automations.create', async ({ runtimeHandle, input }) => ({
      automation: await this.automations.create(runtimeHandle, input)
    }))
    rpc.handleHostRequest(
      'capabilities.automations.update',
      async ({ runtimeHandle, automationId, patch }) => ({
        automation: await this.automations.update(runtimeHandle, automationId, patch)
      })
    )
    rpc.handleHostRequest(
      'capabilities.automations.setEnabled',
      async ({ runtimeHandle, automationId, enabled }) => ({
        automation: await this.automations.setEnabled(runtimeHandle, automationId, enabled)
      })
    )
    rpc.handleHostRequest(
      'capabilities.automations.delete',
      async ({ runtimeHandle, automationId }) => {
        await this.automations.delete(runtimeHandle, automationId)
        return {}
      }
    )
    rpc.handleHostRequest(
      'capabilities.automations.run',
      async ({ runtimeHandle, automationId }) => ({
        record: await this.automations.run(runtimeHandle, automationId)
      })
    )
  }

  detachRpc(): void {
    this.events.detachRpc()
  }

  releaseRuntime(runtimeHandle: string): void {
    this.events.releaseRuntime(runtimeHandle)
    this.notify.releaseRuntime(runtimeHandle)
    this.commands.releaseRuntime(runtimeHandle)
  }

  releaseAll(): void {
    this.events.releaseAll()
    this.notify.releaseAll()
    this.commands.releaseAll()
  }

  private requireRuntime(runtimeHandle: string): ExtensionRuntimeMetadata {
    const metadata = this.runtime.getMetadata(runtimeHandle)
    if (!metadata) {
      throw createUnavailableError(`Runtime handle "${runtimeHandle}" is not active.`)
    }

    return metadata
  }
}
