import path from 'node:path'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { unzipSync } from 'fflate'
import type { ExtensionManifest } from '@kisaki3/extension-api'
import { resolveInsideRoot } from '@shared/extension/path-confinement'
import type { ExtensionPackageArchiveStore } from './archive'
import { assertPackageSignalNotAborted } from './types'
import type { ExtensionPackageLayout } from './layout'
import { wrapExtensionPackageError } from './types'
import type { ExtensionPackageVerifier, VerifyExtensionPackageArchiveInput } from './verifier'

export interface ExtractExtensionPackageInput extends VerifyExtensionPackageArchiveInput {
  workspaceId: string
  onPhase?: (phase: 'verify' | 'extract') => void
}

export interface ExtractExtensionPackageResult {
  packageDir: string
  manifest: ExtensionManifest
  archiveSha256: string
  archiveSize: number
}

export class ExtensionPackageExtractor {
  constructor(
    private readonly layout: ExtensionPackageLayout,
    private readonly archiveStore: ExtensionPackageArchiveStore,
    private readonly verifier: ExtensionPackageVerifier
  ) {}

  async extract(input: ExtractExtensionPackageInput): Promise<ExtractExtensionPackageResult> {
    const workspacePaths = this.layout.workspacePaths(input.workspaceId)
    input.onPhase?.('verify')
    const verified = await this.verifier.verifyArchive(input).catch((error: unknown) => {
      throw wrapExtensionPackageError(error, {
        stage: 'verify',
        message: 'Failed to verify extension package archive',
        path: input.archivePath
      })
    })

    await rm(workspacePaths.stagingDir, { recursive: true, force: true }).catch(() => undefined)
    await mkdir(workspacePaths.stagingPackageDir, { recursive: true })

    try {
      assertPackageSignalNotAborted(input.signal)
      input.onPhase?.('extract')
      const archive = unzipSync(await readFile(input.archivePath))
      for (const verifiedEntry of verified.entries) {
        assertPackageSignalNotAborted(input.signal)
        const entryData = archive[verifiedEntry.archiveName]
        if (!entryData) {
          throw new Error(`Verified package entry "${verifiedEntry.archiveName}" was not found.`)
        }

        const targetPath = resolveInsideRoot(
          workspacePaths.stagingPackageDir,
          verifiedEntry.normalizedName
        )
        await mkdir(path.dirname(targetPath), { recursive: true })
        await writeFile(targetPath, entryData)
      }

      await this.verifier.verifyPackageDirectory({
        packageDir: workspacePaths.stagingPackageDir,
        expectedIdentity: {
          extensionId: input.expectedIdentity?.extensionId ?? input.registryPackage?.id,
          version: input.expectedIdentity?.version ?? input.registryRelease?.version,
          categories: input.expectedIdentity?.categories ?? input.registryPackage?.categories,
          enginesKisakiExtensionApi:
            input.expectedIdentity?.enginesKisakiExtensionApi ??
            input.registryRelease?.engines.kisakiExtensionApi
        }
      })

      await this.archiveStore.storeArchive({
        archivePath: input.archivePath,
        sha256: verified.sha256
      })

      return {
        packageDir: workspacePaths.stagingPackageDir,
        manifest: verified.manifest,
        archiveSha256: verified.sha256,
        archiveSize: verified.size
      }
    } catch (error) {
      await rm(workspacePaths.stagingDir, { recursive: true, force: true }).catch(() => undefined)
      throw wrapExtensionPackageError(error, {
        stage: 'extract',
        message: 'Failed to extract extension package archive',
        path: workspacePaths.stagingPackageDir
      })
    }
  }
}
