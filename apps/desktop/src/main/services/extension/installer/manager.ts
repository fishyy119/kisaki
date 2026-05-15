import path from 'node:path'
import fse from 'fs-extra'
import type {
  ExtensionCreateInstallPlanRequest,
  ExtensionCreateLocalInstallPlanRequest,
  ExtensionInstallFromFileRequest,
  ExtensionInstallPlan
} from '@shared/extension'
import type { ExtensionInstalledEntry } from '../types'
import type { ExtensionInstallationManager } from '../installations'
import type {
  ExtensionPackageDownloader,
  ExtensionPackageExtractor,
  ExtensionPackageLayout,
  ExtensionPackageOperationRegistry,
  ExtensionPackageCommitter,
  ExtensionPackageVerifier
} from '../packages'
import { assertExtensionPackageOperationNotAborted, ExtensionPackagePreparer } from '../packages'
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
  packageOperations: ExtensionPackageOperationRegistry
  runMutatingOperation<T>(operation: () => Promise<T>): Promise<T>
  onInstallationsChanged?: () => void
  onTrustedSignersChanged?: () => void
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
  private readonly packageOperations: ExtensionPackageOperationRegistry

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
    this.packageOperations = options.packageOperations
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

  async installRelease(command: ExtensionInstallReleaseCommand): Promise<ExtensionInstalledEntry> {
    const operationId = command.operationId
    const operation = this.packageOperations.start({
      operationId,
      kind: command.reason === 'update' ? 'update' : 'install',
      extensionId: command.extensionId
    })

    try {
      operation.phase = 'waiting-lock'
      return await this.options.runMutatingOperation(async () => {
        assertExtensionPackageOperationNotAborted(operation.controller.signal)
        const candidate = this.repositories.resolveInstallCandidate(command)
        const plan = this.installPlanner.createRepositoryPlanForCandidate(candidate)
        assertInstallPlanApproved(plan, command.approval)
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

        const prepared = await this.packagePreparer.prepareRepositoryPackage(
          {
            operationId,
            manifest: candidate.manifest,
            registryPackage: candidate.registryPackage,
            release: candidate.release,
            artifact: candidate.artifact,
            signal: operation.controller.signal
          },
          operation
        )

        operation.phase = 'commit'
        return this.commitPreparedRepositoryPackage(candidate, plan, command, prepared.packageDir)
      })
    } catch (error) {
      await this.cleanupPackageOperation(operationId)
      throw error
    } finally {
      this.packageOperations.finish(operationId)
    }
  }

  async installFromFile(
    request: ExtensionInstallFromFileRequest
  ): Promise<ExtensionInstalledEntry> {
    const operationId = request.operationId
    const operation = this.packageOperations.start({
      operationId,
      kind: 'local-import'
    })

    try {
      operation.phase = 'waiting-lock'
      return await this.options.runMutatingOperation(async () => {
        assertExtensionPackageOperationNotAborted(operation.controller.signal)
        const plan = await this.createLocalInstallPlan(
          { sourceKind: 'local-file', filePath: request.filePath },
          operation.controller.signal
        )
        assertInstallPlanConfirmed(plan, request)

        const prepared = await this.packagePreparer.prepareLocalPackage(
          {
            operationId,
            filePath: request.filePath,
            expectedExtensionId: plan.package.id,
            signal: operation.controller.signal
          },
          operation
        )
        const preparedPlan = this.installPlanner.createLocalImportPlan({
          filePath: path.resolve(request.filePath),
          extensionId: prepared.manifest.id,
          name: prepared.manifest.name,
          version: prepared.manifest.version,
          fileSize: prepared.archiveSize,
          artifactSha256: prepared.archiveSha256
        })
        assertInstallPlanConfirmed(preparedPlan, request)

        operation.phase = 'commit'
        return this.commitPreparedLocalPackage(
          operationId,
          request.filePath,
          preparedPlan,
          request.enabled,
          prepared.packageDir,
          prepared.archiveSha256
        )
      })
    } catch (error) {
      await this.cleanupPackageOperation(operationId)
      throw error
    } finally {
      this.packageOperations.finish(operationId)
    }
  }

  cancelOperation(operationId: string): boolean {
    return this.packageOperations.cancel(operationId)
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

  private async commitPreparedRepositoryPackage(
    candidate: ExtensionRepositoryInstallCandidate,
    plan: ExtensionInstallPlan,
    command: ExtensionInstallReleaseCommand,
    stagedPackageDir: string
  ): Promise<ExtensionInstalledEntry> {
    if (!candidate.repository.manifestDigest) {
      throw new Error(`Repository "${candidate.repository.id}" does not have a manifest digest.`)
    }

    const extensionId = candidate.registryPackage.id
    const existing = command.reason === 'update' ? this.installations.require(extensionId) : null
    const enabled = existing?.enabled ?? command.enabled ?? plan.defaultEnabled
    const updatePolicy = existing?.updatePolicy ?? command.updatePolicy ?? plan.updatePolicy
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
        operationId: command.operationId,
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
          channel: candidate.release.channel
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
      await this.cleanupPackageOperation(command.operationId)
      await this.installations.refresh()
      await this.installations.applyRuntimeState({
        cause: command.reason === 'update' ? 'package-update' : 'install',
        forceReloadIds: [extensionId]
      })
      throw error
    }
  }

  private async commitPreparedLocalPackage(
    operationId: string,
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
        operationId,
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
          channel: 'stable'
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
      await this.cleanupPackageOperation(operationId)
      await this.installations.refresh()
      await this.installations.applyRuntimeState({
        cause: 'install',
        forceReloadIds: [extensionId]
      })
      throw error
    }
  }

  private async cleanupPackageOperation(operationId: string): Promise<void> {
    const operationPaths = this.layout.operationPaths(operationId)
    await Promise.all([
      fse.remove(operationPaths.stagingDir).catch(() => undefined),
      fse.remove(operationPaths.downloadPath).catch(() => undefined)
    ])
  }

  private emitInstallationsChanged(): void {
    this.options.onInstallationsChanged?.()
  }

  private emitTrustedSignersChanged(): void {
    this.options.onTrustedSignersChanged?.()
  }
}
