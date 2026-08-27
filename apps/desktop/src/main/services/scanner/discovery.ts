import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createLogger } from '@main/log'
import { normalizeLibraryDirPath } from '@main/utils/fs'
import type { DbService } from '@main/services/db'
import type { NameExtractionRule } from '@shared/db'
import type { EntityEntry, ExtractionTestResult } from '@shared/scanner'

const log = createLogger('Scanner')

export interface ScanOptions {
  /** Depth at which to collect entities (0 = immediate children) */
  entityDepth: number
  /** Extracted entity names to ignore (case-insensitive) */
  ignoredNames: string[]
  /** Rules for extracting entity name from directory name */
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
   * Returns scannable directory entries at the specified depth level, with
   * extraction applied first and the ignore list matched on extracted names.
   */
  async scanForEntities(scanRootPath: string, options: ScanOptions): Promise<EntityEntry[]> {
    const { entityDepth, ignoredNames, nameExtractionRules } = options
    const rootPath = normalizeLibraryDirPath(scanRootPath)

    try {
      const entries = await fs.readdir(rootPath, { withFileTypes: true })

      const ignoredNameSet = new Set(ignoredNames.map((name) => name.toLowerCase()))

      if (entityDepth > 0) {
        const subDirs = entries.filter((e) => e.isDirectory() || e.isSymbolicLink())
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

      const entityEntries = entries.filter((entry) => entry.isDirectory() || entry.isSymbolicLink())

      return entityEntries
        .map((entry) => {
          const originalName = entry.name
          const { extractedName, matchedRuleId } = this.extractEntityName(
            originalName,
            nameExtractionRules
          )
          return {
            path: path.join(rootPath, entry.name),
            originalName,
            extractedName,
            matchedRuleId
          }
        })
        .filter((entity) => !ignoredNameSet.has(entity.extractedName.toLowerCase()))
    } catch (error) {
      log.error('Failed to scan directory.', { rootPath: rootPath, error: error })
      return []
    }
  }

  /**
   * Preview extraction with the exact pipeline a real scan runs: rules are
   * applied first and the ignore list then filters on extracted names.
   */
  async testExtractionRules(
    scannerPath: string,
    entityDepth: number,
    rules: NameExtractionRule[]
  ): Promise<ExtractionTestResult[]> {
    const settingsData = this.dbService.settings.get()
    const entities = await this.scanForEntities(scannerPath, {
      entityDepth,
      ignoredNames: settingsData.scannerIgnoredNames,
      nameExtractionRules: rules
    })

    return entities.map((entity) => ({
      originalName: entity.originalName,
      extractedName: entity.extractedName,
      matchedRuleId: entity.matchedRuleId
    }))
  }
}
