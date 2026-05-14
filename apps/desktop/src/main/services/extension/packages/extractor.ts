import path from 'node:path'
import AdmZip from 'adm-zip'
import fse from 'fs-extra'
import type { ExtensionManifest } from '@kisaki/extension-api'
import { resolveInsideRoot } from '../shared/path-confinement'
import type { ExtensionPackageArchiveStore } from './archive'
import type { ExtensionPackageLayout } from './layout'
import { assertExtensionPackageOperationNotAborted } from './operations'
import { wrapExtensionPackageError } from './types'
import type { ExtensionPackageVerifier, VerifyExtensionPackageArchiveInput } from './verifier'

export interface ExtractExtensionPackageInput extends VerifyExtensionPackageArchiveInput {
  operationId: string
}

export interface ExtractExtensionPackageResult {
  operationId: string
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
    const operationPaths = this.layout.operationPaths(input.operationId)
    const verified = await this.verifier.verifyArchive(input).catch((error: unknown) => {
      throw wrapExtensionPackageError(error, {
        stage: 'verify',
        message: 'Failed to verify extension package archive',
        path: input.archivePath
      })
    })

    await fse.remove(operationPaths.stagingDir).catch(() => undefined)
    await fse.ensureDir(operationPaths.stagingPackageDir)

    try {
      assertExtensionPackageOperationNotAborted(input.signal)
      const zip = new AdmZip(input.archivePath)
      for (const verifiedEntry of verified.entries) {
        assertExtensionPackageOperationNotAborted(input.signal)
        const entry = zip.getEntry(verifiedEntry.archiveName)
        if (!entry || entry.isDirectory) {
          throw new Error(`Verified package entry "${verifiedEntry.archiveName}" was not found.`)
        }

        const targetPath = resolveInsideRoot(
          operationPaths.stagingPackageDir,
          verifiedEntry.normalizedName
        )
        await fse.ensureDir(path.dirname(targetPath))
        await fse.writeFile(targetPath, entry.getData())
      }

      await this.verifier.verifyPackageDirectory({
        packageDir: operationPaths.stagingPackageDir,
        expectedIdentity: {
          extensionId: input.expectedIdentity?.extensionId ?? input.registryPackage?.id,
          version: input.expectedIdentity?.version ?? input.registryRelease?.version,
          categories: input.expectedIdentity?.categories ?? input.registryPackage?.categories,
          enginesKisaki:
            input.expectedIdentity?.enginesKisaki ?? input.registryRelease?.engines.kisaki
        }
      })

      await this.archiveStore.storeArchive({
        archivePath: input.archivePath,
        sha256: verified.sha256
      })

      return {
        operationId: input.operationId,
        packageDir: operationPaths.stagingPackageDir,
        manifest: verified.manifest,
        archiveSha256: verified.sha256,
        archiveSize: verified.size
      }
    } catch (error) {
      await fse.remove(operationPaths.stagingDir).catch(() => undefined)
      throw wrapExtensionPackageError(error, {
        stage: 'extract',
        message: 'Failed to extract extension package archive',
        path: operationPaths.stagingPackageDir
      })
    }
  }
}
