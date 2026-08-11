import type { ExtensionRuntimeMetadata } from '@kisaki3/extension-api'
import type { AutomationService } from '@main/services/automation'
import type { CommandService } from '@main/services/command'
import type { DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import type { IngestService } from '@main/services/ingest'
import type { NetworkService } from '@main/services/network'
import type { NotifyService } from '@main/services/notify'
import type { ScraperService } from '@main/services/scraper'
import type { TaskRunService } from '@main/services/task-run'
import type { ExtensionHostRpcClient } from '../runtime'
import type { ExtensionWebviewSessionManager } from '../webviews'
import { ExtensionAutomationsCapabilityProvider } from './automations'
import { ExtensionCommandsCapabilityProvider } from './commands'
import { ExtensionFilesCapabilityProvider } from './files'
import { ExtensionIngestCapabilityProvider } from './ingest'
import { ExtensionLibraryCapabilityProvider } from './library'
import { ExtensionNetworkCapabilityProvider } from './network'
import { ExtensionNotifyCapabilityProvider } from './notify'
import { ExtensionRuntimeCapabilityProvider } from './runtime'
import { ExtensionScrapersCapabilityProvider } from './scrapers'
import { ExtensionTaskRunsCapabilityProvider } from './task-runs'
import { ExtensionWebviewsCapabilityProvider } from './webviews'

export interface ExtensionCapabilityGatewayOptions {
  automation: AutomationService
  command: CommandService
  db: DbService
  i18n: I18nService
  ingest: IngestService
  network: NetworkService
  notify: NotifyService
  scraper: ScraperService
  taskRun: TaskRunService
  webviewSessions: ExtensionWebviewSessionManager
  resolveRuntimeHandle(runtimeHandle: string): ExtensionRuntimeMetadata | null | undefined
}

export class ExtensionCapabilityGateway {
  readonly files: ExtensionFilesCapabilityProvider
  readonly library: ExtensionLibraryCapabilityProvider
  readonly network: ExtensionNetworkCapabilityProvider
  readonly notify: ExtensionNotifyCapabilityProvider
  readonly runtime: ExtensionRuntimeCapabilityProvider
  readonly scrapers: ExtensionScrapersCapabilityProvider
  readonly ingest: ExtensionIngestCapabilityProvider
  readonly commands: ExtensionCommandsCapabilityProvider
  readonly automations: ExtensionAutomationsCapabilityProvider
  readonly taskRuns: ExtensionTaskRunsCapabilityProvider
  readonly webviews: ExtensionWebviewsCapabilityProvider

  constructor(options: ExtensionCapabilityGatewayOptions) {
    this.files = new ExtensionFilesCapabilityProvider({
      resolveRuntimeHandle: options.resolveRuntimeHandle
    })
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
    this.runtime = new ExtensionRuntimeCapabilityProvider({
      resolveRuntimeHandle: options.resolveRuntimeHandle,
      getUiLocale: () => options.i18n.locale
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
    this.taskRuns = new ExtensionTaskRunsCapabilityProvider({
      taskRun: options.taskRun,
      command: options.command,
      resolveRuntimeHandle: options.resolveRuntimeHandle
    })
    this.webviews = new ExtensionWebviewsCapabilityProvider({
      sessions: options.webviewSessions,
      resolveRuntimeHandle: options.resolveRuntimeHandle
    })
  }

  registerRpcHandlers(rpc: ExtensionHostRpcClient): void {
    this.taskRuns.attachRpc(rpc)
    this.library.registerRpcHandlers(rpc)

    rpc.handleHostRequest(
      'capabilities.webviews.openPage',
      async ({ runtimeHandle, pageId, options }) =>
        this.webviews.openPage(runtimeHandle, pageId, options)
    )
    rpc.handleHostRequest(
      'capabilities.webviews.openDialog',
      async ({ runtimeHandle, dialogId, options }) =>
        this.webviews.openDialog(runtimeHandle, dialogId, options)
    )
    rpc.handleHostRequest('capabilities.webviews.close', async ({ runtimeHandle, webviewId }) => {
      this.webviews.close(runtimeHandle, webviewId)
      return {}
    })
    rpc.handleHostRequest(
      'capabilities.webviews.postMessage',
      async ({ runtimeHandle, webviewId, message }) => {
        this.webviews.postMessage(runtimeHandle, webviewId, message)
        return {}
      }
    )

    rpc.handleHostRequest('capabilities.files.pickFile', async ({ runtimeHandle, input }) => ({
      grant: await this.files.pickFile(runtimeHandle, input)
    }))
    rpc.handleHostRequest('capabilities.files.releaseGrant', async ({ runtimeHandle, grantId }) => {
      await this.files.releaseGrant(runtimeHandle, grantId)
      return {}
    })
    rpc.handleHostRequest(
      'capabilities.files.getFileIcon',
      async ({ runtimeHandle, path, input }) => ({
        icon: await this.files.getFileIcon(runtimeHandle, path, input)
      })
    )

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
      'capabilities.ingest.game.add.fromScraper',
      async ({ runtimeHandle, profileId, lookup, options }, context) => ({
        result: await this.ingest.addGameFromScraper(
          runtimeHandle,
          profileId,
          lookup,
          options,
          context.signal
        )
      })
    )
    rpc.handleHostRequest(
      'capabilities.ingest.game.add.startFromScraper',
      async ({ runtimeHandle, profileId, lookup, options }) => ({
        start: this.ingest.startAddGameFromScraper(runtimeHandle, profileId, lookup, options)
      })
    )
    rpc.handleHostRequest(
      'capabilities.ingest.game.update.fromScraper',
      async ({ runtimeHandle, input }, context) => ({
        result: await this.ingest.updateGameFromScraper(runtimeHandle, input, context.signal)
      })
    )
    rpc.handleHostRequest(
      'capabilities.ingest.game.update.startFromScraper',
      async ({ runtimeHandle, input }) => ({
        start: this.ingest.startUpdateGameFromScraper(runtimeHandle, input)
      })
    )
    rpc.handleHostRequest(
      'capabilities.ingest.anime.add.fromScraper',
      async ({ runtimeHandle, profileId, lookup, options }, context) => ({
        result: await this.ingest.addAnimeFromScraper(
          runtimeHandle,
          profileId,
          lookup,
          options,
          context.signal
        )
      })
    )
    rpc.handleHostRequest(
      'capabilities.ingest.anime.add.startFromScraper',
      async ({ runtimeHandle, profileId, lookup, options }) => ({
        start: this.ingest.startAddAnimeFromScraper(runtimeHandle, profileId, lookup, options)
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

    rpc.handleHostRequest('capabilities.taskRuns.create', async ({ runtimeHandle, input }) => ({
      run: this.taskRuns.create(runtimeHandle, input)
    }))
    rpc.handleHostRequest(
      'capabilities.taskRuns.report',
      async ({ runtimeHandle, runId, update }) => {
        this.taskRuns.report(runtimeHandle, runId, update)
        return {}
      }
    )
    rpc.handleHostRequest('capabilities.taskRuns.checkpoint', async ({ runtimeHandle, runId }) => {
      await this.taskRuns.checkpoint(runtimeHandle, runId)
      return {}
    })
    rpc.handleHostRequest(
      'capabilities.taskRuns.complete',
      async ({ runtimeHandle, runId, result }) => {
        this.taskRuns.complete(runtimeHandle, runId, result)
        return {}
      }
    )
    rpc.handleHostRequest(
      'capabilities.taskRuns.fail',
      async ({ runtimeHandle, runId, error, result }) => {
        this.taskRuns.fail(runtimeHandle, runId, error, result)
        return {}
      }
    )
    rpc.handleHostRequest(
      'capabilities.taskRuns.cancel',
      async ({ runtimeHandle, runId, result }) => {
        this.taskRuns.cancel(runtimeHandle, runId, result)
        return {}
      }
    )
    rpc.handleHostRequest(
      'capabilities.taskRuns.listActiveOwn',
      async ({ runtimeHandle, query }) => ({
        items: this.taskRuns.listActiveOwn(runtimeHandle, query)
      })
    )
    rpc.handleHostRequest(
      'capabilities.taskRuns.listHistoryOwn',
      async ({ runtimeHandle, query }) => ({
        items: this.taskRuns.listHistoryOwn(runtimeHandle, query)
      })
    )
    rpc.handleHostRequest(
      'capabilities.taskRuns.getActiveOwn',
      async ({ runtimeHandle, runId }) => ({
        run: this.taskRuns.getActiveOwn(runtimeHandle, runId)
      })
    )
    rpc.handleHostRequest(
      'capabilities.taskRuns.getHistoryOwn',
      async ({ runtimeHandle, runId }) => ({
        run: this.taskRuns.getHistoryOwn(runtimeHandle, runId)
      })
    )
    rpc.handleHostRequest('capabilities.taskRuns.cancelOwn', async ({ runtimeHandle, runId }) => ({
      cancelled: this.taskRuns.cancelOwn(runtimeHandle, runId)
    }))
    rpc.handleHostRequest('capabilities.taskRuns.waitOwn', async ({ runtimeHandle, runId }) => ({
      run: await this.taskRuns.waitOwn(runtimeHandle, runId)
    }))
  }

  detachRpc(): void {
    this.taskRuns.detachRpc()
  }

  releaseRuntime(runtimeHandle: string): void {
    this.files.releaseRuntime(runtimeHandle)
    this.notify.releaseRuntime(runtimeHandle)
    this.commands.releaseRuntime(runtimeHandle)
    this.taskRuns.releaseRuntime(runtimeHandle)
  }

  releaseAll(): void {
    this.files.releaseAll()
    this.notify.releaseAll()
    this.commands.releaseAll()
    this.taskRuns.releaseAll()
  }
}
