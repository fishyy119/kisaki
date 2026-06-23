/** Formats structured validation issues as a terminal-friendly error message. */
export function formatValidationIssues(
  title: string,
  issues: readonly { path: string; message: string }[]
): string {
  return [title, ...issues.map((issue) => `${issue.path}: ${issue.message}`)].join('\n')
}
