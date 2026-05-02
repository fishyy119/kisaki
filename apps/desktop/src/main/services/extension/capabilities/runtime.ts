import { app } from 'electron'
import {
  EXTENSION_API_VERSION,
  createUnavailableError,
  type ExtensionRuntimeMetadata,
  type RuntimeInfo
} from '@kisaki/extension-api'
import { openExternalLink } from '@main/utils'

export interface ExtensionRuntimeCapabilityHostOptions {
  resolveRuntimeHandle(runtimeHandle: string): ExtensionRuntimeMetadata | null | undefined
}

export class ExtensionRuntimeCapabilityHost {
  constructor(private readonly options: ExtensionRuntimeCapabilityHostOptions) {}

  getMetadata(runtimeHandle: string): ExtensionRuntimeMetadata | null {
    return this.options.resolveRuntimeHandle(runtimeHandle) ?? null
  }

  getInfo(runtimeHandle: string): RuntimeInfo {
    const metadata = this.getMetadata(runtimeHandle)
    if (!metadata) {
      throw createUnavailableError(`Runtime handle "${runtimeHandle}" is not active.`)
    }

    return {
      appVersion: app.getVersion(),
      apiVersion: EXTENSION_API_VERSION,
      mode: metadata.mode,
      platform: toRuntimePlatform(process.platform),
      arch: process.arch
    }
  }

  async openExternal(runtimeHandle: string, url: string): Promise<void> {
    const metadata = this.getMetadata(runtimeHandle)
    if (!metadata) {
      throw createUnavailableError(`Runtime handle "${runtimeHandle}" is not active.`)
    }

    await openExternalLink(url)
  }
}

function toRuntimePlatform(platform: NodeJS.Platform): RuntimeInfo['platform'] {
  switch (platform) {
    case 'darwin':
      return 'macos'
    case 'win32':
      return 'windows'
    default:
      return 'linux'
  }
}
