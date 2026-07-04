import { createHash } from 'node:crypto'
import semver from 'semver'
import type {
  ExtensionRegistryArtifact,
  ExtensionRegistryManifest,
  ExtensionRegistrySigningAlgorithm
} from '@kisaki3/extension-registry'
import { getExtensionRegistryReleaseKind } from '@kisaki3/extension-registry'
import {
  createExtensionRegistrySignerFingerprint,
  stringifyExtensionRegistryCanonicalJson
} from '@kisaki3/extension-registry/node'
import type {
  ExtensionCatalogArtifactInfo,
  ExtensionCatalogReleaseInfo,
  ExtensionCreateRepositoryReleasePlanRequest,
  ExtensionReleaseAction,
  ExtensionReleasePlan,
  ExtensionReleasePlanSignerInfo,
  ExtensionReleaseRiskCode,
  ExtensionReleaseRiskInfo
} from '@shared/extension'
import type { ExtensionInstallationRow } from '@shared/db'
import type { ExtensionRepositoryInstallCandidate } from '../repositories'
import type { ExtensionInstallationStore } from '../installations'
import type { ExtensionRepositoryManager } from '../repositories'
import type { ExtensionSignerTrustManager } from '../signers'
import type { ExtensionInstalledEntry } from '../types'

export interface ExtensionReleasePlannerOptions {
  repositories: ExtensionRepositoryManager
  installations: ExtensionInstallationStore
  signers: ExtensionSignerTrustManager
  getInstalledEntry(extensionId: string): ExtensionInstalledEntry | null
}

export interface LocalExtensionReleasePlanInput {
  filePath: string
  extensionId: string
  name: string
  version: string
  fileSize: number
  artifactSha256: string
}

type CreateExtensionReleasePlanInput = Omit<ExtensionReleasePlan, 'fingerprint'>

export class ExtensionReleasePlanner {
  constructor(private readonly options: ExtensionReleasePlannerOptions) {}

  createRepositoryPlan(request: ExtensionCreateRepositoryReleasePlanRequest): ExtensionReleasePlan {
    const candidate = this.options.repositories.resolveInstallCandidate(request)
    return this.createRepositoryPlanForCandidate(candidate)
  }

  createRepositoryPlanForCandidate(
    candidate: ExtensionRepositoryInstallCandidate
  ): ExtensionReleasePlan {
    const installation = this.options.installations.get(candidate.registryPackage.id)
    const activeEntry = this.options.getInstalledEntry(candidate.registryPackage.id)
    const currentVersion = activeEntry?.version ?? installation?.version ?? null
    const action = resolveReleaseAction(candidate.release.version, currentVersion)
    const signer = this.createSignerInfo(candidate, installation)
    const artifact = toArtifactInfo(candidate.manifest, candidate.artifact)
    const release = toReleaseInfo(candidate, artifact)
    const includePreviewUpdates = getDefaultIncludePreviewUpdates(
      installation,
      candidate.release.version
    )
    const risks = createRepositoryRisks({
      candidate,
      installation,
      currentVersion,
      action,
      signer,
      includePreviewUpdates
    })

    return createReleasePlan({
      id: `${candidate.registryPackage.id}:${candidate.releaseDigest}`,
      action,
      sourceKind: 'repository',
      package: {
        id: candidate.registryPackage.id,
        name: candidate.registryPackage.name,
        description: candidate.registryPackage.description,
        currentVersion,
        targetVersion: candidate.release.version,
        releaseKind: release.releaseKind
      },
      repository: {
        id: candidate.repository.id,
        name: candidate.repository.name,
        url: candidate.repository.url,
        manifestDigest: candidate.repository.manifestDigest
      },
      release,
      artifact,
      localFile: null,
      signer,
      risks,
      defaultEnabled: installation?.enabled ?? activeEntry?.enabled ?? true,
      updatePolicy: installation?.updatePolicy ?? 'manual',
      includePreviewUpdates
    })
  }

  createLocalFilePlan(input: LocalExtensionReleasePlanInput): ExtensionReleasePlan {
    const installation = this.options.installations.get(input.extensionId)
    const activeEntry = this.options.getInstalledEntry(input.extensionId)
    const currentVersion = activeEntry?.version ?? installation?.version ?? null
    const action = resolveReleaseAction(input.version, currentVersion)
    const risks = [
      createRisk(
        'local-unsigned',
        'warning',
        'Local extension packages are not signed by a trusted repository signer.'
      ),
      ...createVersionRisks(action, input.version, currentVersion)
    ]

    return createReleasePlan({
      id: `${input.extensionId}:local-file`,
      action,
      sourceKind: 'local-file',
      package: {
        id: input.extensionId,
        name: input.name,
        currentVersion,
        targetVersion: input.version,
        releaseKind: getExtensionRegistryReleaseKind(input.version)
      },
      repository: null,
      release: null,
      artifact: null,
      localFile: {
        path: input.filePath,
        size: input.fileSize,
        sha256: input.artifactSha256
      },
      signer: {
        status: 'unsigned',
        trusted: false
      },
      risks,
      defaultEnabled: installation?.enabled ?? activeEntry?.enabled ?? true,
      updatePolicy: 'manual',
      includePreviewUpdates: false
    })
  }

  private createSignerInfo(
    candidate: ExtensionRepositoryInstallCandidate,
    existing: ExtensionInstallationRow | null
  ): ExtensionReleasePlanSignerInfo {
    const signature = candidate.artifact.signature
    if (!signature) {
      return {
        status: 'unsigned',
        trusted: false
      }
    }

    const signingKey = candidate.manifest.signingKeys.find((key) => key.id === signature.keyId)
    if (!signingKey) {
      return {
        status: 'unsigned',
        trusted: false
      }
    }

    const fingerprint = createExtensionRegistrySignerFingerprint(signingKey.publicKey)
    const trusted = this.options.signers.isTrusted(candidate.registryPackage.id, fingerprint)
    const previousFingerprint =
      existing?.source?.kind === 'repository' ? existing.source.signature?.fingerprint : undefined
    const changed = Boolean(previousFingerprint && previousFingerprint !== fingerprint)

    return {
      status: changed ? 'changed' : trusted ? 'trusted' : 'untrusted',
      keyId: signature.keyId,
      algorithm: signature.algorithm,
      fingerprint,
      trusted
    }
  }
}

function resolveReleaseAction(
  targetVersion: string,
  currentVersion: string | null
): ExtensionReleaseAction {
  if (!currentVersion) {
    return 'install'
  }

  if (currentVersion === targetVersion) {
    return 'reinstall'
  }

  if (semver.valid(currentVersion) && semver.valid(targetVersion)) {
    return semver.gt(targetVersion, currentVersion) ? 'update' : 'downgrade'
  }

  return 'update'
}

function createRepositoryRisks(input: {
  candidate: ExtensionRepositoryInstallCandidate
  installation: ExtensionInstallationRow | null
  currentVersion: string | null
  action: ExtensionReleaseAction
  signer: ExtensionReleasePlanSignerInfo
  includePreviewUpdates: boolean
}): ExtensionReleaseRiskInfo[] {
  const risks: ExtensionReleaseRiskInfo[] = []
  const releaseKind = getExtensionRegistryReleaseKind(input.candidate.release.version)

  if (input.candidate.release.yanked !== undefined) {
    risks.push(
      createRisk('yanked-release', 'danger', 'This release has been withdrawn by the repository.')
    )
  }

  if (releaseKind === 'preview') {
    risks.push(
      createRisk(
        'preview-release',
        'warning',
        'This applies a preview release identified by a semver prerelease version.'
      )
    )
  }

  risks.push(
    ...createVersionRisks(input.action, input.candidate.release.version, input.currentVersion)
  )

  if (
    input.installation &&
    input.installation.includePreviewUpdates !== input.includePreviewUpdates
  ) {
    risks.push(
      createRisk(
        'preview-updates-change',
        'warning',
        input.includePreviewUpdates
          ? 'This enables preview updates for this extension.'
          : 'This disables preview updates for this extension.'
      )
    )
  }

  if (input.signer.status === 'unsigned') {
    risks.push(
      createRisk(
        'unsigned-release',
        'warning',
        'This remote release is not signed by an author key.'
      )
    )
  } else if (input.signer.status === 'changed') {
    risks.push(
      createRisk(
        'signer-changed',
        'danger',
        'This release is signed by a different key than the currently installed version.'
      )
    )
  } else if (input.signer.status === 'untrusted') {
    risks.push(
      createRisk(
        'signer-untrusted',
        'warning',
        'This signer has not been trusted for this extension yet.'
      )
    )
  }

  return risks
}

function createVersionRisks(
  action: ExtensionReleaseAction,
  targetVersion: string,
  currentVersion: string | null | undefined
): ExtensionReleaseRiskInfo[] {
  if (action === 'reinstall') {
    return [
      createRisk(
        'same-version',
        'info',
        `Version ${targetVersion} is already installed and will be replaced.`
      )
    ]
  }

  if (action === 'downgrade') {
    return [
      createRisk(
        'downgrade',
        'warning',
        `This applies ${targetVersion}, which is older than the current ${currentVersion}.`
      )
    ]
  }

  return []
}

function getDefaultIncludePreviewUpdates(
  existing: ExtensionInstallationRow | null,
  version: string
): boolean {
  if (existing?.includePreviewUpdates === true) {
    return true
  }

  return getExtensionRegistryReleaseKind(version) === 'preview'
}

function toReleaseInfo(
  candidate: ExtensionRepositoryInstallCandidate,
  artifact: ExtensionCatalogArtifactInfo
): ExtensionCatalogReleaseInfo {
  const source = {
    repositoryId: candidate.repository.id,
    repositoryName: candidate.repository.name,
    repositoryUrl: candidate.repository.url,
    repositoryPriority: candidate.repository.priority,
    manifestDigest: candidate.repository.manifestDigest
  }

  return {
    id: candidate.releaseDigest,
    releaseDigest: candidate.releaseDigest,
    version: candidate.release.version,
    releaseKind: getExtensionRegistryReleaseKind(candidate.release.version),
    publishedAt: candidate.release.publishedAt,
    engines: candidate.release.engines,
    releasePage: candidate.release.releasePage,
    changelog: candidate.release.changelog,
    yanked: candidate.release.yanked !== undefined,
    compatible: true,
    repositoryCount: 1,
    repositoryId: source.repositoryId,
    repositoryName: source.repositoryName,
    repositoryUrl: source.repositoryUrl,
    repositoryPriority: source.repositoryPriority,
    manifestDigest: source.manifestDigest,
    sources: [source],
    artifact,
    artifacts: [artifact]
  }
}

function toArtifactInfo(
  manifest: ExtensionRegistryManifest,
  artifact: ExtensionRegistryArtifact
): ExtensionCatalogArtifactInfo {
  const signature = artifact.signature
  const signingKey = signature
    ? manifest.signingKeys.find((key) => key.id === signature.keyId)
    : undefined

  return {
    target: artifact.target,
    url: artifact.url,
    size: artifact.size,
    sha256: artifact.sha256,
    signature:
      signature && signingKey
        ? {
            keyId: signature.keyId,
            algorithm: signature.algorithm as ExtensionRegistrySigningAlgorithm,
            fingerprint: createExtensionRegistrySignerFingerprint(signingKey.publicKey)
          }
        : null
  }
}

function createRisk(
  code: ExtensionReleaseRiskCode,
  severity: ExtensionReleaseRiskInfo['severity'],
  message: string
): ExtensionReleaseRiskInfo {
  return {
    id: code,
    code,
    severity,
    message
  }
}

function createReleasePlan(plan: CreateExtensionReleasePlanInput): ExtensionReleasePlan {
  return {
    ...plan,
    fingerprint: createReleasePlanFingerprint(plan)
  }
}

function createReleasePlanFingerprint(plan: CreateExtensionReleasePlanInput): string {
  const payload = {
    kind: 'kisaki-extension-release-plan',
    schemaVersion: 1,
    id: plan.id,
    action: plan.action,
    sourceKind: plan.sourceKind,
    package: {
      id: plan.package.id,
      name: plan.package.name,
      description: plan.package.description ?? null,
      currentVersion: plan.package.currentVersion,
      targetVersion: plan.package.targetVersion,
      releaseKind: plan.package.releaseKind
    },
    repository: plan.repository
      ? {
          id: plan.repository.id,
          name: plan.repository.name,
          url: plan.repository.url,
          manifestDigest: plan.repository.manifestDigest
        }
      : null,
    release: plan.release
      ? {
          id: plan.release.id,
          releaseDigest: plan.release.releaseDigest,
          version: plan.release.version,
          releaseKind: plan.release.releaseKind,
          publishedAt: plan.release.publishedAt,
          engines: {
            kisakiExtensionApi: plan.release.engines.kisakiExtensionApi
          },
          releasePage: plan.release.releasePage ?? null,
          changelog: plan.release.changelog ?? null,
          yanked: plan.release.yanked,
          compatible: plan.release.compatible,
          repositoryId: plan.release.repositoryId,
          repositoryName: plan.release.repositoryName,
          repositoryUrl: plan.release.repositoryUrl,
          repositoryPriority: plan.release.repositoryPriority,
          manifestDigest: plan.release.manifestDigest,
          artifact: normalizeArtifactForFingerprint(plan.release.artifact),
          artifacts: plan.release.artifacts.map(normalizeArtifactForFingerprint)
        }
      : null,
    artifact: normalizeArtifactForFingerprint(plan.artifact),
    localFile: plan.localFile
      ? {
          path: plan.localFile.path,
          size: plan.localFile.size,
          sha256: plan.localFile.sha256
        }
      : null,
    signer: {
      status: plan.signer.status,
      keyId: plan.signer.keyId ?? null,
      algorithm: plan.signer.algorithm ?? null,
      fingerprint: plan.signer.fingerprint ?? null,
      trusted: plan.signer.trusted
    },
    risks: plan.risks.map((risk) => ({
      id: risk.id,
      code: risk.code,
      severity: risk.severity,
      message: risk.message
    })),
    defaultEnabled: plan.defaultEnabled,
    updatePolicy: plan.updatePolicy,
    includePreviewUpdates: plan.includePreviewUpdates
  }

  return createHash('sha256').update(stringifyExtensionRegistryCanonicalJson(payload)).digest('hex')
}

function normalizeArtifactForFingerprint(artifact: ExtensionCatalogArtifactInfo | null): {
  target: string
  url: string
  size: number
  sha256: string
  signature: {
    keyId: string
    algorithm: string
    fingerprint: string
  } | null
} | null {
  if (!artifact) {
    return null
  }

  return {
    target: artifact.target,
    url: artifact.url,
    size: artifact.size,
    sha256: artifact.sha256,
    signature: artifact.signature
      ? {
          keyId: artifact.signature.keyId,
          algorithm: artifact.signature.algorithm,
          fingerprint: artifact.signature.fingerprint
        }
      : null
  }
}
