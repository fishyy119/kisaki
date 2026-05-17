import { createUnavailableError, type ExtensionRuntimeMetadata } from '@kisaki/extension-api'
import type { BackgroundTaskService } from '@main/services/background-task'
import type { CommandService } from '@main/services/command'
import type { DbService } from '@main/services/db'
import type { EventService } from '@main/services/event'
import type { IngestService } from '@main/services/ingest'
import type { NetworkService } from '@main/services/network'
import type { NotifyService } from '@main/services/notify'
import type { ScraperService } from '@main/services/scraper'
import type { ExtensionHostRpcClient } from '../runtime'
import { ExtensionBackgroundTasksCapabilityProvider } from './background-tasks'
import { ExtensionCommandsCapabilityProvider } from './commands'
import { ExtensionEventsCapabilityProvider } from './events'
import { ExtensionIngestCapabilityProvider } from './ingest'
import { ExtensionLibraryCapabilityProvider } from './library'
import { ExtensionNetworkCapabilityProvider } from './network'
import { ExtensionNotifyCapabilityProvider } from './notify'
import { ExtensionRuntimeCapabilityProvider } from './runtime'
import { ExtensionScrapersCapabilityProvider } from './scrapers'

export interface ExtensionCapabilityGatewayOptions {
  backgroundTask: BackgroundTaskService
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
  readonly backgroundTasks: ExtensionBackgroundTasksCapabilityProvider

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
    this.backgroundTasks = new ExtensionBackgroundTasksCapabilityProvider({
      backgroundTask: options.backgroundTask,
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
    rpc.handleHostRequest('capabilities.commands.start', async ({ runtimeHandle, request }) => ({
      result: this.commands.start(runtimeHandle, request)
    }))
    rpc.handleHostRequest('capabilities.commands.wait', async ({ runtimeHandle, executionId }) => ({
      result: await this.commands.wait(runtimeHandle, executionId)
    }))
    rpc.handleHostRequest(
      'capabilities.commands.getProgress',
      async ({ runtimeHandle, executionId }) => ({
        progress: this.commands.getProgress(runtimeHandle, executionId)
      })
    )
    rpc.handleHostRequest('capabilities.commands.execute', async ({ runtimeHandle, request }) => ({
      result: await this.commands.execute(runtimeHandle, request)
    }))
    rpc.handleHostRequest(
      'capabilities.commands.cancel',
      async ({ runtimeHandle, executionId }) => ({
        cancelled: this.commands.cancel(runtimeHandle, executionId)
      })
    )

    rpc.handleHostRequest('capabilities.backgroundTasks.list', async ({ runtimeHandle }) => ({
      items: this.backgroundTasks.list(runtimeHandle)
    }))
    rpc.handleHostRequest(
      'capabilities.backgroundTasks.get',
      async ({ runtimeHandle, taskId }) => ({
        task: this.backgroundTasks.get(runtimeHandle, taskId)
      })
    )
    rpc.handleHostRequest(
      'capabilities.backgroundTasks.create',
      async ({ runtimeHandle, input }) => ({
        task: await this.backgroundTasks.create(runtimeHandle, input)
      })
    )
    rpc.handleHostRequest(
      'capabilities.backgroundTasks.update',
      async ({ runtimeHandle, taskId, patch }) => ({
        task: await this.backgroundTasks.update(runtimeHandle, taskId, patch)
      })
    )
    rpc.handleHostRequest(
      'capabilities.backgroundTasks.setEnabled',
      async ({ runtimeHandle, taskId, enabled }) => ({
        task: await this.backgroundTasks.setEnabled(runtimeHandle, taskId, enabled)
      })
    )
    rpc.handleHostRequest(
      'capabilities.backgroundTasks.delete',
      async ({ runtimeHandle, taskId }) => {
        await this.backgroundTasks.delete(runtimeHandle, taskId)
        return {}
      }
    )
    rpc.handleHostRequest(
      'capabilities.backgroundTasks.run',
      async ({ runtimeHandle, taskId }) => ({
        record: await this.backgroundTasks.run(runtimeHandle, taskId)
      })
    )
    rpc.handleHostRequest(
      'capabilities.backgroundTasks.cancel',
      async ({ runtimeHandle, taskId }) => ({
        cancelled: this.backgroundTasks.cancel(runtimeHandle, taskId)
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
