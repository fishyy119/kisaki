export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size <= 0) {
    return [[...items]]
  }

  const output: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size))
  }
  return output
}
