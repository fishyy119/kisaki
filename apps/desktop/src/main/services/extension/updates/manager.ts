import { createLogger } from '@main/log'
import type {
  ExtensionAutomaticUpdateResult,
  ExtensionAutomaticUpdateRunState,
  ExtensionUpdateCheckResult
} from '@shared/extension'
import type { ExtensionInstalledEntry } from '../types'
import type { ExtensionApplyReleaseApproval, ExtensionInstallerManager } from '../installer'
import type { ExtensionRepositoryManager } from '../repositories'
import type { ExtensionUpdatePlan } from './planner'
import { ExtensionUpdatePlanner } from './planner'

const log = createLogger('Extension')

export interface ExtensionUpdateManagerOptions {
  installer: ExtensionInstallerManager
  repositories: ExtensionRepositoryManager
  updatePlanner: ExtensionUpdatePlanner
  onAutomaticUpdateRunChanged?: (state: ExtensionAutomaticUpdateRunState) => void
}

export class ExtensionUpdateManager {
  private readonly installer: ExtensionInstallerManager
  private readonly repositories: ExtensionRepositoryManager
  private readonly updatePlanner: ExtensionUpdatePlanner
  private readonly onAutomaticUpdateRunChanged?: (state: ExtensionAutomaticUpdateRunState) => void
  private automaticUpdateRunPromise: Promise<ExtensionAutomaticUpdateRunState> | null = null
  private automaticUpdateRunState: ExtensionAutomaticUpdateRunState = {
    status: 'idle',
    trigger: 'startup',
    startedAt: null,
    finishedAt: null,
    results: []
  }

  constructor(options: ExtensionUpdateManagerOptions) {
    this.installer = options.installer
    this.repositories = options.repositories
    this.updatePlanner = options.updatePlanner
    this.onAutomaticUpdateRunChanged = options.onAutomaticUpdateRunChanged
  }

  async checkUpdates(): Promise<ExtensionUpdateCheckResult> {
    await this.repositories.refreshRepositories()
    return this.updatePlanner.checkUpdates()
  }

  getAutomaticUpdateRun(): ExtensionAutomaticUpdateRunState {
    return cloneAutomaticUpdateRunState(this.automaticUpdateRunState)
  }

  runStartupAutomaticUpdates(): Promise<ExtensionAutomaticUpdateRunState> {
    if (this.automaticUpdateRunPromise) {
      return this.automaticUpdateRunPromise
    }

    if (this.automaticUpdateRunState.status === 'completed') {
      return Promise.resolve(this.getAutomaticUpdateRun())
    }

    this.automaticUpdateRunPromise = this.runStartupAutomaticUpdatesOnce().finally(() => {
      this.automaticUpdateRunPromise = null
    })

    return this.automaticUpdateRunPromise
  }

  private async runStartupAutomaticUpdatesOnce(): Promise<ExtensionAutomaticUpdateRunState> {
    const startedAt = new Date().toISOString()
    const results: ExtensionAutomaticUpdateResult[] = []
    let repositoryRefreshError: string | undefined

    this.setAutomaticUpdateRunState({
      status: 'running',
      trigger: 'startup',
      startedAt,
      finishedAt: null,
      results
    })

    try {
      await this.repositories.runRefreshRepositories({ type: 'system', reason: 'update' })
    } catch (error) {
      repositoryRefreshError =
        error instanceof Error ? error.message : 'Unknown extension repository refresh error'
      log.warn('Startup extension repository refresh failed before automatic updates.', error)
    }

    const plannedUpdates = this.updatePlanner.listStartupAutomaticUpdatePlans()

    for (const plannedUpdate of plannedUpdates) {
      const updatePlan = this.updatePlanner.selectUpdatePlan(plannedUpdate.installation.id, {
        mode: 'automatic'
      })
      if (!updatePlan) {
        continue
      }

      try {
        await this.runUpdatePlan(updatePlan, {
          approval: { kind: 'trusted-automatic' }
        })
        results.push({
          extensionId: updatePlan.installation.id,
          status: 'updated',
          currentVersion: updatePlan.installation.version,
          targetVersion: updatePlan.candidate.release.version
        })
      } catch (error) {
        log.warn('Startup automatic extension update failed.', error, {
          extensionId: updatePlan.installation.id
        })
        results.push({
          extensionId: updatePlan.installation.id,
          status: 'failed',
          currentVersion: updatePlan.installation.version,
          targetVersion: updatePlan.candidate.release.version,
          error: error instanceof Error ? error.message : 'Unknown extension update error'
        })
      }

      this.setAutomaticUpdateRunState({
        status: 'running',
        trigger: 'startup',
        startedAt,
        finishedAt: null,
        results,
        repositoryRefreshError
      })
    }

    this.setAutomaticUpdateRunState({
      status: 'completed',
      trigger: 'startup',
      startedAt,
      finishedAt: new Date().toISOString(),
      results,
      repositoryRefreshError
    })

    return this.getAutomaticUpdateRun()
  }

  private runUpdatePlan(
    updatePlan: ExtensionUpdatePlan,
    options: {
      approval: ExtensionApplyReleaseApproval
    }
  ): Promise<ExtensionInstalledEntry> {
    return this.installer.runApplyRelease(
      {
        sourceKind: 'repository',
        extensionId: updatePlan.installation.id,
        repositoryId: updatePlan.candidate.repository.id,
        releaseId: updatePlan.candidate.releaseDigest,
        approval: options.approval
      },
      { type: 'system', reason: 'update' }
    )
  }

  private setAutomaticUpdateRunState(state: ExtensionAutomaticUpdateRunState): void {
    this.automaticUpdateRunState = cloneAutomaticUpdateRunState(state)
    this.onAutomaticUpdateRunChanged?.(this.getAutomaticUpdateRun())
  }
}

function cloneAutomaticUpdateRunState(
  state: ExtensionAutomaticUpdateRunState
): ExtensionAutomaticUpdateRunState {
  return {
    ...state,
    results: state.results.map((result) => ({ ...result }))
  }
}
