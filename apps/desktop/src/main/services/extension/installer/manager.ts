import path from 'node:path'
import fse from 'fs-extra'
import type {
  ExtensionCreateInstallPlanRequest,
  ExtensionCreateLocalInstallPlanRequest,
  ExtensionInstallFromFileRequest,
  ExtensionInstallPlan
} from '@shared/extension'
import type {
  TaskRunInitiator,
  TaskRunOperation,
  TaskRunProgressUpdate,
  TaskRunStartResult
} from '@shared/task-run'
import {
  isTaskRunCancellation,
  type TaskRunHandle,
  type TaskRunService
} from '@main/services/task-run'
import type { ExtensionInstalledEntry } from '../types'
import type { ExtensionInstallationManager } from '../installations'
import type {
  ExtensionPackageCommitter,
  ExtensionPackageDownloader,
  ExtensionPackageExtractor,
  ExtensionPackageLayout,
  ExtensionPackagePhase,
  ExtensionPackageVerifier
} from '../packages'
import { ExtensionPackagePreparer } from '../packages'
import type { RuntimeManager } from '../runtime'
import type {
  ExtensionRepositoryInstallCandidate,
  ExtensionRepositoryManager
} from '../repositories'
import type { ExtensionSignerTrustManager } from '../signers'
import { assertInstallPlanApproved, assertInstallPlanConfirmed } from './confirmation'
import { createRepositoryInstallationSnapshot, createSignerTrustInputs } from './commit-inputs'
import { ExtensionInstallPlanner } from './planner'
import type { ExtensionInstallReleaseCommand } from './types'

export interface ExtensionInstallerManagerOptions {
  layout: ExtensionPackageLayout
  runtime: RuntimeManager
  repositories: ExtensionRepositoryManager
  installations: ExtensionInstallationManager
  signers: ExtensionSignerTrustManager
  packageDownloader: ExtensionPackageDownloader
  packageExtractor: ExtensionPackageExtractor
  packageVerifier: ExtensionPackageVerifier
  packageCommitter: ExtensionPackageCommitter
  taskRun: TaskRunService
  runMutatingOperation<T>(operation: () => Promise<T>): Promise<T>
  onInstallationsChanged?: () => void
  onTrustedSignersChanged?: () => void
}

interface StartedPackageTaskRun<T> {
  start: TaskRunStartResult
  completed: Promise<T>
}

export class ExtensionInstallerManager {
  private readonly layout: ExtensionPackageLayout
  private readonly runtime: RuntimeManager
  private readonly repositories: ExtensionRepositoryManager
  private readonly installations: ExtensionInstallationManager
  private readonly signers: ExtensionSignerTrustManager
  private readonly installPlanner: ExtensionInstallPlanner
  private readonly packagePreparer: ExtensionPackagePreparer
  private readonly packageVerifier: ExtensionPackageVerifier
  private readonly packageCommitter: ExtensionPackageCommitter
  private readonly taskRun: TaskRunService

  constructor(private readonly options: ExtensionInstallerManagerOptions) {
    this.layout = options.layout
    this.runtime = options.runtime
    this.repositories = options.repositories
    this.installations = options.installations
    this.signers = options.signers
    this.installPlanner = new ExtensionInstallPlanner({
      repositories: options.repositories,
      installations: options.installations.store,
      signers: options.signers
    })
    this.packagePreparer = new ExtensionPackagePreparer({
      downloader: options.packageDownloader,
      extractor: options.packageExtractor
    })
    this.packageVerifier = options.packageVerifier
    this.packageCommitter = options.packageCommitter
    this.taskRun = options.taskRun
  }

  async createInstallPlan(
    request: ExtensionCreateInstallPlanRequest
  ): Promise<ExtensionInstallPlan> {
    if (request.sourceKind === 'local-file') {
      return this.createLocalInstallPlan(request)
    }

    return this.installPlanner.createRepositoryPlan(request)
  }

  createRepositoryInstallPlan(
    candidate: ExtensionRepositoryInstallCandidate
  ): ExtensionInstallPlan {
    return this.installPlanner.createRepositoryPlanForCandidate(candidate)
  }

  startInstallRelease(command: ExtensionInstallReleaseCommand): TaskRunStartResult {
    const run = this.createInstallReleaseRun(command, { type: 'user' })
    void run.completed.catch(() => undefined)
    return run.start
  }

  runInstallRelease(
    command: ExtensionInstallReleaseCommand,
    initiator: TaskRunInitiator
  ): Promise<ExtensionInstalledEntry> {
    return this.createInstallReleaseRun(command, initiator).completed
  }

  startLocalImport(request: ExtensionInstallFromFileRequest): TaskRunStartResult {
    const run = this.createLocalImportRun(request, { type: 'user' })
    void run.completed.catch(() => undefined)
    return run.start
  }

  runLocalImport(
    request: ExtensionInstallFromFileRequest,
    initiator: TaskRunInitiator
  ): Promise<ExtensionInstalledEntry> {
    return this.createLocalImportRun(request, initiator).completed
  }

  private createInstallReleaseRun(
    command: ExtensionInstallReleaseCommand,
    initiator: TaskRunInitiator
  ): StartedPackageTaskRun<ExtensionInstalledEntry> {
    const candidate = this.repositories.resolveInstallCandidate(command)
    const plan = this.installPlanner.createRepositoryPlanForCandidate(candidate)
    assertInstallPlanApproved(plan, command.approval)

    const operation: TaskRunOperation =
      command.reason === 'update' ? 'extension.package.update' : 'extension.package.install'
    const run = this.taskRun.runs.create({
      category: 'extension',
      operation,
      title:
        command.reason === 'update'
          ? `更新扩展 ${candidate.registryPackage.name}`
          : `安装扩展 ${candidate.registryPackage.name}`,
      owner: { type: 'app' },
      initiator,
      subject: {
        type: 'extension',
        id: candidate.registryPackage.id,
        labelSnapshot: candidate.registryPackage.name
      },
      controls: { cancelable: true, pausable: false }
    })

    return {
      start: { runId: run.id, createdAt: run.createdAt },
      completed: this.executeInstallRelease(run, command, candidate, plan)
    }
  }

  private createLocalImportRun(
    request: ExtensionInstallFromFileRequest,
    initiator: TaskRunInitiator
  ): StartedPackageTaskRun<ExtensionInstalledEntry> {
    const run = this.taskRun.runs.create({
      category: 'extension',
      operation: 'extension.package.import',
      title: '导入本地扩展',
      owner: { type: 'app' },
      initiator,
      subject: {
        type: 'extension',
        labelSnapshot: path.basename(request.filePath)
      },
      controls: { cancelable: true, pausable: false }
    })

    return {
      start: { runId: run.id, createdAt: run.createdAt },
      completed: this.executeLocalImport(run, request)
    }
  }

  private async executeInstallRelease(
    run: TaskRunHandle,
    command: ExtensionInstallReleaseCommand,
    candidate: ExtensionRepositoryInstallCandidate,
    plan: ExtensionInstallPlan
  ): Promise<ExtensionInstalledEntry> {
    const workspaceId = run.id

    try {
      run.start()
      this.reportPackagePhase(run, 'waiting-lock')

      const installed = await this.options.runMutatingOperation(async () => {
        await run.context.checkpoint()
        const signerTrusts =
          command.approval.kind === 'user-confirmed' && command.approval.trustSignerFingerprint
            ? createSignerTrustInputs(candidate, plan)
            : []

        for (const signerTrust of signerTrusts) {
          this.signers.trust(signerTrust)
        }
        if (signerTrusts.length > 0) {
          this.emitTrustedSignersChanged()
        }

        const prepared = await this.packagePreparer.prepareRepositoryPackage({
          workspaceId,
          manifest: candidate.manifest,
          registryPackage: candidate.registryPackage,
          release: candidate.release,
          artifact: candidate.artifact,
          signal: run.context.signal,
          onPhase: (phase) => this.reportPackagePhase(run, phase)
        })

        await run.context.checkpoint()
        run.updateControls({ cancelable: false })
        this.reportPackagePhase(run, 'commit')
        return this.commitPreparedRepositoryPackage(
          candidate,
          plan,
          command,
          workspaceId,
          prepared.packageDir
        )
      })

      run.complete({
        title: command.reason === 'update' ? '扩展更新完成' : '扩展安装完成',
        summary:
          command.reason === 'update'
            ? `已更新 ${getInstalledExtensionName(installed)} 到 v${installed.version ?? 'unknown'}`
            : `已安装 ${getInstalledExtensionName(installed)} v${installed.version ?? 'unknown'}`,
        output: {
          extensionId: installed.id,
          version: installed.version,
          source: installed.source?.kind
        },
        counters: {
          [command.reason === 'update' ? 'updated' : 'installed']: 1
        }
      })
      return installed
    } catch (error) {
      await this.cleanupPackageWorkspace(workspaceId)
      this.finishTaskRunFromError(run, error, {
        cancelledSummary: command.reason === 'update' ? '扩展更新已取消' : '扩展安装已取消'
      })
      throw error
    }
  }

  private async executeLocalImport(
    run: TaskRunHandle,
    request: ExtensionInstallFromFileRequest
  ): Promise<ExtensionInstalledEntry> {
    const workspaceId = run.id

    try {
      run.start()
      this.reportPackagePhase(run, 'waiting-lock')

      const installed = await this.options.runMutatingOperation(async () => {
        await run.context.checkpoint()
        const plan = await this.createLocalInstallPlan(
          { sourceKind: 'local-file', filePath: request.filePath },
          run.context.signal
        )
        assertInstallPlanConfirmed(plan, request)

        const prepared = await this.packagePreparer.prepareLocalPackage({
          workspaceId,
          filePath: request.filePath,
          expectedExtensionId: plan.package.id,
          signal: run.context.signal,
          onPhase: (phase) => this.reportPackagePhase(run, phase)
        })
        const preparedPlan = this.installPlanner.createLocalImportPlan({
          filePath: path.resolve(request.filePath),
          extensionId: prepared.manifest.id,
          name: prepared.manifest.name,
          version: prepared.manifest.version,
          fileSize: prepared.archiveSize,
          artifactSha256: prepared.archiveSha256
        })
        assertInstallPlanConfirmed(preparedPlan, request)

        await run.context.checkpoint()
        run.updateControls({ cancelable: false })
        this.reportPackagePhase(run, 'commit')
        return this.commitPreparedLocalPackage(
          workspaceId,
          request.filePath,
          preparedPlan,
          request.enabled,
          prepared.packageDir,
          prepared.archiveSha256
        )
      })

      run.complete({
        title: '扩展导入完成',
        summary: `已导入 ${getInstalledExtensionName(installed)} v${installed.version ?? 'unknown'}`,
        output: {
          extensionId: installed.id,
          version: installed.version,
          source: installed.source?.kind
        },
        counters: {
          imported: 1
        }
      })
      return installed
    } catch (error) {
      await this.cleanupPackageWorkspace(workspaceId)
      this.finishTaskRunFromError(run, error, {
        cancelledSummary: '扩展导入已取消'
      })
      throw error
    }
  }

  private async createLocalInstallPlan(
    request: ExtensionCreateLocalInstallPlanRequest,
    signal?: AbortSignal
  ): Promise<ExtensionInstallPlan> {
    const filePath = path.resolve(request.filePath)
    const stat = await fse.stat(filePath)
    if (!stat.isFile() || path.extname(filePath).toLowerCase() !== '.kisx') {
      throw new Error('Local extension package must be a .kisx file.')
    }

    const verified = await this.packageVerifier.verifyArchive({
      archivePath: filePath,
      signal
    })

    return this.installPlanner.createLocalImportPlan({
      filePath,
      extensionId: verified.manifest.id,
      name: verified.manifest.name,
      version: verified.manifest.version,
      fileSize: verified.size,
      artifactSha256: verified.sha256
    })
  }

  private reportPackagePhase(run: TaskRunHandle, phase: ExtensionPackagePhase): void {
    const progress = createPackagePhaseProgress(phase)
    if (progress) {
      run.context.report(progress)
    }
  }

  private finishTaskRunFromError(
    run: TaskRunHandle,
    error: unknown,
    options: { cancelledSummary: string }
  ): void {
    if (isTaskRunCancellation(error) || run.context.signal.aborted || isAbortError(error)) {
      run.cancel({ summary: options.cancelledSummary })
      return
    }

    run.fail(error)
  }

  private async commitPreparedRepositoryPackage(
    candidate: ExtensionRepositoryInstallCandidate,
    plan: ExtensionInstallPlan,
    command: ExtensionInstallReleaseCommand,
    workspaceId: string,
    stagedPackageDir: string
  ): Promise<ExtensionInstalledEntry> {
    if (!candidate.repository.manifestDigest) {
      throw new Error(`Repository "${candidate.repository.id}" does not have a manifest digest.`)
    }

    const extensionId = candidate.registryPackage.id
    const existing = command.reason === 'update' ? this.installations.require(extensionId) : null
    const enabled = existing?.enabled ?? command.enabled ?? plan.defaultEnabled
    const updatePolicy = existing?.updatePolicy ?? command.updatePolicy ?? plan.updatePolicy
    const includePreviewUpdates = existing?.includePreviewUpdates ?? plan.includePreviewUpdates
    const pinnedVersion =
      command.reason === 'update'
        ? (existing?.pinnedVersion ?? null)
        : updatePolicy === 'pinned'
          ? candidate.release.version
          : null
    const source = {
      kind: 'repository' as const,
      repositoryId: candidate.repository.id,
      repositoryUrl: candidate.repository.url,
      releaseId: candidate.releaseDigest,
      manifestDigest: candidate.repository.manifestDigest,
      artifact: {
        url: candidate.artifact.url,
        sha256: candidate.artifact.sha256
      },
      snapshot: createRepositoryInstallationSnapshot(candidate),
      ...(plan.signer.fingerprint
        ? {
            signature: {
              keyId: plan.signer.keyId,
              fingerprint: plan.signer.fingerprint
            }
          }
        : {})
    }
    try {
      if (command.reason === 'update') {
        await this.runtime.unloadExtension(extensionId, 'update')
        await this.installations.syncReloadWatcherTargets(this.runtime.getDesiredExtensions())
      }

      await this.packageCommitter.putActivePackage({
        workspaceId,
        extensionId,
        stagedPackageDir,
        installation: {
          id: extensionId,
          enabled,
          version: candidate.release.version,
          source,
          installReason: command.reason === 'update' ? 'update' : 'manual',
          updatePolicy,
          pinnedVersion,
          includePreviewUpdates
        },
        expectedPrevious: command.reason === 'update' ? 'present' : 'none'
      })
      await this.installations.refresh()
      await this.installations.applyRuntimeState({
        cause: command.reason === 'update' ? 'package-update' : 'install',
        forceReloadIds: [extensionId]
      })
      this.emitInstallationsChanged()
      return this.installations.require(extensionId)
    } catch (error) {
      await this.cleanupPackageWorkspace(workspaceId)
      await this.installations.refresh()
      await this.installations.applyRuntimeState({
        cause: command.reason === 'update' ? 'package-update' : 'install',
        forceReloadIds: [extensionId]
      })
      throw error
    }
  }

  private async commitPreparedLocalPackage(
    workspaceId: string,
    filePath: string,
    plan: ExtensionInstallPlan,
    enabledOverride: boolean | undefined,
    stagedPackageDir: string,
    artifactSha256: string
  ): Promise<ExtensionInstalledEntry> {
    const extensionId = plan.package.id
    const enabled = enabledOverride ?? plan.defaultEnabled

    try {
      await this.packageCommitter.putActivePackage({
        workspaceId,
        extensionId,
        stagedPackageDir,
        installation: {
          id: extensionId,
          enabled,
          version: plan.package.targetVersion,
          source: {
            kind: 'local-file',
            path: path.resolve(filePath),
            artifactSha256
          },
          installReason: 'local-file',
          updatePolicy: 'manual',
          pinnedVersion: null,
          includePreviewUpdates: false
        },
        expectedPrevious: this.installations.store.get(extensionId) ? 'any' : 'none'
      })
      await this.installations.refresh()
      await this.installations.applyRuntimeState({
        cause: 'install',
        forceReloadIds: [extensionId]
      })
      this.emitInstallationsChanged()
      return this.installations.require(extensionId)
    } catch (error) {
      await this.cleanupPackageWorkspace(workspaceId)
      await this.installations.refresh()
      await this.installations.applyRuntimeState({
        cause: 'install',
        forceReloadIds: [extensionId]
      })
      throw error
    }
  }

  private async cleanupPackageWorkspace(workspaceId: string): Promise<void> {
    const workspacePaths = this.layout.workspacePaths(workspaceId)
    await Promise.all([
      fse.remove(workspacePaths.stagingDir).catch(() => undefined),
      fse.remove(workspacePaths.downloadPath).catch(() => undefined)
    ])
  }

  private emitInstallationsChanged(): void {
    this.options.onInstallationsChanged?.()
  }

  private emitTrustedSignersChanged(): void {
    this.options.onTrustedSignersChanged?.()
  }
}

function createPackagePhaseProgress(phase: ExtensionPackagePhase): TaskRunProgressUpdate {
  switch (phase) {
    case 'waiting-lock':
      return {
        phase: {
          key: 'waitingLock',
          label: '等待扩展包写入锁',
          current: 1,
          total: 5
        }
      }
    case 'download':
      return {
        phase: {
          key: 'download',
          label: '准备扩展安装包',
          current: 2,
          total: 5
        }
      }
    case 'verify':
      return {
        phase: {
          key: 'verify',
          label: '校验扩展安装包',
          current: 3,
          total: 5
        }
      }
    case 'extract':
      return {
        phase: {
          key: 'extract',
          label: '解压扩展安装包',
          current: 4,
          total: 5
        }
      }
    case 'commit':
      return {
        phase: {
          key: 'commit',
          label: '提交扩展安装状态',
          current: 5,
          total: 5
        }
      }
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function getInstalledExtensionName(entry: ExtensionInstalledEntry): string {
  return entry.manifest?.name ?? entry.id
}
