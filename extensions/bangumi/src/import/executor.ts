import type { BangumiMediaScope } from '../media/scopes'
import type { LocalMediaAdapter } from '../media/types'
import { BangumiExtensionError } from '../shared/errors'

export class ImportExecutor {
  requireWritableAdapter(
    scope: BangumiMediaScope,
    adapter: LocalMediaAdapter | undefined
  ): LocalMediaAdapter {
    if (!adapter || !adapter.supportsImportWrite) {
      throw new BangumiExtensionError('local_media_unsupported', '当前媒体类型暂不支持写入本地库。')
    }

    return adapter
  }
}
