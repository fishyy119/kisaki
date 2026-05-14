import { randomUUID } from 'node:crypto'
import type {
  ExtensionUpdateAllResult,
  ExtensionUpdateCheckResult,
  ExtensionUpdateRequest
} from '@shared/extension'
import type { ExtensionInstalledEntry } from '../types'
import type { ExtensionInstallerManager, ExtensionInstallReleaseApproval } from '../installer'
import { requireSafeExtensionId } from '../shared/path-confinement'
import type { ExtensionUpdatePlan } from './planner'
import { ExtensionUpdatePlanner } from './planner'

export interface ExtensionUpdateManagerOptions {
  installer: ExtensionInstallerManager
  updatePlanner: ExtensionUpdatePlanner
}

export class ExtensionUpdateManager {
  private readonly installer: ExtensionInstallerManager
  private readonly updatePlanner: ExtensionUpdatePlanner

  constructor(options: ExtensionUpdateManagerOptions) {
    this.installer = options.installer
    this.updatePlanner = options.updatePlanner
  }

  checkUpdates(): ExtensionUpdateCheckResult {
    return this.updatePlanner.checkUpdates()
  }

  async update(request: ExtensionUpdateRequest): Promise<ExtensionInstalledEntry | null> {
    const updatePlan = this.updatePlanner.requireUpdatePlan(
      requireSafeExtensionId(request.extensionId),
      { mode: 'manual' }
    )

    return this.installUpdatePlan(updatePlan, {
      operationId: request.operationId,
      approval: {
        kind: 'user-confirmed',
        planId: request.planId,
        planFingerprint: request.planFingerprint,
        trustSignerFingerprint: request.trustSignerFingerprint === true
      }
    })
  }

  async updateAll(): Promise<ExtensionUpdateAllResult[]> {
    const plannedUpdates = this.updatePlanner.listAutomaticUpdatePlans()
    const results: ExtensionUpdateAllResult[] = []

    for (const plannedUpdate of plannedUpdates) {
      try {
        await this.installUpdatePlan(plannedUpdate, {
          operationId: randomUUID(),
          approval: { kind: 'trusted-automatic' }
        })
        results.push({
          extensionId: plannedUpdate.installation.id,
          success: true,
          currentVersion: plannedUpdate.installation.version,
          targetVersion: plannedUpdate.candidate.release.version
        })
      } catch (error) {
        results.push({
          extensionId: plannedUpdate.installation.id,
          success: false,
          currentVersion: plannedUpdate.installation.version,
          targetVersion: plannedUpdate.candidate.release.version,
          error: error instanceof Error ? error.message : 'Unknown extension update error'
        })
      }
    }

    return results
  }

  private installUpdatePlan(
    updatePlan: ExtensionUpdatePlan,
    options: {
      operationId: string
      approval: ExtensionInstallReleaseApproval
    }
  ): Promise<ExtensionInstalledEntry> {
    return this.installer.installRelease({
      operationId: options.operationId,
      extensionId: updatePlan.installation.id,
      repositoryId: updatePlan.candidate.repository.id,
      releaseId: updatePlan.candidate.releaseDigest,
      reason: 'update',
      approval: options.approval
    })
  }
}
