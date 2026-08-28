import path from 'node:path'
import type { DevelopmentExtension } from '../../src/shared/bootstrap'
import { startBuiltinExtensionUiDevServer, watchBuiltinExtensionHost } from './kisx'
import { resetOutputRoot } from './output'
import { resolveBuiltinExtensionOutputRoot } from './paths'
import { findBuiltinExtensionProjects, findBuiltinExtensionProjectsWithUi } from './projects'
import { prepareExtensionDebugPackages } from './tooling'
import type { BuiltinExtensionToolContext } from './types'

/** Running in-process dev session spanning all built-in extensions. */
export interface BuiltinExtensionDevSession {
  readonly extensions: readonly DevelopmentExtension[]
  close(): Promise<void>
}

/**
 * Prepares debug packages, then watches host bundles and serves webview UI for
 * every built-in extension inside the current process. Resolves after every
 * host bundle finished its first build and every UI dev server is listening.
 * A startup failure exits the dev process, which releases every in-process
 * watcher and server, so no partial cleanup is needed here.
 */
export async function startBuiltinExtensionDevSession(
  context: BuiltinExtensionToolContext
): Promise<BuiltinExtensionDevSession> {
  const outputRoot = resolveBuiltinExtensionOutputRoot(context, 'dev')
  const projects = await findBuiltinExtensionProjects(context)
  await resetOutputRoot(outputRoot)
  await prepareExtensionDebugPackages(context, outputRoot, true, projects)

  if (projects.length === 0) {
    console.log(
      `[builtin-extensions] No built-in extensions found in ${context.builtinExtensionsRoot}`
    )
    return { extensions: [], close: () => Promise.resolve() }
  }

  console.log(`[builtin-extensions] Watching ${projects.length} built-in extension(s)`)
  const uiProjects = await findBuiltinExtensionProjectsWithUi(projects)

  const [hostSessions, uiServers] = await Promise.all([
    Promise.all(projects.map((project) => watchBuiltinExtensionHost(project))),
    Promise.all(
      uiProjects.map(async (project) => ({
        project,
        server: await startBuiltinExtensionUiDevServer(project)
      }))
    )
  ])

  const uiServerOrigins = new Map(
    uiServers.map(({ project, server }) => [path.resolve(project), server.origin])
  )
  const extensions = projects.map((project): DevelopmentExtension => {
    const uiDevServerOrigin = uiServerOrigins.get(path.resolve(project))
    return {
      path: project,
      ...(uiDevServerOrigin ? { uiDevServerOrigin } : {})
    }
  })

  return {
    extensions,
    close: async (): Promise<void> => {
      await Promise.allSettled([
        ...hostSessions.map((session) => session.close()),
        ...uiServers.map(({ server }) => server.close())
      ])
    }
  }
}
