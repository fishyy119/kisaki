import {
  parseExtensionRegistryManifest,
  type ExtensionRegistryManifest
} from '@kisaki3/extension-registry'

export interface ExtensionRegistryUrlPolicy {
  allowInsecureLocalUrls: boolean
}

export function assertRegistryManifestUrlPolicy(
  manifest: ExtensionRegistryManifest,
  policy: ExtensionRegistryUrlPolicy,
  label: string
): void {
  const issues = getRegistryManifestUrlPolicyIssues(manifest, policy)
  if (issues.length === 0) {
    return
  }

  throw new Error(`${label} uses URLs that are not allowed in this app mode. ${issues.join('; ')}`)
}

export function getRegistryManifestUrlPolicyIssues(
  manifest: ExtensionRegistryManifest,
  policy: ExtensionRegistryUrlPolicy
): string[] {
  const result = parseExtensionRegistryManifest(manifest, {
    allowInsecureLocalUrls: policy.allowInsecureLocalUrls
  })

  return result.manifest ? [] : result.issues.map((issue) => `${issue.path}: ${issue.message}`)
}
