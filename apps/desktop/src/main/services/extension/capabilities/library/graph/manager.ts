import {
  createUnavailableError,
  normalizeCapabilityError,
  type ExtensionRuntimeMetadata,
  type LibraryGraphInput,
  type LibraryGraphResult
} from '@kisaki3/extension-api'
import type { DbService } from '@main/services/db'
import type { ExtensionLibraryAttachmentStore } from '../attachments'
import type {
  ExtensionLibraryComicChapterStore,
  ExtensionLibraryEntityStore,
  ExtensionLibraryEpisodeStore,
  ExtensionLibraryNovelVolumeStore
} from '../entities'
import { validateScopedGraphPaths } from './attachments'
import { applyLibraryGraph, previewLibraryGraph } from './execution/runner'
import { matchLibraryGraph } from './matching'
import { normalizeLibraryGraph } from './normalization'
import { assertValidLibraryGraphInput } from './validation'

export interface ExtensionLibraryGraphManagerOptions {
  db: DbService
  entities: ExtensionLibraryEntityStore
  episodes: ExtensionLibraryEpisodeStore
  chapters: ExtensionLibraryComicChapterStore
  volumes: ExtensionLibraryNovelVolumeStore
  attachments: ExtensionLibraryAttachmentStore
  resolveRuntimeHandle(runtimeHandle: string): ExtensionRuntimeMetadata | null | undefined
}

export class ExtensionLibraryGraphManager {
  constructor(private readonly options: ExtensionLibraryGraphManagerOptions) {}

  async preview(
    runtimeHandle: string,
    input: LibraryGraphInput,
    signal?: AbortSignal
  ): Promise<LibraryGraphResult> {
    return await this.run('preview', runtimeHandle, input, signal)
  }

  async apply(
    runtimeHandle: string,
    input: LibraryGraphInput,
    signal?: AbortSignal
  ): Promise<LibraryGraphResult> {
    return await this.run('apply', runtimeHandle, input, signal)
  }

  private async run(
    mode: 'preview' | 'apply',
    runtimeHandle: string,
    input: LibraryGraphInput,
    signal?: AbortSignal
  ): Promise<LibraryGraphResult> {
    const metadata = this.requireRuntime(runtimeHandle)
    const startedAt = Date.now()

    try {
      assertValidLibraryGraphInput(input)
      const graph = normalizeLibraryGraph(input)
      validateScopedGraphPaths(graph, metadata)
      const matches = matchLibraryGraph(graph, {
        db: this.options.db,
        entities: this.options.entities
      })
      const context = { mode, runtimeHandle, metadata, startedAt, signal }
      const executeOptions = {
        db: this.options.db,
        entities: this.options.entities,
        episodes: this.options.episodes,
        chapters: this.options.chapters,
        volumes: this.options.volumes,
        attachments: this.options.attachments
      }

      return mode === 'preview'
        ? await previewLibraryGraph(graph, matches, context, executeOptions)
        : await applyLibraryGraph(graph, matches, context, executeOptions)
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to process the library graph.')
    }
  }

  private requireRuntime(runtimeHandle: string): ExtensionRuntimeMetadata {
    const metadata = this.options.resolveRuntimeHandle(runtimeHandle)
    if (!metadata) {
      throw createUnavailableError(`Runtime handle "${runtimeHandle}" is not active.`)
    }

    return metadata
  }
}
