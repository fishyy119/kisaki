export function toScraperProviderRegistration<TSlot extends string>(
  provider: {
    readonly id: string
    readonly name: string
    readonly capabilities: readonly unknown[]
  },
  allowedSlots: readonly TSlot[]
): {
  id: string
  name: string
  capabilities: readonly ('search' | TSlot)[]
} {
  return {
    id: provider.id,
    name: provider.name,
    capabilities: normalizeScraperCapabilities(provider.capabilities, allowedSlots)
  }
}

function normalizeScraperCapabilities<TSlot extends string>(
  capabilities: readonly unknown[],
  allowedSlots: readonly TSlot[]
): readonly ('search' | TSlot)[] {
  const allowedCapabilities = new Set<string>(['search', ...allowedSlots])
  return capabilities.filter(
    (capability): capability is 'search' | TSlot =>
      typeof capability === 'string' && allowedCapabilities.has(capability)
  )
}
