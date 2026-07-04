import path from 'node:path'
import AdmZip from 'adm-zip'
import fse from 'fs-extra'
import type { ExtensionManifest } from '@kisaki3/extension-api'
import { resolveInsideRoot } from '../shared/path-confinement'
import type { ExtensionPackageArchiveStore } from './archive'
import { assertPackageSignalNotAborted } from './abort'
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

    await fse.remove(workspacePaths.stagingDir).catch(() => undefined)
    await fse.ensureDir(workspacePaths.stagingPackageDir)

    try {
      assertPackageSignalNotAborted(input.signal)
      input.onPhase?.('extract')
      const zip = new AdmZip(input.archivePath)
      for (const verifiedEntry of verified.entries) {
        assertPackageSignalNotAborted(input.signal)
        const entry = zip.getEntry(verifiedEntry.archiveName)
        if (!entry || entry.isDirectory) {
          throw new Error(`Verified package entry "${verifiedEntry.archiveName}" was not found.`)
        }

        const targetPath = resolveInsideRoot(
          workspacePaths.stagingPackageDir,
          verifiedEntry.normalizedName
        )
        await fse.ensureDir(path.dirname(targetPath))
        await fse.writeFile(targetPath, entry.getData())
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
      await fse.remove(workspacePaths.stagingDir).catch(() => undefined)
      throw wrapExtensionPackageError(error, {
        stage: 'extract',
        message: 'Failed to extract extension package archive',
        path: workspacePaths.stagingPackageDir
      })
    }
  }
}
