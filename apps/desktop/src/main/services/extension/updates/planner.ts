import semver from 'semver'
import type { ExtensionInstallationRow } from '@shared/db'
import type {
  ExtensionUpdateCheckResult,
  ExtensionUpdateInfo,
  ExtensionUpdateRequest,
  ExtensionUpdateUnavailableInfo
} from '@shared/extension'
import type { ExtensionInstallPlanner } from '../installer/planner'
import type { ExtensionInstallationStore } from '../installations'
import type {
  ExtensionRepositoryInstallCandidate,
  ExtensionRepositoryManager
} from '../repositories'

export type ExtensionUpdatePlannerMode = 'check' | 'manual' | 'automatic'

export interface ExtensionUpdatePlan {
  installation: ExtensionInstallationRow
  candidate: ExtensionRepositoryInstallCandidate
  info: ExtensionUpdateInfo
  installPlan: ReturnType<ExtensionInstallPlanner['createRepositoryPlanForCandidate']>
  trustedSigner: boolean
  automatic: boolean
}

export interface SelectExtensionUpdatePlanOptions {
  mode?: ExtensionUpdatePlannerMode
}

export interface ExtensionUpdatePlannerOptions {
  repositories: ExtensionRepositoryManager
  installations: ExtensionInstallationStore
  installPlanner: ExtensionInstallPlanner
}

export class ExtensionUpdatePlanner {
  constructor(private readonly options: ExtensionUpdatePlannerOptions) {}

  checkUpdates(): ExtensionUpdateCheckResult {
    const updates: ExtensionUpdateInfo[] = []
    const unavailable: ExtensionUpdateUnavailableInfo[] = []

    for (const installation of this.options.installations.list()) {
      const result = this.evaluateUpdatePlanForInstallation(installation, { mode: 'check' })
      if (result.plan) {
        updates.push(result.plan.info)
      } else {
        unavailable.push(result.unavailable)
      }
    }

    return { updates, unavailable }
  }

  listAutomaticUpdatePlans(): readonly ExtensionUpdatePlan[] {
    return this.listUpdatePlans({ mode: 'automatic' })
  }

  selectUpdatePlan(
    extensionId: string,
    options: SelectExtensionUpdatePlanOptions = {}
  ): ExtensionUpdatePlan | null {
    const installation = this.options.installations.get(extensionId)
    if (!installation) {
      return null
    }

    return this.selectUpdatePlanForInstallation(installation, options)
  }

  requireUpdatePlan(
    extensionId: string,
    options: SelectExtensionUpdatePlanOptions = {}
  ): ExtensionUpdatePlan {
    const installation = this.options.installations.require(extensionId)
    const plan = this.selectUpdatePlanForInstallation(installation, options)
    if (!plan) {
      throw new Error(`No eligible update was found for extension "${extensionId}".`)
    }

    return plan
  }

  assertAccepted(plan: ExtensionUpdatePlan, request: ExtensionUpdateRequest): void {
    this.options.installPlanner.assertAccepted(plan.installPlan, request)
  }

  private listUpdatePlans(
    options: SelectExtensionUpdatePlanOptions
  ): readonly ExtensionUpdatePlan[] {
    const plans: ExtensionUpdatePlan[] = []

    for (const installation of this.options.installations.list()) {
      const plan = this.selectUpdatePlanForInstallation(installation, options)
      if (plan) {
        plans.push(plan)
      }
    }

    return plans
  }

  private selectUpdatePlanForInstallation(
    installation: ExtensionInstallationRow,
    options: SelectExtensionUpdatePlanOptions
  ): ExtensionUpdatePlan | null {
    return this.evaluateUpdatePlanForInstallation(installation, options).plan ?? null
  }

  private evaluateUpdatePlanForInstallation(
    installation: ExtensionInstallationRow,
    options: SelectExtensionUpdatePlanOptions
  ):
    | { plan: ExtensionUpdatePlan; unavailable: null }
    | {
        plan: null
        unavailable: ExtensionUpdateUnavailableInfo
      } {
    const mode = options.mode ?? 'manual'
    const policyIssue = getUpdatePolicyIssue(installation, mode)
    if (policyIssue) {
      return { plan: null, unavailable: policyIssue }
    }

    if (!installation.source) {
      return {
        plan: null,
        unavailable: createUnavailable(
          installation,
          'repository-source-missing',
          'This extension does not have a repository source for updates.'
        )
      }
    }

    if (installation.source.kind === 'local-file') {
      return {
        plan: null,
        unavailable: createUnavailable(
          installation,
          'local-file-source',
          'This extension was installed from a local file and is not bound to a repository release.'
        )
      }
    }

    if (!semver.valid(installation.version)) {
      return {
        plan: null,
        unavailable: createUnavailable(
          installation,
          'invalid-current-version',
          `Installed version "${installation.version}" is not a valid semver version.`
        )
      }
    }

    const candidates = this.options.repositories.listInstallCandidates(installation.id, {
      includeYanked: false,
      compatibleOnly: true
    })
    if (candidates.length === 0) {
      return {
        plan: null,
        unavailable: createUnavailable(
          installation,
          'no-compatible-release',
          'No compatible repository release with a usable artifact was found.'
        )
      }
    }

    const newerCandidates = candidates.filter((candidate) =>
      isVersionUpgrade(candidate, installation)
    )
    if (newerCandidates.length === 0) {
      return {
        plan: null,
        unavailable: createUnavailable(
          installation,
          'no-newer-release',
          'No repository release is newer than the installed version.'
        )
      }
    }

    const sameChannelCandidates = newerCandidates.filter(
      (candidate) => candidate.release.channel === installation.channel
    )
    if (sameChannelCandidates.length === 0) {
      return {
        plan: null,
        unavailable: createUnavailable(
          installation,
          'channel-mismatch',
          `No newer release was found on the "${installation.channel}" channel.`
        )
      }
    }

    const plans = sameChannelCandidates.map((candidate) => this.createPlan(installation, candidate))
    const eligiblePlans = mode === 'automatic' ? plans.filter((plan) => plan.automatic) : plans

    if (eligiblePlans.length === 0) {
      return {
        plan: null,
        unavailable: createUnavailable(
          installation,
          'requires-manual-confirmation',
          'The available update requires manual confirmation because its signer is untrusted, changed, or unsigned.'
        )
      }
    }

    return { plan: eligiblePlans.toSorted(compareUpdatePlans)[0], unavailable: null }
  }

  private createPlan(
    installation: ExtensionInstallationRow,
    candidate: ExtensionRepositoryInstallCandidate
  ): ExtensionUpdatePlan {
    const installPlan = this.options.installPlanner.createRepositoryPlanForCandidate(candidate)
    const trustedSigner = installPlan.signer.status === 'trusted' && installPlan.signer.trusted
    const automatic = installation.updatePolicy === 'auto' && trustedSigner

    return {
      installation,
      candidate,
      installPlan,
      trustedSigner,
      automatic,
      info: {
        planId: installPlan.id,
        planFingerprint: installPlan.fingerprint,
        extensionId: installation.id,
        currentVersion: installation.version,
        latestVersion: candidate.release.version,
        repository: installPlan.repository,
        release: installPlan.release,
        artifact: installPlan.artifact,
        signer: installPlan.signer,
        updatePolicy: installation.updatePolicy,
        channel: installation.channel,
        automatic,
        risks: installPlan.risks
      }
    }
  }
}

function getUpdatePolicyIssue(
  installation: ExtensionInstallationRow,
  mode: ExtensionUpdatePlannerMode
): ExtensionUpdateUnavailableInfo | null {
  if (installation.updatePolicy === 'pinned') {
    return createUnavailable(
      installation,
      'pinned-policy',
      `Updates are pinned to version ${installation.pinnedVersion ?? installation.version}.`
    )
  }

  if (mode === 'automatic' && installation.updatePolicy !== 'auto') {
    return createUnavailable(
      installation,
      'auto-policy-disabled',
      `Update policy "${installation.updatePolicy}" does not allow automatic updates.`
    )
  }

  return null
}

function isVersionUpgrade(
  candidate: ExtensionRepositoryInstallCandidate,
  installation: ExtensionInstallationRow
): boolean {
  return Boolean(
    semver.valid(candidate.release.version) &&
    semver.gt(candidate.release.version, installation.version)
  )
}

function compareUpdatePlans(left: ExtensionUpdatePlan, right: ExtensionUpdatePlan): number {
  return (
    compareBooleans(left.trustedSigner, right.trustedSigner) ||
    compareNumbers(left.candidate.repository.priority, right.candidate.repository.priority) ||
    semver.rcompare(left.candidate.release.version, right.candidate.release.version) ||
    compareNullableTime(right.candidate.release.publishedAt, left.candidate.release.publishedAt) ||
    compareStrings(left.candidate.repository.id, right.candidate.repository.id) ||
    compareStrings(left.candidate.releaseDigest, right.candidate.releaseDigest)
  )
}

function compareBooleans(left: boolean, right: boolean): number {
  return left === right ? 0 : left ? -1 : 1
}

function compareNumbers(left: number, right: number): number {
  return left === right ? 0 : left < right ? -1 : 1
}

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right)
}

function compareNullableTime(left: string | null, right: string | null): number {
  const leftTime = left ? Date.parse(left) : 0
  const rightTime = right ? Date.parse(right) : 0
  return compareNumbers(
    Number.isFinite(leftTime) ? leftTime : 0,
    Number.isFinite(rightTime) ? rightTime : 0
  )
}

function createUnavailable(
  installation: ExtensionInstallationRow,
  reason: ExtensionUpdateUnavailableInfo['reason'],
  message: string
): ExtensionUpdateUnavailableInfo {
  return {
    extensionId: installation.id,
    currentVersion: installation.version,
    updatePolicy: installation.updatePolicy,
    channel: installation.channel,
    reason,
    message
  }
}
