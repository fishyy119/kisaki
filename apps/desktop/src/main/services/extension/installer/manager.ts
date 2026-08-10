import path from 'node:path'
import { rm, stat } from 'node:fs/promises'
import { resolveLocalizedText } from '@kisaki3/extension-api'
import type {
  ExtensionCreateLocalReleasePlanRequest,
  ExtensionCreateReleasePlanRequest,
  ExtensionReleaseAction,
  ExtensionReleasePlan
} from '@shared/extension'
import type {
  TaskRunInitiator,
  TaskRunOperation,
  TaskRunProgressUpdate,
  TaskRunStartResult
} from '@shared/task-run'
import {
  finishTaskRunFromError,
  type TaskRunHandle,
  type TaskRunService
} from '@main/services/task-run'
import type { I18nService } from '@main/services/i18n'
import type { Messages } from '@shared/i18n'
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
import { assertReleasePlanApproved } from './confirmation'
import { createRepositoryInstallationSnapshot, createSignerTrustInputs } from './commit-inputs'
import { ExtensionReleasePlanner } from './planner'
import type {
  ExtensionApplyReleaseCommand,
  ExtensionLocalReleaseCommand,
  ExtensionRepositoryReleaseCommand
} from './types'

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
  i18n: I18nService
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
  private readonly releasePlanner: ExtensionReleasePlanner
  private readonly packagePreparer: ExtensionPackagePreparer
  private readonly packageVerifier: ExtensionPackageVerifier
  private readonly packageCommitter: ExtensionPackageCommitter
  private readonly taskRun: TaskRunService
  private readonly i18n: I18nService

  constructor(private readonly options: ExtensionInstallerManagerOptions) {
    this.layout = options.layout
    this.runtime = options.runtime
    this.repositories = options.repositories
    this.installations = options.installations
    this.signers = options.signers
    this.releasePlanner = new ExtensionReleasePlanner({
      repositories: options.repositories,
      installations: options.installations.store,
      signers: options.signers,
      getInstalledEntry: (extensionId) => options.installations.get(extensionId) ?? null
    })
    this.packagePreparer = new ExtensionPackagePreparer({
      downloader: options.packageDownloader,
      extractor: options.packageExtractor
    })
    this.packageVerifier = options.packageVerifier
    this.packageCommitter = options.packageCommitter
    this.taskRun = options.taskRun
    this.i18n = options.i18n
  }

  async createReleasePlan(
    request: ExtensionCreateReleasePlanRequest
  ): Promise<ExtensionReleasePlan> {
    if (request.sourceKind === 'local-file') {
      return this.createLocalReleasePlan(request)
    }

    return this.releasePlanner.createRepositoryPlan(request)
  }

  createRepositoryReleasePlan(
    candidate: ExtensionRepositoryInstallCandidate
  ): ExtensionReleasePlan {
    return this.releasePlanner.createRepositoryPlanForCandidate(candidate)
  }

  startApplyRelease(command: ExtensionApplyReleaseCommand): TaskRunStartResult {
    const run =
      command.sourceKind === 'local-file'
        ? this.createLocalReleaseRun(command, { type: 'user' })
        : this.createRepositoryReleaseRun(command, { type: 'user' })
    void run.completed.catch(() => undefined)
    return run.start
  }

  runApplyRelease(
    command: ExtensionApplyReleaseCommand,
    initiator: TaskRunInitiator
  ): Promise<ExtensionInstalledEntry> {
    return command.sourceKind === 'local-file'
      ? this.createLocalReleaseRun(command, initiator).completed
      : this.createRepositoryReleaseRun(command, initiator).completed
  }

  private createRepositoryReleaseRun(
    command: ExtensionRepositoryReleaseCommand,
    initiator: TaskRunInitiator
  ): StartedPackageTaskRun<ExtensionInstalledEntry> {
    const candidate = this.repositories.resolveInstallCandidate(command)
    const plan = this.releasePlanner.createRepositoryPlanForCandidate(candidate)
    assertReleasePlanApproved(plan, command.approval)

    const run = this.taskRun.runs.create({
      category: 'extension',
      operation: getPackageOperation(plan),
      title: this.i18n.messages.extension.installer.releaseTitle({
        action: plan.action,
        name: resolveLocalizedText(candidate.registryPackage.name, this.i18n.locale)
      }),
      owner: { type: 'app' },
      initiator,
      subject: {
        type: 'extension',
        id: candidate.registryPackage.id,
        labelSnapshot: resolveLocalizedText(candidate.registryPackage.name, this.i18n.locale)
      },
      controls: { cancelable: true, pausable: false }
    })

    return {
      start: { runId: run.id, createdAt: run.createdAt },
      completed: this.executeRepositoryRelease(run, command, candidate, plan)
    }
  }

  private createLocalReleaseRun(
    command: ExtensionLocalReleaseCommand,
    initiator: TaskRunInitiator
  ): StartedPackageTaskRun<ExtensionInstalledEntry> {
    const run = this.taskRun.runs.create({
      category: 'extension',
      operation: 'extension.package.import',
      title: this.i18n.messages.extension.installer.localTitle,
      owner: { type: 'app' },
      initiator,
      subject: {
        type: 'extension',
        labelSnapshot: path.basename(command.filePath)
      },
      controls: { cancelable: true, pausable: false }
    })

    return {
      start: { runId: run.id, createdAt: run.createdAt },
      completed: this.executeLocalRelease(run, command)
    }
  }

  private async executeRepositoryRelease(
    run: TaskRunHandle,
    command: ExtensionRepositoryReleaseCommand,
    candidate: ExtensionRepositoryInstallCandidate,
    plan: ExtensionReleasePlan
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
        return this.commitPreparedRepositoryPackage({
          candidate,
          plan,
          command,
          workspaceId,
          stagedPackageDir: prepared.packageDir
        })
      })

      run.complete({
        title: this.i18n.messages.extension.installer.completedTitle({ action: plan.action }),
        summary: this.i18n.messages.extension.installer.completedSummary({
          action: plan.action,
          name: this.getInstalledExtensionName(installed),
          version: installed.version ?? 'unknown'
        }),
        output: {
          extensionId: installed.id,
          version: installed.version,
          source: installed.source?.kind
        },
        counters: {
          [getReleaseActionCounter(plan.action)]: 1
        }
      })
      return installed
    } catch (error) {
      await this.cleanupPackageWorkspace(workspaceId)
      finishTaskRunFromError(run, error, {
        cancelledSummary: this.i18n.messages.extension.installer.cancelledSummary({
          action: plan.action
        })
      })
      throw error
    }
  }

  private async executeLocalRelease(
    run: TaskRunHandle,
    command: ExtensionLocalReleaseCommand
  ): Promise<ExtensionInstalledEntry> {
    const workspaceId = run.id
    let completedAction: ExtensionReleasePlan['action'] = 'install'

    try {
      run.start()
      this.reportPackagePhase(run, 'waiting-lock')

      const installed = await this.options.runMutatingOperation(async () => {
        await run.context.checkpoint()
        const initialPlan = await this.createLocalReleasePlan(
          { sourceKind: 'local-file', filePath: command.filePath },
          run.context.signal
        )
        assertReleasePlanApproved(initialPlan, command.approval)

        const prepared = await this.packagePreparer.prepareLocalPackage({
          workspaceId,
          filePath: command.filePath,
          expectedExtensionId: initialPlan.package.id,
          signal: run.context.signal,
          onPhase: (phase) => this.reportPackagePhase(run, phase)
        })
        const preparedPlan = this.releasePlanner.createLocalFilePlan({
          filePath: path.resolve(command.filePath),
          extensionId: prepared.manifest.id,
          name: prepared.manifest.name,
          version: prepared.manifest.version,
          fileSize: prepared.archiveSize,
          artifactSha256: prepared.archiveSha256
        })
        assertReleasePlanApproved(preparedPlan, command.approval)
        completedAction = preparedPlan.action

        await run.context.checkpoint()
        run.updateControls({ cancelable: false })
        this.reportPackagePhase(run, 'commit')
        return this.commitPreparedLocalPackage({
          workspaceId,
          filePath: command.filePath,
          plan: preparedPlan,
          enabledOverride: command.enabled,
          stagedPackageDir: prepared.packageDir,
          artifactSha256: prepared.archiveSha256
        })
      })

      run.complete({
        title: this.i18n.messages.extension.installer.completedTitle({ action: completedAction }),
        summary: this.i18n.messages.extension.installer.completedSummary({
          action: completedAction,
          name: this.getInstalledExtensionName(installed),
          version: installed.version ?? 'unknown'
        }),
        output: {
          extensionId: installed.id,
          version: installed.version,
          source: installed.source?.kind
        },
        counters: {
          [getReleaseActionCounter(completedAction)]: 1
        }
      })
      return installed
    } catch (error) {
      await this.cleanupPackageWorkspace(workspaceId)
      finishTaskRunFromError(run, error, {
        cancelledSummary: this.i18n.messages.extension.installer.localCancelledSummary
      })
      throw error
    }
  }

  private async createLocalReleasePlan(
    request: ExtensionCreateLocalReleasePlanRequest,
    signal?: AbortSignal
  ): Promise<ExtensionReleasePlan> {
    const filePath = path.resolve(request.filePath)
    const fileStat = await stat(filePath)
    if (!fileStat.isFile() || path.extname(filePath).toLowerCase() !== '.kisx') {
      throw new Error('Local extension package must be a .kisx file.')
    }

    const verified = await this.packageVerifier.verifyArchive({
      archivePath: filePath,
      signal
    })

    return this.releasePlanner.createLocalFilePlan({
      filePath,
      extensionId: verified.manifest.id,
      name: verified.manifest.name,
      version: verified.manifest.version,
      fileSize: verified.size,
      artifactSha256: verified.sha256
    })
  }

  private reportPackagePhase(run: TaskRunHandle, phase: ExtensionPackagePhase): void {
    const progress = createPackagePhaseProgress(this.i18n.messages, phase)
    if (progress) {
      run.context.report(progress)
    }
  }

  private getInstalledExtensionName(entry: ExtensionInstalledEntry): string {
    return entry.manifest ? resolveLocalizedText(entry.manifest.name, this.i18n.locale) : entry.id
  }

  private async commitPreparedRepositoryPackage(input: {
    candidate: ExtensionRepositoryInstallCandidate
    plan: ExtensionReleasePlan
    command: ExtensionRepositoryReleaseCommand
    workspaceId: string
    stagedPackageDir: string
  }): Promise<ExtensionInstalledEntry> {
    const { candidate, plan, command, workspaceId, stagedPackageDir } = input
    if (!candidate.repository.manifestDigest) {
      throw new Error(`Repository "${candidate.repository.id}" does not have a manifest digest.`)
    }

    const extensionId = candidate.registryPackage.id
    const existing = this.installations.store.get(extensionId)
    const expectedPrevious = existing ? 'any' : 'none'

    const enabled = existing?.enabled ?? command.enabled ?? plan.defaultEnabled
    const updatePolicy = command.updatePolicy ?? existing?.updatePolicy ?? plan.updatePolicy
    const pinnedVersion = updatePolicy === 'pinned' ? candidate.release.version : null
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
      if (plan.action !== 'install') {
        await this.runtime.unloadExtension(extensionId, 'update')
        await this.installations.syncDevelopmentWatcherTargets(this.runtime.getDesiredExtensions())
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
          installReason: plan.action === 'update' ? 'update' : 'manual',
          updatePolicy,
          pinnedVersion,
          includePreviewUpdates: plan.includePreviewUpdates
        },
        expectedPrevious
      })
      await this.installations.refresh()
      await this.installations.applyRuntimeState({
        cause: plan.action === 'install' ? 'install' : 'package-update',
        forceReloadIds: [extensionId]
      })
      this.emitInstallationsChanged()
      return this.installations.require(extensionId)
    } catch (error) {
      await this.cleanupPackageWorkspace(workspaceId)
      await this.installations.refresh()
      await this.installations.applyRuntimeState({
        cause: plan.action === 'install' ? 'install' : 'package-update',
        forceReloadIds: [extensionId]
      })
      throw error
    }
  }

  private async commitPreparedLocalPackage(input: {
    workspaceId: string
    filePath: string
    plan: ExtensionReleasePlan
    enabledOverride: boolean | undefined
    stagedPackageDir: string
    artifactSha256: string
  }): Promise<ExtensionInstalledEntry> {
    const { workspaceId, filePath, plan, enabledOverride, stagedPackageDir, artifactSha256 } = input
    const extensionId = plan.package.id
    const existing = this.installations.store.get(extensionId)
    const expectedPrevious = existing ? 'any' : 'none'
    const enabled = enabledOverride ?? plan.defaultEnabled

    try {
      if (plan.action !== 'install') {
        await this.runtime.unloadExtension(extensionId, 'update')
        await this.installations.syncDevelopmentWatcherTargets(this.runtime.getDesiredExtensions())
      }

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
        expectedPrevious
      })
      await this.installations.refresh()
      await this.installations.applyRuntimeState({
        cause: plan.action === 'install' ? 'install' : 'package-update',
        forceReloadIds: [extensionId]
      })
      this.emitInstallationsChanged()
      return this.installations.require(extensionId)
    } catch (error) {
      await this.cleanupPackageWorkspace(workspaceId)
      await this.installations.refresh()
      await this.installations.applyRuntimeState({
        cause: plan.action === 'install' ? 'install' : 'package-update',
        forceReloadIds: [extensionId]
      })
      throw error
    }
  }

  private async cleanupPackageWorkspace(workspaceId: string): Promise<void> {
    const workspacePaths = this.layout.workspacePaths(workspaceId)
    await Promise.all([
      rm(workspacePaths.stagingDir, { recursive: true, force: true }).catch(() => undefined),
      rm(workspacePaths.downloadPath, { recursive: true, force: true }).catch(() => undefined)
    ])
  }

  private emitInstallationsChanged(): void {
    this.options.onInstallationsChanged?.()
  }

  private emitTrustedSignersChanged(): void {
    this.options.onTrustedSignersChanged?.()
  }
}

function getPackageOperation(plan: ExtensionReleasePlan): TaskRunOperation {
  if (plan.sourceKind === 'local-file') {
    return 'extension.package.import'
  }

  return plan.action === 'install' ? 'extension.package.install' : 'extension.package.update'
}

function getReleaseActionCounter(action: ExtensionReleaseAction): string {
  switch (action) {
    case 'install':
      return 'installed'
    case 'update':
      return 'updated'
    case 'reinstall':
      return 'reinstalled'
    case 'downgrade':
      return 'downgraded'
  }
}

function createPackagePhaseProgress(
  messages: Messages,
  phase: ExtensionPackagePhase
): TaskRunProgressUpdate {
  const phases = messages.extension.installer.phases
  switch (phase) {
    case 'waiting-lock':
      return {
        phase: {
          key: 'waitingLock',
          label: phases.waitLock,
          current: 1,
          total: 5
        }
      }
    case 'download':
      return {
        phase: {
          key: 'download',
          label: phases.prepare,
          current: 2,
          total: 5
        }
      }
    case 'verify':
      return {
        phase: {
          key: 'verify',
          label: phases.verify,
          current: 3,
          total: 5
        }
      }
    case 'extract':
      return {
        phase: {
          key: 'extract',
          label: phases.extract,
          current: 4,
          total: 5
        }
      }
    case 'commit':
      return {
        phase: {
          key: 'commit',
          label: phases.commit,
          current: 5,
          total: 5
        }
      }
  }
}
