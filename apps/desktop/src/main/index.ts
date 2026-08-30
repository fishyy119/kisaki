import { app } from 'electron'
import path from 'node:path'
import { isDev, isMacOS, isWindows } from './env'
import { createLogger, configureLogger, initializeLogger } from './log'

// Services
import { container } from './container'
import { DbService } from './services/db'
import { FileWatchService } from './services/file-watch'
import { IpcService, wrapIpc, wrapIpcVoid } from './services/ipc'
import { WindowService } from './services/window'
import { NativeService } from './services/native'
import { I18nService } from './services/i18n'
import { ScraperService } from './services/scraper'
import { ProcessService } from './services/process'
import { VideoService } from './services/video'
import { HoldingsService } from './services/holdings'
import { ReaderService } from './services/reader'
import { ActivityService } from './services/activity'
import { IngestService } from './services/ingest'
import { ScannerService } from './services/scanner'
import { AttachmentService } from './services/attachment'
import { ExtensionService } from './services/extension'
import { NetworkService } from './services/network'
import { NotifyService } from './services/notify'
import { DeeplinkService } from './services/deeplink'
import { UpdaterService } from './services/updater'
import { CommandService } from './services/command'
import { AutomationService } from './services/automation'
import { TaskRunService } from './services/task-run'

// Bootstrap (pre-ready modules)
import { registerAppSchemes, DEEPLINK_SCHEME } from './bootstrap/protocol'
import { detectPortableMode, setupPortableIpc } from './bootstrap/portable'
import { getBootstrapArgs, setupBootstrapArgsIpc } from './bootstrap/args'
import { bootstrapHooks, APP_SHUTDOWN_SETTLE_BUDGET_MS } from './bootstrap/hooks'

const log = createLogger('App')

function printCliHelp(): void {
  console.log('Kisaki - ACGN Library Manager')
  console.log('')
  console.log('Usage:')
  console.log('  kisaki [options]')
  console.log('')
  console.log('Options:')
  console.log('  -h, --help                 Show this help and exit')
  console.log('  -V, --version              Print version and exit')
  console.log('      --inspect-extension-host[=<host:port>]')
  console.log('                              Enable extension host inspector')
  console.log('      --inspect-brk-extension-host[=<host:port>]')
  console.log('                              Enable extension host inspector and break on start')
  console.log('')
  console.log('Environment:')
  console.log('  KISAKI_DEV_EXTENSIONS      JSON array of development extension entries')
  console.log('')
  console.log('Examples:')
  console.log('  kisaki --version')
  console.log('  kisaki --help')
  console.log('  kisaki --inspect-extension-host=9339')
}

const bootstrapArgs = getBootstrapArgs()
if (bootstrapArgs.help) {
  printCliHelp()
  process.exit(0)
}

if (bootstrapArgs.version) {
  console.log(app.getVersion())
  process.exit(0)
}

// Register custom protocols before app is ready
registerAppSchemes()

// Register as default protocol handler for kisaki://
// This must be done before app.whenReady()
if (process.defaultApp) {
  // Development: need to pass the script path
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(DEEPLINK_SCHEME, process.execPath, [
      path.resolve(process.argv[1]!)
    ])
  }
} else {
  // Production: just register the protocol
  app.setAsDefaultProtocolClient(DEEPLINK_SCHEME)
}

// Request single instance lock to handle deeplinks properly
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

// Setup userData path before app is ready
// In dev build: use local dev/app folder
// In production: detect portable mode or use default userData
if (isDev) {
  app.setPath('userData', path.join(process.cwd(), 'dev/app'))
  // Dev assets come from the local Vite server, so the Chromium disk cache
  // adds no value; it only risks corrupted entries (ERR_CACHE_READ_FAILURE)
  // when watch rebuilds force-kill Electron mid-write.
  app.commandLine.appendSwitch('disable-http-cache')
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
async function onAppReady(): Promise<void> {
  if (isWindows) {
    app.setAppUserModelId('me.kisaki')
  }

  // Services register first, then initialize in dependency order via
  // container.initAll(); registration order itself does not matter, so they are
  // grouped by layer to keep the architecture readable.

  // Platform: Electron, OS, and transport adapters
  container.register(new IpcService())
  container.register(new DbService())
  container.register(new WindowService())
  container.register(new NativeService())
  container.register(new NotifyService())
  container.register(new NetworkService())
  container.register(new DeeplinkService())
  container.register(new UpdaterService())
  container.register(new I18nService())

  // Capability: no domain vocabulary, no library rows
  container.register(new TaskRunService())
  container.register(new FileWatchService())
  container.register(new ProcessService())
  container.register(new VideoService())
  container.register(new ReaderService())

  // Domain: library ownership, grows per media type
  container.register(new ScraperService())
  container.register(new IngestService())
  container.register(new ScannerService())
  container.register(new HoldingsService())
  container.register(new ActivityService())
  container.register(new AttachmentService())
  container.register(new CommandService())
  container.register(new AutomationService())
  container.register(new ExtensionService())

  await container.initAll()
  log.info('All services initialized')

  // Setup portable IPC handlers (after services are ready)
  const ipcService = container.get('ipc')
  setupBootstrapArgsIpc(ipcService)
  setupPortableIpc(ipcService)

  ipcService.handle('app:get-version', () => {
    return wrapIpc(() => app.getVersion())
  })

  ipcService.handle('app:quit', () => {
    return wrapIpcVoid(() => {
      setImmediate(() => app.quit())
    })
  })

  // Create main window first (so renderer IPC listeners are ready)
  const windowService = container.get('window')
  windowService.mainWindow.create()
  windowService.tray.create()

  bootstrapHooks.appReady.dispatch()

  const automationService = container.get('automation')
  automationService.runStartupAutomations().catch((error) => {
    log.error('Startup automations failed.', error)
  })

  // Mark deeplink service as ready and process any pending deeplinks
  const deeplinkService = container.get('deeplink')
  deeplinkService.markReady()

  // Handle deeplink from startup arguments (Windows/Linux)
  const startupDeeplink = process.argv.find((arg) => arg.startsWith(`${DEEPLINK_SCHEME}://`))
  if (startupDeeplink) {
    deeplinkService.handleDeeplink(startupDeeplink).catch((error) => {
      log.error('Failed to handle startup deeplink.', error)
    })
  }

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (windowService.windows.getAll().length === 0) {
      windowService.mainWindow.create()
      windowService.tray.create()
    }
  })
}

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (!isMacOS) {
    app.quit()
  }
})

// Cleanup before app quits
let shutdownInProgress = false

app.on('before-quit', (event) => {
  if (shutdownInProgress) return
  shutdownInProgress = true
  event.preventDefault()

  const forceExitTimer = setTimeout(() => {
    log.warn('Force exiting after shutdown timeout.')
    app.exit(1)
  }, 5000)

  ;(async () => {
    try {
      // Give hook subscribers (extension host is still alive here) a bounded
      // window to flush state before services are torn down.
      await bootstrapHooks.appShuttingDown.settle(undefined, {
        budgetMs: APP_SHUTDOWN_SETTLE_BUDGET_MS
      })
      log.info('Disposing all services.')
      await container.disposeAll()
      log.info('All services disposed.')
    } catch (error) {
      log.error('Shutdown failed.', error)
    } finally {
      clearTimeout(forceExitTimer)
      app.exit(0)
    }
  })()
})

// Do not top-level await app.whenReady(): Electron defers 'ready' until the
// ESM entry module finishes evaluating, so awaiting it here would deadlock.
void (async () => {
  try {
    if (!isDev) {
      await detectPortableMode()
    }

    configureLogger()
    initializeLogger()

    if (bootstrapArgs.developmentExtensions.length > 0) {
      log.info('Development extensions requested.', {
        developmentExtensions: bootstrapArgs.developmentExtensions.map(
          (extension) => extension.path
        )
      })
    }

    if (bootstrapArgs.extensionHostInspect) {
      log.info('Extension host inspector requested.', bootstrapArgs.extensionHostInspect)
    }

    await app.whenReady()
    await onAppReady()
  } catch (error) {
    configureLogger()
    initializeLogger()
    log.error('Failed during app ready bootstrap.', error)
    app.exit(1)
  }
})()
