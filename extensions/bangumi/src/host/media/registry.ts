import { BangumiExtensionError } from '../utils/errors'
import { m } from '../i18n'
import { isBangumiMediaScope, type BangumiMediaScope } from '../../shared/scopes'
import type { BangumiMediaDescriptor, LocalMediaAdapter } from './types'

export class MediaRegistry {
  private readonly descriptors = new Map<BangumiMediaScope, BangumiMediaDescriptor>()

  constructor(descriptors: readonly BangumiMediaDescriptor[] = []) {
    for (const descriptor of descriptors) {
      this.register(descriptor)
    }
  }

  register(descriptor: BangumiMediaDescriptor): void {
    this.descriptors.set(descriptor.scope, descriptor)
  }

  list(): readonly BangumiMediaDescriptor[] {
    return [...this.descriptors.values()]
  }

  listLocalAdapters(): readonly LocalMediaAdapter[] {
    return this.list()
      .map((descriptor) => descriptor.localAdapter)
      .filter((adapter): adapter is LocalMediaAdapter => !!adapter)
  }

  get(scope: BangumiMediaScope): BangumiMediaDescriptor | undefined {
    return this.descriptors.get(scope)
  }

  require(scope: BangumiMediaScope): BangumiMediaDescriptor {
    const descriptor = this.get(scope)
    if (!descriptor) {
      throw new BangumiExtensionError('bangumi_validation', m().errors.mediaScopeNotRegistered)
    }
    return descriptor
  }

  requireLocalAdapter(scope: BangumiMediaScope): LocalMediaAdapter {
    const descriptor = this.require(scope)
    if (!descriptor.localAdapter) {
      throw new BangumiExtensionError(
        'local_media_unsupported',
        m().errors.localWriteUnsupported({ scope: descriptor.scope })
      )
    }
    return descriptor.localAdapter
  }

  getLocalAdapter(scope: BangumiMediaScope): LocalMediaAdapter | undefined {
    return this.get(scope)?.localAdapter
  }
}

export function requireRegisteredMediaScope(value: unknown): BangumiMediaScope {
  if (isBangumiMediaScope(value)) {
    return value
  }

  throw new BangumiExtensionError('bangumi_validation', m().errors.invalidMediaScope)
}
