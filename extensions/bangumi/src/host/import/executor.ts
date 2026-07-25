import type { BangumiMediaScope } from '../media/scopes'
import type { MediaRegistry } from '../media/registry'
import type {
  LocalCollectionTarget,
  LocalMediaAdapter,
  LocalMediaAddFromScraperInput,
  LocalMediaAddResult,
  LocalMediaItem,
  LocalMediaUserPatch
} from '../media/types'
import { BangumiExtensionError } from '../utils/errors'
import { m } from '../i18n'

export class ImportExecutor {
  constructor(private readonly mediaRegistry: MediaRegistry) {}

  getLocalAdapter(scope: BangumiMediaScope): LocalMediaAdapter | undefined {
    return this.mediaRegistry.getLocalAdapter(scope)
  }

  requireWritableAdapter(scope: BangumiMediaScope): LocalMediaAdapter {
    const adapter = this.mediaRegistry.requireLocalAdapter(scope)
    if (!adapter.supportsImportWrite) {
      throw new BangumiExtensionError(
        'local_media_unsupported',
        m().errors.localWriteUnsupportedGeneric
      )
    }

    return adapter
  }

  async addFromScraper(
    scope: BangumiMediaScope,
    input: LocalMediaAddFromScraperInput
  ): Promise<LocalMediaAddResult> {
    return this.requireWritableAdapter(scope).addFromScraper(input)
  }

  async patchUserFields(
    scope: BangumiMediaScope,
    localId: string,
    patch: LocalMediaUserPatch
  ): Promise<LocalMediaItem> {
    return this.requireWritableAdapter(scope).patchUserFields(localId, patch)
  }

  async ensureTag(scope: BangumiMediaScope, localId: string, tagName: string): Promise<void> {
    await this.requireWritableAdapter(scope).ensureTag(localId, tagName)
  }

  async ensureInCollection(
    scope: BangumiMediaScope,
    localId: string,
    target: LocalCollectionTarget
  ): Promise<void> {
    await this.requireWritableAdapter(scope).ensureInCollection(localId, target)
  }
}
