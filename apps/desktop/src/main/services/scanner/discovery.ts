import { promises as fs } from 'fs'
import path from 'path'
import { createLogger } from '@main/log'
import type { DbService } from '@main/services/db'
import type { NameExtractionRule } from '@shared/db'
import type { EntityEntry, ExtractionTestResult } from '@shared/scanner'

const log = createLogger('Scanner')

export interface ScanOptions {
  /** Depth at which to collect entities (0 = immediate children) */
  entityDepth: number
  /** Names to ignore (case-insensitive) */
  ignoredNames: string[]
  /** Rules for extracting entity name from folder/file name */
  nameExtractionRules: NameExtractionRule[]
}

export class ScannerDiscovery {
  constructor(private readonly dbService: DbService) {}

  /**
   * Extract entity name using configured rules.
   * Tries each enabled rule in order until one matches.
   */
  extractEntityName(
    originalName: string,
    rules: NameExtractionRule[]
  ): { extractedName: string; matchedRuleId: string | null } {
    for (const rule of rules) {
      if (!rule.enabled) continue
      try {
        const regex = new RegExp(rule.pattern)
        const match = regex.exec(originalName)
        if (match?.groups?.name) {
          return { extractedName: match.groups.name.trim(), matchedRuleId: rule.id }
        }
      } catch (error) {
        log.warn('Invalid regex pattern in rule.', { ruleId: rule.id, error: error })
      }
    }
    return { extractedName: originalName, matchedRuleId: null }
  }

  /**
   * Generic entity scanner - works for all media types.
   * Returns all entries at the specified depth level.
   */
  async scanForEntities(rootPath: string, options: ScanOptions): Promise<EntityEntry[]> {
    const { entityDepth, ignoredNames, nameExtractionRules } = options

    try {
      const entries = await fs.readdir(rootPath, { withFileTypes: true })

      const ignoredNameSet = new Set(ignoredNames.map((name) => name.toLowerCase()))
      const filtered = entries.filter((entry) => !ignoredNameSet.has(entry.name.toLowerCase()))

      if (entityDepth > 0) {
        const subDirs = filtered.filter((e) => e.isDirectory() || e.isSymbolicLink())
        const results = await Promise.all(
          subDirs.map((d) =>
            this.scanForEntities(path.join(rootPath, d.name), {
              entityDepth: entityDepth - 1,
              ignoredNames,
              nameExtractionRules
            })
          )
        )
        return results.flat()
      }

      return filtered.map((entry) => {
        const originalName = entry.name
        const originalBaseName = entry.isFile() ? path.parse(originalName).name : originalName
        const { extractedName, matchedRuleId } = this.extractEntityName(
          originalBaseName,
          nameExtractionRules
        )
        return {
          path: path.join(rootPath, entry.name),
          originalName,
          originalBaseName,
          extractedName,
          matchedRuleId
        }
      })
    } catch (error) {
      log.error('Failed to scan directory.', { rootPath: rootPath, error: error })
      return []
    }
  }

  async testExtractionRules(
    scannerPath: string,
    entityDepth: number,
    rules: NameExtractionRule[]
  ): Promise<ExtractionTestResult[]> {
    const settingsData = this.dbService.entityFinder.getAppSettings()
    const entities = await this.scanForEntities(scannerPath, {
      entityDepth,
      ignoredNames: settingsData.scannerIgnoredNames,
      nameExtractionRules: []
    })

    return entities.map((entity) => {
      const { extractedName, matchedRuleId } = this.extractEntityName(
        entity.originalBaseName,
        rules
      )
      return {
        originalName: entity.originalName,
        extractedName,
        matchedRuleId
      }
    })
  }
}
