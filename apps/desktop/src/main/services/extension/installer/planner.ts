import { createHash } from 'node:crypto'
import semver from 'semver'
import type {
  ExtensionRegistryArtifact,
  ExtensionRegistryManifest,
  ExtensionRegistrySigningAlgorithm
} from '@kisaki/extension-registry'
import {
  createExtensionRegistrySignerFingerprint,
  stringifyExtensionRegistryCanonicalJson
} from '@kisaki/extension-registry/node'
import type {
  ExtensionCatalogArtifactInfo,
  ExtensionCatalogReleaseInfo,
  ExtensionCreateRepositoryInstallPlanRequest,
  ExtensionInstallFromFileRequest,
  ExtensionInstallPlan,
  ExtensionInstallPlanSignerInfo,
  ExtensionInstallReleaseRequest,
  ExtensionInstallRiskCode,
  ExtensionInstallRiskInfo
} from '@shared/extension'
import type { ExtensionInstallationRow } from '@shared/db'
import type { ExtensionRepositoryInstallCandidate } from '../repositories'
import { ExtensionInstallationStore } from '../installations'
import { ExtensionRepositoryManager } from '../repositories'
import { ExtensionSignerTrustStore } from '../signers'

export interface ExtensionInstallPlannerOptions {
  repositories: ExtensionRepositoryManager
  installations: ExtensionInstallationStore
  signers: ExtensionSignerTrustStore
}

export interface LocalExtensionInstallPlanInput {
  filePath: string
  extensionId: string
  name: string
  version: string
  fileSize: number
  artifactSha256: string
}

type CreateExtensionInstallPlanInput = Omit<ExtensionInstallPlan, 'fingerprint'>

type ExtensionInstallPlanAcceptanceInput = Pick<
  ExtensionInstallReleaseRequest | ExtensionInstallFromFileRequest,
  'planId' | 'planFingerprint' | 'acceptedRiskIds'
> & {
  trustSignerFingerprint?: boolean
}

export class ExtensionInstallPlanner {
  constructor(private readonly options: ExtensionInstallPlannerOptions) {}

  createRepositoryPlan(request: ExtensionCreateRepositoryInstallPlanRequest): ExtensionInstallPlan {
    const candidate = this.options.repositories.resolveInstallCandidate(request)
    return this.createRepositoryPlanForCandidate(candidate)
  }

  createRepositoryPlanForCandidate(
    candidate: ExtensionRepositoryInstallCandidate
  ): ExtensionInstallPlan {
    const existing = this.options.installations.get(candidate.registryPackage.id)
    const signer = this.createSignerInfo(candidate, existing)
    const artifact = toArtifactInfo(candidate.manifest, candidate.artifact)
    const release = toReleaseInfo(candidate, artifact)
    const risks = createRepositoryRisks(candidate, existing, signer, artifact)

    return createInstallPlan({
      id: `${candidate.registryPackage.id}:${candidate.releaseDigest}`,
      sourceKind: 'repository',
      package: {
        id: candidate.registryPackage.id,
        name: candidate.registryPackage.name,
        summary: candidate.registryPackage.summary,
        currentVersion: existing?.version ?? null,
        targetVersion: candidate.release.version,
        channel: candidate.release.channel
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
      defaultEnabled: existing?.enabled ?? true,
      updatePolicy: existing?.updatePolicy ?? 'manual'
    })
  }

  createLocalImportPlan(input: LocalExtensionInstallPlanInput): ExtensionInstallPlan {
    const existing = this.options.installations.get(input.extensionId)
    const risks = [
      createRisk(
        'local-unsigned',
        'warning',
        'Local extension packages are not signed by a trusted repository signer.'
      )
    ]

    if (existing?.version === input.version) {
      risks.push(
        createRisk(
          'same-version',
          'info',
          `Version ${input.version} is already installed and will be replaced.`
        )
      )
    } else if (isDowngrade(input.version, existing?.version)) {
      risks.push(
        createRisk(
          'downgrade',
          'warning',
          `This installs ${input.version}, which is older than the current ${existing?.version}.`
        )
      )
    }

    return createInstallPlan({
      id: `${input.extensionId}:local-file`,
      sourceKind: 'local-file',
      package: {
        id: input.extensionId,
        name: input.name,
        currentVersion: existing?.version ?? null,
        targetVersion: input.version,
        channel: 'stable'
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
      defaultEnabled: existing?.enabled ?? true,
      updatePolicy: 'manual'
    })
  }

  assertAccepted(plan: ExtensionInstallPlan, request: ExtensionInstallPlanAcceptanceInput): void {
    if (request.planId !== plan.id || request.planFingerprint !== plan.fingerprint) {
      throw new Error('Extension install plan has changed. Please review the latest plan.')
    }

    const acceptedRiskIds = new Set(request.acceptedRiskIds ?? [])
    const missingRisks = plan.risks.filter((risk) => !acceptedRiskIds.has(risk.id))
    if (missingRisks.length > 0) {
      throw new Error(
        `Extension install plan requires confirmation for: ${missingRisks
          .map((risk) => risk.code)
          .join(', ')}.`
      )
    }

    if (
      request.trustSignerFingerprint &&
      (!plan.signer.fingerprint || plan.signer.status === 'unsigned')
    ) {
      throw new Error('Cannot trust an unsigned extension install plan.')
    }
  }

  private createSignerInfo(
    candidate: ExtensionRepositoryInstallCandidate,
    existing: ExtensionInstallationRow | null
  ): ExtensionInstallPlanSignerInfo {
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

function createRepositoryRisks(
  candidate: ExtensionRepositoryInstallCandidate,
  existing: ExtensionInstallationRow | null,
  signer: ExtensionInstallPlanSignerInfo,
  artifact: ExtensionCatalogArtifactInfo
): ExtensionInstallRiskInfo[] {
  const risks: ExtensionInstallRiskInfo[] = []

  if (getUrlHost(candidate.repository.url) !== artifact.host) {
    risks.push(
      createRisk(
        'artifact-host-mismatch',
        'info',
        `Artifact host ${artifact.host} differs from repository host ${getUrlHost(
          candidate.repository.url
        )}.`
      )
    )
  }

  if (candidate.release.yanked === true) {
    risks.push(
      createRisk('yanked-release', 'danger', 'This release has been withdrawn by the repository.')
    )
  }

  if (existing?.version === candidate.release.version) {
    risks.push(
      createRisk(
        'same-version',
        'info',
        `Version ${candidate.release.version} is already installed and will be replaced.`
      )
    )
  } else if (isDowngrade(candidate.release.version, existing?.version)) {
    risks.push(
      createRisk(
        'downgrade',
        'warning',
        `This installs ${candidate.release.version}, which is older than the current ${existing?.version}.`
      )
    )
  }

  if (existing && existing.channel !== candidate.release.channel) {
    risks.push(
      createRisk(
        'channel-change',
        'warning',
        `This changes the update channel from ${existing.channel} to ${candidate.release.channel}.`
      )
    )
  }

  if (signer.status === 'unsigned') {
    risks.push(
      createRisk(
        'unsigned-release',
        'warning',
        'This remote release is not signed by an author key.'
      )
    )
  } else if (signer.status === 'changed') {
    risks.push(
      createRisk(
        'signer-changed',
        'danger',
        'This release is signed by a different key than the currently installed version.'
      )
    )
  } else if (signer.status === 'untrusted') {
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
    channel: candidate.release.channel,
    publishedAt: candidate.release.publishedAt,
    engines: candidate.release.engines,
    changelog: candidate.release.changelog,
    yanked: candidate.release.yanked === true,
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
    host: getUrlHost(artifact.url),
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
  code: ExtensionInstallRiskCode,
  severity: ExtensionInstallRiskInfo['severity'],
  message: string
): ExtensionInstallRiskInfo {
  return {
    id: code,
    code,
    severity,
    message
  }
}

function getUrlHost(value: string): string {
  try {
    return new URL(value).host
  } catch {
    return ''
  }
}

function isDowngrade(nextVersion: string, currentVersion: string | null | undefined): boolean {
  return Boolean(
    currentVersion &&
    semver.valid(currentVersion) &&
    semver.valid(nextVersion) &&
    semver.lt(nextVersion, currentVersion)
  )
}

function createInstallPlan(plan: CreateExtensionInstallPlanInput): ExtensionInstallPlan {
  return {
    ...plan,
    fingerprint: createInstallPlanFingerprint(plan)
  }
}

function createInstallPlanFingerprint(plan: CreateExtensionInstallPlanInput): string {
  const payload = {
    kind: 'kisaki-extension-install-plan',
    schemaVersion: 1,
    id: plan.id,
    sourceKind: plan.sourceKind,
    package: {
      id: plan.package.id,
      name: plan.package.name,
      summary: plan.package.summary ?? null,
      currentVersion: plan.package.currentVersion,
      targetVersion: plan.package.targetVersion,
      channel: plan.package.channel
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
          channel: plan.release.channel,
          publishedAt: plan.release.publishedAt,
          engines: {
            kisaki: plan.release.engines.kisaki
          },
          changelog: plan.release.changelog
            ? {
                text: plan.release.changelog.text ?? null,
                url: plan.release.changelog.url ?? null
              }
            : null,
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
    updatePolicy: plan.updatePolicy
  }

  return createHash('sha256').update(stringifyExtensionRegistryCanonicalJson(payload)).digest('hex')
}

function normalizeArtifactForFingerprint(artifact: ExtensionCatalogArtifactInfo | null): {
  target: string
  url: string
  host: string
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
    host: artifact.host,
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
