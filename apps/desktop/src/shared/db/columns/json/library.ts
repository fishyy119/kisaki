import { customType } from 'drizzle-orm/sqlite-core'

import type { FailedScan, ExternalSite, SaveBackup } from '../../contracts/json'

export const stringArrayJson = customType<{
  data: string[]
  driverData: string
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string): string[] {
    if (!value || value === '[]') return []
    try {
      const parsed = JSON.parse(value)
      if (!Array.isArray(parsed)) {
        return []
      }
      return parsed.filter((v) => typeof v === 'string') as string[]
    } catch {
      return []
    }
  },

  toDriver(value: string[]): string {
    if (!Array.isArray(value)) {
      throw new Error('stringArrayJson must be an array')
    }
    if (!value.every((v) => typeof v === 'string')) {
      throw new Error('stringArrayJson must be an array of strings')
    }
    return JSON.stringify(value)
  }
})

export const externalSites = customType<{
  data: ExternalSite[]
  driverData: string
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string): ExternalSite[] {
    if (!value || value === '[]') return []

    try {
      const parsed = JSON.parse(value)
      if (!Array.isArray(parsed)) {
        return []
      }

      const validated = parsed.filter((item): item is ExternalSite => {
        if (!item || typeof item !== 'object') return false
        if (typeof item.label !== 'string' || !item.label.trim()) return false
        if (typeof item.url !== 'string' || !item.url.trim()) return false
        try {
          new URL(item.url)
          return true
        } catch {
          return false
        }
      })

      return validated
    } catch {
      return []
    }
  },

  toDriver(value: ExternalSite[]): string {
    if (!Array.isArray(value)) {
      throw new Error('ExternalSites must be an array')
    }

    const errors: string[] = []
    value.forEach((site, index) => {
      if (!site || typeof site !== 'object') {
        errors.push(`Site at index ${index} is not an object`)
        return
      }
      if (typeof site.label !== 'string' || !site.label.trim()) {
        errors.push(`Site at index ${index} has invalid label`)
      }
      if (typeof site.url !== 'string' || !site.url.trim()) {
        errors.push(`Site at index ${index} has invalid url`)
      } else {
        try {
          new URL(site.url)
        } catch {
          errors.push(`Site at index ${index} has invalid URL format: ${site.url}`)
        }
      }
    })

    if (errors.length > 0) {
      throw new Error(`ExternalSites validation failed:\n${errors.join('\n')}`)
    }

    const uniqueSites = Array.from(new Map(value.map((site) => [site.url, site])).values())
    return JSON.stringify(uniqueSites)
  }
})

export const saveBackups = customType<{
  data: SaveBackup[]
  driverData: string
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string): SaveBackup[] {
    if (!value || value === '[]') return []
    try {
      const parsed = JSON.parse(value)
      if (!Array.isArray(parsed)) {
        return []
      }
      return parsed.filter(
        (item): item is SaveBackup =>
          item &&
          typeof item === 'object' &&
          typeof item.backupAt === 'number' &&
          typeof item.note === 'string' &&
          typeof item.locked === 'boolean' &&
          typeof item.saveFile === 'string'
      )
    } catch {
      return []
    }
  },

  toDriver(value: SaveBackup[]): string {
    if (!Array.isArray(value)) {
      throw new Error('SaveBackups must be an array')
    }
    value.forEach((item, index) => {
      if (
        !item ||
        typeof item !== 'object' ||
        typeof item.backupAt !== 'number' ||
        typeof item.note !== 'string' ||
        typeof item.locked !== 'boolean' ||
        typeof item.saveFile !== 'string'
      ) {
        throw new Error(`Invalid saveBackup object at index ${index}`)
      }
    })
    return JSON.stringify(value)
  }
})

export const failedScans = customType<{
  data: FailedScan[]
  driverData: string
}>({
  dataType() {
    return 'text'
  },

  fromDriver(value: string): FailedScan[] {
    if (!value || value === '[]') return []
    try {
      const parsed = JSON.parse(value)
      if (!Array.isArray(parsed)) {
        return []
      }
      return parsed.filter(
        (item): item is FailedScan =>
          item &&
          typeof item === 'object' &&
          typeof item.name === 'string' &&
          typeof item.reason === 'string' &&
          typeof item.path === 'string'
      )
    } catch {
      return []
    }
  },

  toDriver(value: FailedScan[]): string {
    if (!Array.isArray(value)) {
      throw new Error('FailedScans must be an array')
    }
    value.forEach((item, index) => {
      if (
        !item ||
        typeof item !== 'object' ||
        typeof item.name !== 'string' ||
        typeof item.reason !== 'string' ||
        typeof item.path !== 'string'
      ) {
        throw new Error(`Invalid failedScan object at index ${index}`)
      }
    })
    return JSON.stringify(value)
  }
})
