export function dedupeTargets<TTarget extends { entity: string; id: string }>(
  targets: TTarget[]
): TTarget[] {
  const seen = new Set<string>()
  const deduped: TTarget[] = []
  for (const target of targets) {
    const key = `${target.entity}:${target.id}`
    if (!seen.has(key)) {
      seen.add(key)
      deduped.push(target)
    }
  }
  return deduped
}
