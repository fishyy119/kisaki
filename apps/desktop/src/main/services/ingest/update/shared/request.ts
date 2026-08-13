/** Fails fast on update requests missing their root entity or scraper profile. */
export function requireUpdateRequest(request: { rootId: string; profileId: string }): void {
  if (!request.rootId) {
    throw new Error('Update rootId is required')
  }
  if (!request.profileId) {
    throw new Error('Update profileId is required')
  }
}
