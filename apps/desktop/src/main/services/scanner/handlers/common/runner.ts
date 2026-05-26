import type { IpcService } from '@main/services/ipc'
import type { EventService } from '@main/services/event'
import type { ScanCompletedData, ScanProgressData } from '@shared/scanner'
import type {
  ScanController,
  ScannerEntityProcessResult,
  ScanQueueItem,
  ScannerRunMetadata
} from './types'

type Awaitable<T> = T | Promise<T>

export interface ScannerHandlerCoordinatorOptions<TScanner extends ScannerRunMetadata> {
  ipcService: IpcService
  eventService: EventService
  loadScanner: (scannerId: string) => Awaitable<TScanner>
  runScan: (scanner: TScanner, session: ScannerRunSession<TScanner>) => Awaitable<void>
}

class ScanAbortError extends Error {
  constructor(scannerId: string) {
    super(`Scanner ${scannerId} was aborted`)
    this.name = 'ScanAbortError'
  }
}

function createScanController(scannerId: string): ScanController {
  return {
    scannerId,
    pauseRequested: false,
    abortRequested: false,
    resumeWaiters: new Set()
  }
}

function createProgressState(
  scannerId: string,
  status: ScanProgressData['status']
): ScanProgressData {
  return {
    scannerId,
    total: 0,
    processedCount: 0,
    newCount: 0,
    skippedCount: 0,
    failedCount: 0,
    skippedScans: [],
    failedScans: [],
    status
  }
}

function cloneProgressState(progressState: ScanProgressData): ScanProgressData {
  return {
    ...progressState,
    skippedScans: [...progressState.skippedScans],
    failedScans: [...progressState.failedScans]
  }
}

function buildScanResult<TScanner extends ScannerRunMetadata>(
  scanner: TScanner,
  status: ScanCompletedData['status'],
  progressState: ScanProgressData
): ScanCompletedData {
  return {
    scannerId: scanner.id,
    scannerName: scanner.name,
    mediaType: scanner.type,
    path: scanner.path,
    status,
    total: progressState.total,
    processedCount: progressState.processedCount,
    newCount: progressState.newCount,
    skippedCount: progressState.skippedCount,
    failedCount: progressState.failedCount,
    skippedScans: [...progressState.skippedScans],
    failedScans: [...progressState.failedScans]
  }
}

function buildScannerStats(result: {
  total: number
  processedCount: number
  newCount: number
  skippedCount: number
  failedCount: number
}): Record<string, number> {
  return {
    total: result.total,
    processedCount: result.processedCount,
    newCount: result.newCount,
    skippedCount: result.skippedCount,
    failedCount: result.failedCount
  }
}

function applyEntityProcessResult(
  entityResult: ScannerEntityProcessResult,
  progressState: ScanProgressData
): void {
  switch (entityResult.kind) {
    case 'processed-only':
      progressState.processedCount++
      break
    case 'new':
      progressState.processedCount++
      progressState.newCount++
      break
    case 'skipped':
      progressState.processedCount++
      progressState.skippedCount++
      progressState.skippedScans.push(entityResult.skippedScan)
      break
    case 'failed':
      progressState.failedCount++
      progressState.failedScans.push(entityResult.failedScan)
      break
    default:
      throw new Error(`Unknown entity result kind: ${(entityResult as { kind: string }).kind}`)
  }
}

function releaseResumeWaiters(controller: ScanController): void {
  const waiters = [...controller.resumeWaiters]
  controller.resumeWaiters.clear()

  for (const waiter of waiters) {
    waiter()
  }
}

export class ScannerRunSession<TScanner extends ScannerRunMetadata> {
  constructor(
    private scanner: TScanner,
    private readonly progressState: ScanProgressData,
    private readonly controllerState: ScanController,
    private readonly publishProgress: (progressState: ScanProgressData) => void
  ) {}

  get scannerId(): string {
    return this.scanner.id
  }

  get progress(): Readonly<ScanProgressData> {
    return this.progressState
  }

  get controller(): Readonly<ScanController> {
    return this.controllerState
  }

  setScanner(scanner: TScanner): void {
    this.scanner = scanner
  }

  start(): void {
    this.setStatus('scanning')
  }

  complete(): void {
    this.setStatus('completed')
  }

  abort(): void {
    this.setStatus('aborted')
  }

  setTotal(total: number): void {
    this.progressState.total = total
    this.publish()
  }

  recordEntityResult(result: ScannerEntityProcessResult): void {
    applyEntityProcessResult(result, this.progressState)
    this.publish()
  }

  buildResult(status: ScanCompletedData['status']): ScanCompletedData {
    return buildScanResult(this.scanner, status, this.progressState)
  }

  async processItemsWithConcurrency<T>(
    items: readonly T[],
    concurrency: number,
    worker: (item: T) => Promise<void>
  ): Promise<void> {
    const workerCount = Math.min(items.length, Math.max(1, concurrency))
    if (workerCount === 0) {
      if (this.controllerState.abortRequested) {
        throw new ScanAbortError(this.scannerId)
      }
      return
    }

    const activeTasks = new Set<Promise<void>>()
    let nextIndex = 0

    const scheduleTasks = (): void => {
      while (
        nextIndex < items.length &&
        activeTasks.size < workerCount &&
        !this.controllerState.pauseRequested &&
        !this.controllerState.abortRequested
      ) {
        const currentItem = items[nextIndex]
        nextIndex++

        const task = worker(currentItem).finally(() => {
          activeTasks.delete(task)
        })
        activeTasks.add(task)
      }
    }

    while (nextIndex < items.length || activeTasks.size > 0) {
      if (this.controllerState.abortRequested) {
        if (activeTasks.size === 0) {
          throw new ScanAbortError(this.scannerId)
        }

        await Promise.race(activeTasks)
        continue
      }

      if (this.controllerState.pauseRequested) {
        if (activeTasks.size > 0) {
          this.setStatus('pausing')
          await Promise.race(activeTasks)
          continue
        }

        this.setStatus('paused')
        await this.waitForResumeOrAbort()

        if (this.controllerState.abortRequested) {
          continue
        }

        this.setStatus('scanning')
        continue
      }

      scheduleTasks()

      if (activeTasks.size === 0) {
        continue
      }

      await Promise.race(activeTasks)
    }

    if (this.controllerState.abortRequested) {
      throw new ScanAbortError(this.scannerId)
    }
  }

  private publish(): void {
    this.publishProgress(this.progressState)
  }

  private setStatus(status: ScanProgressData['status']): void {
    if (this.progressState.status === status) {
      return
    }

    this.progressState.status = status
    this.publish()
  }

  private async waitForResumeOrAbort(): Promise<void> {
    if (!this.controllerState.pauseRequested || this.controllerState.abortRequested) {
      return
    }

    await new Promise<void>((resolve) => {
      const release = () => {
        this.controllerState.resumeWaiters.delete(release)
        resolve()
      }

      this.controllerState.resumeWaiters.add(release)
    })
  }
}

export class ScannerHandlerCoordinator<TScanner extends ScannerRunMetadata> {
  private scannersInProgress = new Set<string>()
  private activeScanProgress = new Map<string, ScanProgressData>()
  private scanControllers = new Map<string, ScanController>()
  private scanQueue: ScanQueueItem<TScanner>[] = []
  private isProcessingQueue = false

  constructor(private readonly options: ScannerHandlerCoordinatorOptions<TScanner>) {}

  getActiveScans(): ScanProgressData[] {
    return [...this.activeScanProgress.values()].map((progressState) =>
      cloneProgressState(progressState)
    )
  }

  async scanScanner(scannerId: string): Promise<ScanCompletedData> {
    if (this.isScannerTracked(scannerId)) {
      throw new Error(`Scanner ${scannerId} is already queued or scanning`)
    }

    const scanner = await this.options.loadScanner(scannerId)
    const controller = createScanController(scannerId)

    this.scanControllers.set(scannerId, controller)
    this.publishScanProgress(createProgressState(scannerId, 'queued'))

    return new Promise((resolve, reject) => {
      this.scanQueue.push({ scannerId, scanner, controller, resolve, reject })
      void this.processQueue()
    })
  }

  pauseScanner(scannerId: string): void {
    const controller = this.scanControllers.get(scannerId)
    const progressState = this.activeScanProgress.get(scannerId)

    if (!controller || !progressState || !this.scannersInProgress.has(scannerId)) {
      throw new Error(`Scanner ${scannerId} is not currently scanning`)
    }

    if (progressState.status === 'paused' || progressState.status === 'pausing') {
      return
    }

    if (progressState.status !== 'scanning') {
      throw new Error(`Scanner ${scannerId} cannot be paused from status ${progressState.status}`)
    }

    controller.pauseRequested = true
    progressState.status = 'pausing'
    this.publishScanProgress(progressState)
  }

  resumeScanner(scannerId: string): void {
    const controller = this.scanControllers.get(scannerId)
    const progressState = this.activeScanProgress.get(scannerId)

    if (!controller || !progressState) {
      throw new Error(`Scanner ${scannerId} is not paused`)
    }

    if (progressState.status !== 'paused' && progressState.status !== 'pausing') {
      throw new Error(`Scanner ${scannerId} cannot be resumed from status ${progressState.status}`)
    }

    controller.pauseRequested = false
    releaseResumeWaiters(controller)
    progressState.status = 'scanning'
    this.publishScanProgress(progressState)
  }

  abortScanner(scannerId: string): void {
    const queuedIndex = this.scanQueue.findIndex((item) => item.scannerId === scannerId)
    if (queuedIndex >= 0) {
      const [item] = this.scanQueue.splice(queuedIndex, 1)
      this.scanControllers.delete(scannerId)

      const progressState =
        this.activeScanProgress.get(scannerId) ?? createProgressState(scannerId, 'queued')
      progressState.status = 'aborted'
      this.publishScanProgress(progressState)
      const result = buildScanResult(item.scanner, 'aborted', progressState)
      this.options.eventService.bus.emit(
        'scanner.finished',
        { local: true },
        {
          scannerId,
          scannerName: item.scanner.name,
          status: 'aborted',
          stats: buildScannerStats(result)
        }
      )
      item.resolve(result)
      return
    }

    const controller = this.scanControllers.get(scannerId)
    const progressState = this.activeScanProgress.get(scannerId)

    if (!controller || !progressState || !this.scannersInProgress.has(scannerId)) {
      throw new Error(`Scanner ${scannerId} is not active`)
    }

    if (progressState.status === 'aborting' || progressState.status === 'aborted') {
      return
    }

    controller.abortRequested = true
    controller.pauseRequested = false
    releaseResumeWaiters(controller)
    progressState.status = 'aborting'
    this.publishScanProgress(progressState)
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.scanQueue.length === 0) {
      return
    }

    this.isProcessingQueue = true

    try {
      while (this.scanQueue.length > 0) {
        const item = this.scanQueue.shift()
        if (!item) break

        try {
          const result = await this.executeQueuedScan(item)
          item.resolve(result)
        } catch (error) {
          item.reject(error)
        } finally {
          this.scanControllers.delete(item.scannerId)
        }
      }
    } finally {
      this.isProcessingQueue = false

      if (this.scanQueue.length > 0) {
        void this.processQueue()
      }
    }
  }

  private async executeQueuedScan(item: ScanQueueItem<TScanner>): Promise<ScanCompletedData> {
    const { scannerId, controller } = item
    if (this.scannersInProgress.has(scannerId)) {
      throw new Error(`Scanner ${scannerId} is already scanning`)
    }

    this.scannersInProgress.add(scannerId)

    const progressState =
      this.activeScanProgress.get(scannerId) ?? createProgressState(scannerId, 'scanning')
    const session = new ScannerRunSession(
      item.scanner,
      progressState,
      controller,
      (nextProgressState) => this.publishScanProgress(nextProgressState)
    )

    let scanner = item.scanner

    try {
      scanner = await this.options.loadScanner(scannerId)
      session.setScanner(scanner)
      this.options.eventService.bus.emit(
        'scanner.started',
        { local: true },
        { scannerId, scannerName: scanner.name }
      )
      session.start()
      await this.options.runScan(scanner, session)
      session.complete()
      const result = session.buildResult('completed')
      this.options.eventService.bus.emit(
        'scanner.finished',
        { local: true },
        {
          scannerId,
          scannerName: scanner.name,
          status: 'completed',
          stats: buildScannerStats(result)
        }
      )
      return result
    } catch (error) {
      if (error instanceof ScanAbortError || controller.abortRequested) {
        session.abort()
        const result = session.buildResult('aborted')
        this.options.eventService.bus.emit(
          'scanner.finished',
          { local: true },
          {
            scannerId,
            scannerName: scanner.name,
            status: 'aborted',
            stats: buildScannerStats(result)
          }
        )
        return result
      }

      this.options.eventService.bus.emit(
        'scanner.finished',
        { local: true },
        {
          scannerId,
          scannerName: scanner.name,
          status: 'failed',
          stats: buildScannerStats(session.progress),
          error: error instanceof Error ? error.message : String(error)
        }
      )
      throw error
    } finally {
      this.scannersInProgress.delete(scannerId)
    }
  }

  private publishScanProgress(progressState: ScanProgressData): void {
    const snapshot = cloneProgressState(progressState)

    if (snapshot.status === 'completed' || snapshot.status === 'aborted') {
      this.activeScanProgress.delete(snapshot.scannerId)
    } else {
      this.activeScanProgress.set(progressState.scannerId, progressState)
    }

    this.options.ipcService.send('scanner:scan-progress', snapshot)
  }

  private isScannerTracked(scannerId: string): boolean {
    return (
      this.scannersInProgress.has(scannerId) ||
      this.scanQueue.some((item) => item.scannerId === scannerId)
    )
  }
}
