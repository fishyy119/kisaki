import { rm } from 'node:fs/promises'
import path from 'node:path'
import spawn from 'cross-spawn'
import {
  spawnKisxHostBuildWatcher,
  spawnKisxUiDevServer,
  waitForBuiltinExtensionUiDevServersReady,
  waitForBuiltinExtensionWatchersReady
} from './kisx'
import { resetOutputRoot } from './output'
import { resolveBuiltinExtensionOutputRoot } from './paths'
import { findBuiltinExtensionProjects, findBuiltinExtensionProjectsWithUi } from './projects'
import { terminateProcess } from './process'
import { prepareExtensionDebugPackages } from './tooling'
import type { BuiltinExtensionToolContext } from './types'

/** Watches built-in extensions and runs the desktop development command. */
export async function watchBuiltinExtensions(
  context: BuiltinExtensionToolContext,
  childCommand: string[]
): Promise<void> {
  const outputRoot = resolveBuiltinExtensionOutputRoot(context, 'dev')
  const projects = await findBuiltinExtensionProjects(context)
  await resetOutputRoot(outputRoot)
  await prepareExtensionDebugPackages(context, outputRoot, true, projects)

  if (projects.length === 0) {
    console.log(
      `[builtin-extensions] No built-in extensions found in ${context.builtinExtensionsRoot}`
    )
  } else {
    console.log(`[builtin-extensions] Building ${projects.length} built-in extension(s)`)
    await Promise.all(
      projects.map((project) => rm(path.join(project, 'dist'), { recursive: true, force: true }))
    )
  }

  const uiProjects = await findBuiltinExtensionProjectsWithUi(projects)
  const watchers = projects.map((project) => spawnKisxHostBuildWatcher(context, project))
  const uiServers = uiProjects.map((project) => spawnKisxUiDevServer(context, project))
  let uiServerOrigins = new Map<string, string>()

  try {
    const readyUiServers = await Promise.all([
      waitForBuiltinExtensionWatchersReady(watchers),
      waitForBuiltinExtensionUiDevServersReady(uiServers)
    ]).then(([, origins]) => origins)
    uiServerOrigins = new Map(
      readyUiServers.map((server) => [path.resolve(server.project), server.origin])
    )
  } catch (error) {
    for (const watcher of watchers) {
      terminateProcess(watcher.process)
    }
    for (const uiServer of uiServers) {
      terminateProcess(uiServer.process)
    }
    throw error
  }

  const [appCommand, ...appArgs] = childCommand
  const appProcess = spawn(appCommand, appArgs, {
    cwd: context.desktopRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      KISAKI_DEV_EXTENSIONS: JSON.stringify(
        projects.map((project) => {
          const uiDevServerOrigin = uiServerOrigins.get(path.resolve(project))
          return {
            path: project,
            ...(uiDevServerOrigin ? { uiDevServerOrigin } : {})
          }
        })
      )
    }
  })

  let stopping = false
  const stop = (code = 0): void => {
    if (stopping) {
      return
    }

    stopping = true

    for (const watcher of watchers) {
      terminateProcess(watcher.process)
    }
    for (const uiServer of uiServers) {
      terminateProcess(uiServer.process)
    }

    terminateProcess(appProcess)

    process.exit(code)
  }

  appProcess.on('error', (error) => {
    console.error(`[builtin-extensions] Failed to start ${appCommand}:`, error)
    stop(1)
  })

  appProcess.on('close', (code) => {
    stop(code ?? 0)
  })

  for (const watcher of watchers) {
    watcher.process.on('close', (code) => {
      if (!stopping && code !== 0 && code !== null) {
        console.error(`[builtin-extensions] Extension build watcher exited with code ${code}`)
        stop(code)
      }
    })
  }
  for (const uiServer of uiServers) {
    uiServer.process.on('close', (code) => {
      if (!stopping && code !== 0 && code !== null) {
        console.error(`[builtin-extensions] Extension UI dev server exited with code ${code}`)
        stop(code)
      }
    })
  }

  process.once('SIGINT', () => stop(130))
  process.once('SIGTERM', () => stop(143))

  await new Promise<void>(() => undefined)
}
